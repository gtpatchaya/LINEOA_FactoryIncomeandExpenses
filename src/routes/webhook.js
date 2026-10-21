const express = require('express');
const config = require('../config');
const store = require('../store');
const line = require('../line');
const flex = require('../flex');
const tx = require('../services/transactions');
const budget = require('../services/budget');
const { parseMessage } = require('../services/parse');
const { getSettings } = require('../services/settings');
const { monthTH, thMonthLabel, thDateShort, baht } = require('../util');

const router = express.Router();

const liffUrl = (q = '') => (config.liffId ? `https://liff.line.me/${config.liffId}${q}` : '');
const text = (t, quick) => ({ type: 'text', text: t, ...(quick ? { quickReply: { items: quick.map((q) => ({ type: 'action', action: { type: 'message', label: q, text: q } })) } } : {}) });
const withQuick = (msg) => ({ ...msg, quickReply: { items: QUICK.map((q) => ({ type: 'action', action: { type: 'message', label: q, text: q } })) } });
const QUICK = ['ยอด', 'สรุป', 'งบ', 'ประวัติ', 'ยกเลิก', 'วิธีใช้'];
const code = (t) => t.id.slice(-4).toUpperCase();
const sign = (t) => (t.type === 'income' ? '+' : '−') + baht(t.amount);

const HELP = `🐷 พิมพ์จดได้เลย!
• จ่าย 120 อาหาร ข้าวมันไก่
• ข้าวมันไก่ 60  (ไม่ต้องพิมพ์ "จ่าย" ก็ได้)
• รับ 5000 เงินเดือน  หรือ  +5000 ค่าขนม

📊 ดูข้อมูล
• ยอด  → เงินคงเหลือ
• สรุป  → สรุปเดือนนี้แยกหมวด
• ประวัติ  → 5 รายการล่าสุด
• ยกเลิก  → ยกเลิกรายการล่าสุด (หรือ ยกเลิก A1B2)

🎯 ตั้งงบ (เตือนเมื่อเงินใกล้หมด)
• ตั้งงบ 5000  → งบใช้จ่ายต่อเดือน
• งบ อาหาร 2000  → งบแยกหมวด
• งบ  → ดูงบ · ปิดงบ  → ยกเลิกงบ`;

async function budgetCommand(user, arg, settings) {
  const userId = user.id;
  const a = (arg || '').trim();
  if (!a) {
    const sum = await tx.monthSummary(userId, monthTH());
    if (!sum.budget.enabled) return [text('ยังไม่ได้ตั้งงบ 🐷\nลองพิมพ์ "ตั้งงบ 5000" (งบใช้จ่ายต่อเดือน) แล้วบอทจะเตือนเมื่อเงินใกล้หมด', QUICK)];
    return [withQuick(flex.budgetCard(sum.budget))];
  }
  if (/^(ปิด|ลบ|ยกเลิก)$/.test(a)) {
    await budget.setBudget(userId, { monthly: 0, categories: [] }, []);
    return [text('ปิดงบเรียบร้อยแล้ว', QUICK)];
  }
  const cur = await budget.getBudget(userId);
  const m = a.match(/^(?:(.+?)\s+)?฿?([\d,]+(?:\.\d{1,2})?)\s*(?:บาท)?$/);
  if (!m) return [text('พิมพ์แบบนี้นะ: "ตั้งงบ 5000" หรือ "งบ อาหาร 2000"', QUICK)];
  const amount = Number(m[2].replace(/,/g, ''));
  if (m[1]) {
    const cats = settings.categories.expense;
    const cat = cats.find((c) => c === m[1] || c.startsWith(m[1]));
    if (!cat) return [text(`ไม่พบหมวด "${m[1]}"\nหมวดที่มี: ${cats.join(', ')}`, QUICK)];
    const rest = cur.categories.filter((c) => c.category !== cat);
    await budget.setBudget(userId, { monthly: cur.monthly, categories: amount ? [...rest, { category: cat, amount }] : rest }, cats);
  } else {
    await budget.setBudget(userId, { monthly: amount, categories: cur.categories }, settings.categories.expense);
  }
  const sum = await tx.monthSummary(userId, monthTH());
  return [text('✅ ตั้งงบเรียบร้อย', undefined), withQuick(flex.budgetCard(sum.budget))];
}

