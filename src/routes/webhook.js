const express = require('express');
const config = require('../config');
const store = require('../store');
const line = require('../line');
const tx = require('../services/transactions');
const { getSettings } = require('../services/settings');
const { monthTH, thMonthLabel, thDateShort, baht } = require('../util');

const router = express.Router();

const liffUrl = (q = '') => (config.liffId ? `https://liff.line.me/${config.liffId}${q}` : '');
const text = (t, quick) => ({ type: 'text', text: t, ...(quick ? { quickReply: { items: quick.map((q) => ({ type: 'action', action: { type: 'message', label: q, text: q } })) } } : {}) });
const QUICK = ['ยอด', 'สรุป', 'ประวัติ', 'ยกเลิก', 'วิธีใช้'];
const code = (t) => t.id.slice(-4).toUpperCase();
const sign = (t) => (t.type === 'income' ? '+' : '−') + baht(t.amount);

const HELP = `📒 วิธีใช้งาน
• รับ 5000 ขายสินค้า ร้านสยาม  → บันทึกรายรับ
• จ่าย 300 วัตถุดิบ ซื้อเม็ดพลาสติก  → บันทึกรายจ่าย
  (ใช้ + หรือ - แทน รับ/จ่าย ได้ เช่น -300 ค่าขนส่ง)
• ยอด  → ดูเงินคงเหลือ
• สรุป  → สรุปรายรับ-รายจ่ายเดือนนี้
• ประวัติ  → ดู 5 รายการล่าสุด
• ยกเลิก  → ยกเลิกรายการล่าสุด
• ยกเลิก A1B2  → ยกเลิกตามรหัสรายการ`;

const RECORD = /^(รายรับ|รายจ่าย|รับ|จ่าย|\+|-|−)\s*([\d,]+(?:\.\d{1,2})?)\s*(.*)$/s;

async function handleText(userId, raw) {
  const msg = raw.trim();
  const settings = await getSettings();

  // 1,2) บันทึกรายการ
  const m = msg.match(RECORD);
  if (m) {
    const type = ['รับ', 'รายรับ', '+'].includes(m[1]) ? 'income' : 'expense';
    const cats = settings.categories[type];
    const rest = m[3].trim();
    const [first = '', ...others] = rest.split(/\s+/);
    const hit = cats.find((c) => first && (c === first || c.startsWith(first)));
    const fallback = cats.find((c) => c.startsWith('อื่น') || c.includes('อื่นๆ')) || cats[cats.length - 1];
    const created = await tx.addTransaction(userId, {
      type, amount: m[2], category: hit || fallback, note: hit ? others.join(' ') : rest,
    }, 'line');
    return [text(
      `✅ บันทึก${type === 'income' ? 'รายรับ' : 'รายจ่าย'}แล้ว\n${sign(created)} · ${created.category}${created.note ? `\n📝 ${created.note}` : ''}\nรหัส ${code(created)} (พิมพ์ "ยกเลิก" เพื่อเลิกทำ)`,
      QUICK,
    )];
  }

  // 6) ยอดคงเหลือ
  if (/^(ยอด|เงินคงเหลือ|คงเหลือ|balance)$/i.test(msg)) {
    const s = await tx.monthSummary(userId, monthTH());
    return [text(`💰 เงินคงเหลือ\nเดือนนี้: ${baht(s.balance)}\nสะสมทั้งหมด: ${baht(s.totalBalance)}\n\nรายรับ ${baht(s.income)} · รายจ่าย ${baht(s.expense)}`, QUICK)];
  }

  // 4,5) สรุปรายเดือน
  if (/^(สรุป|สรุปเดือนนี้)$/.test(msg)) {
    const s = await tx.monthSummary(userId, monthTH());
    const rows = (list) => (list.length ? list.map((c) => `  ${c.category} ${baht(c.amount)} (${c.percent}%)`).join('\n') : '  -');
    return [text(
      `📊 สรุป ${thMonthLabel(s.month)}\n🟢 รายรับ ${baht(s.income)}\n${rows(s.byCategory.income)}\n\n🟠 รายจ่าย ${baht(s.expense)}\n${rows(s.byCategory.expense)}\n\n💰 คงเหลือ ${baht(s.balance)}`,
      QUICK,
    )];
  }

  // ประวัติ
  if (/^(ประวัติ|รายการ|รายการล่าสุด)$/.test(msg)) {
    const list = await tx.recent(userId, 5);
    if (!list.length) return [text('ยังไม่มีรายการ ลองพิมพ์ เช่น "จ่าย 300 วัตถุดิบ"', QUICK)];
    return [text('🕘 รายการล่าสุด\n' + list.map((t) => `${code(t)} · ${thDateShort(t.date)} · ${t.category}\n   ${sign(t)}${t.note ? ' · ' + t.note : ''}`).join('\n'), QUICK)];
  }

  // 7) ยกเลิกรายการ
  const c = msg.match(/^ยกเลิก(?:\s+([0-9a-f]{4}))?$/i);
  if (c) {
    let target;
    if (c[1]) target = (await tx.recent(userId, 50)).find((t) => code(t) === c[1].toUpperCase());
    else target = (await tx.recent(userId, 1))[0];
    if (!target) return [text('ไม่พบรายการที่จะยกเลิก', QUICK)];
    await tx.cancelTransaction(target.id, { userId });
    return [text(`↩️ ยกเลิกรายการแล้ว\n${sign(target)} · ${target.category}${target.note ? ' · ' + target.note : ''}`, QUICK)];
  }

  if (/^(เมนู|menu|เปิดแอป|แอป)$/i.test(msg) && liffUrl()) {
    return [text(`เปิดแอปบันทึกบัญชี\n${liffUrl()}`, QUICK)];
  }
  return [text(HELP + (liffUrl() ? `\n\n📱 เปิดแอป: ${liffUrl()}` : ''), QUICK)];
}

router.post('/', async (req, res) => {
  if (!line.verifySignature(req.rawBody || Buffer.alloc(0), req.headers['x-line-signature'])) {
    return res.status(401).end();
  }
  res.status(200).end(); // ตอบ LINE ทันที แล้วค่อยประมวลผล

  for (const ev of req.body.events || []) {
    try {
      const userId = ev.source?.userId;
      if (!userId) continue;
      let user = await store.getUser(userId);
      if (!user) {
        const p = await line.getProfile(userId);
        user = await store.saveUser(userId, {
          displayName: p?.displayName || '', pictureUrl: p?.pictureUrl || '',
          active: true, openingBalance: 0, createdAt: new Date().toISOString(),
        });
      }
      if (ev.type === 'follow') {
        await line.reply(ev.replyToken, [text(`สวัสดี${user.displayName ? ' คุณ' + user.displayName : ''} 👋\nยินดีต้อนรับสู่ระบบบัญชีโรงงาน\n\n${HELP}${liffUrl() ? `\n\n📱 เปิดแอป: ${liffUrl()}` : ''}`, QUICK)]);
      } else if (ev.type === 'message' && ev.message.type === 'text') {
        if (user.active === false) { await line.reply(ev.replyToken, [text('บัญชีนี้ถูกระงับการใช้งาน')]); continue; }
        let msgs;
        try { msgs = await handleText(userId, ev.message.text); }
        catch (e) {
          if (!e.status) throw e;
          msgs = [text(`⚠️ ${e.message}`, QUICK)];
        }
        await line.reply(ev.replyToken, msgs);
      }
    } catch (e) { console.error('[webhook]', e); }
  }
});

module.exports = router;
