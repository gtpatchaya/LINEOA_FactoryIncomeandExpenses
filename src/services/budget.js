const store = require('../store');
const { summarize } = require('./summary');
const { normalize, status } = require('./budget-status');
const { baht } = require('../util');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function getBudget(userId) {
  const user = await store.getUser(userId);
  return normalize(user?.budget);
}

/* ตั้งงบ: { monthly, categories:[{category, amount}] } (monthly = 0 และไม่มีหมวด = ปิดงบ) */
async function setBudget(userId, input, validCategories) {
  const next = normalize(input);
  if (Number(input?.monthly) > 99999999) throw httpError(400, 'งบสูงเกินไป');
  const known = new Set(validCategories || []);
  next.categories = next.categories.filter((c) => !known.size || known.has(c.category));
  const user = await store.getUser(userId);
  await store.saveUser(userId, { budget: { ...next, alerts: user?.budget?.alerts || {} } });
  return next;
}

const monthText = (st) => `ใช้ไป ${baht(st.spent)} จากงบ ${baht(st.monthly)}`;

function warnText(st) {
  const daily = st.dailyAllowance ? ` เฉลี่ยวันละ ${baht(st.dailyAllowance)} ถึงสิ้นเดือน (อีก ${st.daysLeft} วัน)` : '';
  return `⚠️ เงินใกล้หมดแล้ว! ${monthText(st)} (${st.percent}%) เหลือ ${baht(st.remaining)}${daily}`;
}
function overText(st) {
  return `🚨 เกินงบเดือนนี้แล้ว! ${monthText(st)} เกินมา ${baht(Math.abs(st.remaining))}\nเตรียมมาม่าไว้เลยนะ 🍜 ประหยัดๆ ถึงสิ้นเดือน`;
}

/* ตรวจหลังบันทึกรายจ่าย: คืนข้อความเตือนเฉพาะตอนข้ามเกณฑ์ 80% / 100% (ต่อเดือน ไม่เตือนซ้ำ) */
async function checkAlerts(userId, ym) {
  const [user, list] = await Promise.all([store.getUser(userId), store.txByUserMonth(userId, ym)]);
  const st = status(user, summarize(list), ym);
  if (!st.enabled) return [];
  const flags = { ...(user.budget?.alerts?.[ym] || {}) };
  const cflags = { ...(flags.c || {}) };
  const out = [];
  if (st.monthly) {
    if (st.level === 'over' && !flags.o) { out.push({ level: 'over', text: overText(st) }); flags.o = true; flags.w = true; }
    else if (st.level === 'warn' && !flags.w) { out.push({ level: 'warn', text: warnText(st) }); flags.w = true; }
  }
  for (const c of st.categories) {
    const sent = cflags[c.category];
    if (c.level === 'over' && sent !== 'o') {
      out.push({ level: 'over', text: `🚨 หมวด "${c.category}" เกินงบแล้ว (${baht(c.spent)} / ${baht(c.limit)})` }); cflags[c.category] = 'o';
    } else if (c.level === 'warn' && !sent) {
      out.push({ level: 'warn', text: `⚠️ หมวด "${c.category}" ใช้ไป ${c.percent}% แล้ว (${baht(c.spent)} / ${baht(c.limit)})` }); cflags[c.category] = 'w';
    }
  }
  if (out.length) {
    await store.saveUser(userId, { budget: { ...normalize(user.budget), alerts: { [ym]: { ...flags, c: cflags } } } });
  }
  return out;
}

module.exports = { getBudget, setBudget, checkAlerts };
