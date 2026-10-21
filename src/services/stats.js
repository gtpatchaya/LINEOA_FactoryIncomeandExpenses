const store = require('../store');
const { round2, todayTH, thMonthLabel, THAI_MONTHS_SHORT } = require('../util');
const { daysInMonth } = require('./budget-status');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7); };

/* กราฟแท่งเปรียบเทียบรายรับ-รายจ่าย: รายวัน (ในเดือน) / รายเดือน (6 เดือน) / รายปี (5 ปี) */
async function stats(userId, period, anchor) {
  const today = todayTH();
  let buckets = []; let keyOf; let range; let avgLabel; let divisor;

  if (period === 'day') {
    const ym = anchor && /^\d{4}-\d{2}$/.test(anchor) ? anchor : today.slice(0, 7);
    const n = daysInMonth(ym);
    buckets = Array.from({ length: n }, (_, i) => ({ key: `${ym}-${String(i + 1).padStart(2, '0')}`, label: String(i + 1) }));
    keyOf = (t) => t.date; range = thMonthLabel(ym); avgLabel = 'เฉลี่ย/วัน';
    divisor = ym === today.slice(0, 7) ? Number(today.slice(8, 10)) : n;
  } else if (period === 'month') {
    const end = anchor && /^\d{4}-\d{2}$/.test(anchor) ? anchor : today.slice(0, 7);
    for (let i = 5; i >= 0; i--) {
      const ym = shiftMonth(end, -i); const [y, m] = ym.split('-').map(Number);
      buckets.push({ key: ym, label: `${THAI_MONTHS_SHORT[m - 1]}\n${String(y + 543).slice(2)}` });
    }
    keyOf = (t) => t.ym; range = `${thMonthLabel(buckets[0].key)} - ${thMonthLabel(end)}`; avgLabel = 'เฉลี่ย/เดือน'; divisor = 6;
  } else if (period === 'year') {
    const end = anchor && /^\d{4}$/.test(anchor) ? Number(anchor) : Number(today.slice(0, 4));
    for (let y = end - 4; y <= end; y++) buckets.push({ key: String(y), label: String(y + 543) });
    keyOf = (t) => t.date.slice(0, 4); range = `พ.ศ. ${end - 4 + 543} - ${end + 543}`; avgLabel = 'เฉลี่ย/ปี'; divisor = 5;
  } else throw httpError(400, 'period ไม่ถูกต้อง');

  const index = new Map(buckets.map((b, i) => [b.key, i]));
  buckets.forEach((b) => { b.income = 0; b.expense = 0; });
  let ci = 0; let ce = 0;
  for (const t of await store.txByUser(userId)) {
    if (t.status !== 'active') continue;
    const i = index.get(keyOf(t)); if (i === undefined) continue;
    buckets[i][t.type] += t.amount;
    if (t.type === 'income') ci++; else ce++;
  }
  buckets.forEach((b) => { b.income = round2(b.income); b.expense = round2(b.expense); });
  const income = round2(buckets.reduce((s, b) => s + b.income, 0));
  const expense = round2(buckets.reduce((s, b) => s + b.expense, 0));
  return {
    period, range, avgLabel, buckets,
    totals: { income, expense, countIncome: ci, countExpense: ce, avgIncome: round2(income / divisor), avgExpense: round2(expense / divisor) },
  };
}

module.exports = { stats };
