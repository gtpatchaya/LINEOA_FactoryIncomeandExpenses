const { round2 } = require('../util');

/* รวมยอดจากรายการ (ไม่นับรายการที่ยกเลิก) */
function summarize(list) {
  const active = list.filter((t) => t.status === 'active');
  const sums = { income: 0, expense: 0 };
  const cats = { income: {}, expense: {} };
  for (const t of active) {
    sums[t.type] += t.amount;
    cats[t.type][t.category] = (cats[t.type][t.category] || 0) + t.amount;
  }
  const breakdown = (type) => Object.entries(cats[type])
    .map(([category, amount]) => ({ category, amount: round2(amount), percent: sums[type] ? Math.round((amount / sums[type]) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return {
    income: round2(sums.income), expense: round2(sums.expense),
    balance: round2(sums.income - sums.expense), count: active.length,
    byCategory: { income: breakdown('income'), expense: breakdown('expense') },
  };
}

module.exports = { summarize };
