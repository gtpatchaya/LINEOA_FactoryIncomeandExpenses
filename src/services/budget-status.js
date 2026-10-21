const { round2, todayTH } = require('../util');

const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/* งบของผู้ใช้ → รูปแบบมาตรฐาน { monthly, categories:[{category,amount}] } */
function normalize(b) {
  const monthly = round2(Math.max(0, Number(b?.monthly) || 0));
  const categories = (Array.isArray(b?.categories) ? b.categories : [])
    .filter((c) => c && c.category && Number(c.amount) > 0)
    .map((c) => ({ category: String(c.category).slice(0, 30), amount: round2(Number(c.amount)) }));
  return { monthly, categories };
}

const levelOf = (pct) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');

/* สถานะงบของเดือน ym จากยอดสรุป sum (ผลของ summarize) */
function status(user, sum, ym) {
  const b = normalize(user?.budget);
  if (!b.monthly && !b.categories.length) return { enabled: false, monthly: 0, categories: [] };
  const today = todayTH();
  const isCurrent = ym === today.slice(0, 7);
  const daysLeft = isCurrent ? daysInMonth(ym) - Number(today.slice(8, 10)) + 1 : 0; // นับรวมวันนี้
  const spent = sum.expense;
  const remaining = round2(b.monthly - spent);
  const percent = b.monthly ? Math.round((spent / b.monthly) * 100) : 0;
  const spentBy = Object.fromEntries(sum.byCategory.expense.map((c) => [c.category, c.amount]));
  return {
    enabled: true, monthly: b.monthly, spent, remaining, percent,
    level: b.monthly ? levelOf(percent) : 'none',
    daysLeft, dailyAllowance: isCurrent && daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
    categories: b.categories.map((c) => {
      const s = spentBy[c.category] || 0; const p = Math.round((s / c.amount) * 100);
      return { category: c.category, limit: c.amount, spent: s, percent: p, level: levelOf(p) };
    }),
  };
}

module.exports = { normalize, status, levelOf, daysInMonth };