async function handleText(user, raw) {
  const userId = user.id;
  const msg = raw.trim();
  const settings = await getSettings();

  // 🎯 งบประมาณ
  const bm = msg.match(/^(?:ตั้งงบ|งบ|ปิดงบ|ลบงบ)(?:\s+(.*))?$/);
  if (bm) return budgetCommand(user, /^(ปิดงบ|ลบงบ)/.test(msg) ? 'ปิด' : bm[1], settings);

  // 6) ยอดคงเหลือ
  if (/^(ยอด|เงินคงเหลือ|คงเหลือ|balance)$/i.test(msg)) {
    const s = await tx.monthSummary(userId, monthTH());
    return [withQuick(flex.balanceCard(s, s.budget))];
  }

  // 4,5) สรุปรายเดือน
  if (/^(สรุป|สรุปเดือนนี้)$/.test(msg)) {
    const s = await tx.monthSummary(userId, monthTH());
    const rows = (list) => (list.length ? list.map((c) => `  ${c.category} ${baht(c.amount)} (${c.percent}%)`).join('\n') : '  -');
    const link = liffUrl('?tab=summary');
    return [text(
      `📊 สรุป ${thMonthLabel(s.month)}\n🟢 รายรับ ${baht(s.income)}\n${rows(s.byCategory.income)}\n\n🟠 รายจ่าย ${baht(s.expense)}\n${rows(s.byCategory.expense)}\n\n💰 คงเหลือ ${baht(s.balance)}${link ? `\n\nดูกราฟเปรียบเทียบ → ${link}` : ''}`,
      QUICK,
    )];
  }

  // ประวัติ
  if (/^(ประวัติ|รายการ|รายการล่าสุด)$/.test(msg)) {
    const list = await tx.recent(userId, 5);
    if (!list.length) return [text('ยังไม่มีรายการ ลองพิมพ์ เช่น "ข้าวมันไก่ 60"', QUICK)];
    return [text('🕘 รายการล่าสุด\n' + list.map((t) => `${code(t)} · ${thDateShort(t.date)} · ${t.category}\n   ${sign(t)}${t.note ? ' · ' + t.note : ''}`).join('\n'), QUICK)];
  }

  // 7) ยกเลิกรายการ
  const c = msg.match(/^ยกเลิก(?:\s+([0-9a-f]{4}))?$/i);
  if (c) {
    const recent = await tx.recent(userId, c[1] ? 50 : 1);
    const target = c[1] ? recent.find((t) => code(t) === c[1].toUpperCase()) : recent[0];
    if (!target) return [text('ไม่พบรายการที่จะยกเลิก', QUICK)];
    await tx.cancelTransaction(target.id, { userId });
    return [text(`↩️ ยกเลิกรายการแล้ว\n${sign(target)} · ${target.category}${target.note ? ' · ' + target.note : ''}`, QUICK)];
  }

  if (/^(เมนู|menu|เปิดแอป|แอป)$/i.test(msg) && liffUrl()) return [text(`เปิดแอปบันทึกบัญชี\n${liffUrl()}`, QUICK)];
  if (/^(วิธีใช้|help|ช่วยเหลือ|\?)$/i.test(msg)) return [text(HELP + (liffUrl() ? `\n\n📱 เปิดแอป: ${liffUrl()}` : ''), QUICK)];

  // 1,2) บันทึกรายการ — พิมพ์อิสระ
  const parsed = parseMessage(msg, settings.categories);
  if (parsed) {
    const created = await tx.addTransaction(userId, parsed, 'line');
    const [sum, alerts] = await Promise.all([
      tx.monthSummary(userId, created.ym),
      created.type === 'expense' ? budget.checkAlerts(userId, created.ym) : [],
    ]);
    return [withQuick(flex.recordCard(created, code(created), sum.budget)), ...alerts.map((a) => text(a.text))];
  }
  return [text(HELP + (liffUrl() ? `\n\n📱 เปิดแอป: ${liffUrl()}` : ''), QUICK)];
}

async function handleEvent(ev) {
  const userId = ev.source?.userId;
  if (!userId) return;
  let user = await store.getUser(userId);
  if (!user) {
    const p = await line.getProfile(userId);
    user = await store.saveUser(userId, {
      displayName: p?.displayName || '', pictureUrl: p?.pictureUrl || '',
      active: true, openingBalance: 0, createdAt: new Date().toISOString(),
    });
  }
  if (ev.type === 'follow') {
    return line.reply(ev.replyToken, [text(`สวัสดี${user.displayName ? ' คุณ' + user.displayName : ''} 👋\nยินดีต้อนรับสู่พิกกี้เลี้ยงหมู 🐷 ตัวช่วยจดรายรับ-รายจ่าย\n\n${HELP}${liffUrl() ? `\n\n📱 เปิดแอป: ${liffUrl()}` : ''}`, QUICK)]);
  }
  if (ev.type === 'message' && ev.message.type === 'text') {
    if (user.active === false) return line.reply(ev.replyToken, [text('บัญชีนี้ถูกระงับการใช้งาน')]);
    let msgs;
    try { msgs = await handleText(user, ev.message.text); }
    catch (e) {
      if (!e.status) throw e;
      msgs = [text(`⚠️ ${e.message}`, QUICK)];
    }
    return line.reply(ev.replyToken, msgs);
  }
}

router.post('/', async (req, res) => {
  if (!line.verifySignature(req.rawBody || Buffer.alloc(0), req.headers['x-line-signature'])) {
    return res.status(401).end();
  }
  // ประมวลผลให้เสร็จ "ก่อน" ตอบ 200 — บน serverless (Netlify/Lambda) ฟังก์ชันจะถูกแช่แข็งทันทีที่ตอบกลับ
  // ถ้าตอบก่อนแล้วค่อยทำ การตอบ LINE จะค้างจนกว่าจะมี request ถัดไป (ทำให้บอทตอบช้ามาก)
  await Promise.all((req.body.events || []).map((ev) => handleEvent(ev).catch((e) => console.error('[webhook]', e))));
  res.status(200).end();
});

module.exports = router;
