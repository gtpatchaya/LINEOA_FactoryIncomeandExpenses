const express = require('express');
const config = require('../config');
const { requireUser } = require('../auth');
const { getSettings } = require('../services/settings');
const tx = require('../services/transactions');
const { monthTH, isMonth } = require('../util');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const publicTx = (t) => ({
  id: t.id, type: t.type, amount: t.amount, category: t.category, note: t.note,
  date: t.date, status: t.status, createdAt: t.createdAt, cancelledAt: t.cancelledAt || null,
});

// ค่าตั้งต้นสำหรับหน้า LIFF (ไม่ต้อง login)
router.get('/config', wrap(async (req, res) => {
  const s = await getSettings();
  res.json({ liffId: config.liffId, devAuth: config.devAuth, shopName: s.shopName, categories: s.categories });
}));

router.use(requireUser);

router.get('/me', (req, res) => {
  const u = req.user;
  res.json({ id: u.id, displayName: u.displayName, pictureUrl: u.pictureUrl });
});

// 4,5,6) สรุปรายเดือน + ยอดคงเหลือ
router.get('/summary', wrap(async (req, res) => {
  const month = req.query.month || monthTH();
  if (!isMonth(month)) return res.status(400).json({ error: 'เดือนไม่ถูกต้อง' });
  res.json(await tx.monthSummary(req.user.id, month));
}));

router.get('/transactions', wrap(async (req, res) => {
  const month = req.query.month || monthTH();
  const list = await tx.listMonth(req.user.id, month, { includeCancelled: req.query.includeCancelled === '1' });
  res.json(list.map(publicTx));
}));

router.get('/transactions/recent', wrap(async (req, res) => {
  res.json((await tx.recent(req.user.id, 4)).map(publicTx));
}));

// 1,2) บันทึกรายรับ/รายจ่าย
router.post('/transactions', wrap(async (req, res) => {
  res.status(201).json(publicTx(await tx.addTransaction(req.user.id, req.body || {})));
}));

// 7) ยกเลิกรายการ
router.post('/transactions/:id/cancel', wrap(async (req, res) => {
  res.json(publicTx(await tx.cancelTransaction(req.params.id, { userId: req.user.id })));
}));

module.exports = router;
