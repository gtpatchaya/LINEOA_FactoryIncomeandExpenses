const express = require('express');
const config = require('../config');
const store = require('../store');
const { requireAdmin, adminLogin } = require('../auth');
const { getSettings, saveSettings } = require('../services/settings');
const tx = require('../services/transactions');
const { monthTH, isMonth, round2 } = require('../util');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const r = adminLogin(String(username), String(password), req.ip);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ token: r.token });
});

router.use(requireAdmin);

router.get('/status', wrap(async (req, res) => {
  res.json({
    store: store.kind,
    liffConfigured: !!config.liffId,
    loginChannelConfigured: !!config.loginChannelId,
    messagingConfigured: !!(config.channelSecret && config.channelAccessToken),
    devAuth: config.devAuth,
    webhookUrl: `${config.publicBaseUrl || ''}/webhook`,
    liffEndpointUrl: `${config.publicBaseUrl || ''}/liff/`,
    liffUrl: config.liffId ? `https://liff.line.me/${config.liffId}` : '',
  });
}));

router.get('/settings', wrap(async (req, res) => res.json(await getSettings())));
router.put('/settings', wrap(async (req, res) => res.json(await saveSettings(req.body || {}))));

router.get('/users', wrap(async (req, res) => {
  const ym = isMonth(req.query.month) ? req.query.month : monthTH();
  const [users, monthTx] = await Promise.all([store.listUsers(), store.txByMonth(ym)]);
  const byUser = {};
  for (const t of monthTx) (byUser[t.userId] ||= []).push(t);
  res.json(users.map((u) => {
    const s = tx.summarize(byUser[u.id] || []);
    return {
      id: u.id, displayName: u.displayName, pictureUrl: u.pictureUrl, nickname: u.nickname || '',
      active: u.active !== false, openingBalance: u.openingBalance || 0, createdAt: u.createdAt,
      income: s.income, expense: s.expense, count: s.count,
    };
  }).sort((a, b) => (b.income + b.expense) - (a.income + a.expense)));
}));

router.patch('/users/:id', wrap(async (req, res) => {
  const u = await store.getUser(req.params.id);
  if (!u) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  const patch = {};
  if (typeof req.body.active === 'boolean') patch.active = req.body.active;
  if (req.body.openingBalance !== undefined) {
    const n = Number(req.body.openingBalance);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'ยอดยกมาไม่ถูกต้อง' });
    patch.openingBalance = round2(n);
  }
  if (typeof req.body.nickname === 'string') patch.nickname = req.body.nickname.trim().slice(0, 40);
  await store.saveUser(u.id, patch);
  res.json({ ok: true });
}));

router.get('/users/:id/transactions', wrap(async (req, res) => {
  const ym = isMonth(req.query.month) ? req.query.month : monthTH();
  res.json(await tx.listMonth(req.params.id, ym, { includeCancelled: true }));
}));

router.post('/transactions/:id/cancel', wrap(async (req, res) => {
  res.json(await tx.cancelTransaction(req.params.id, { by: 'admin' }));
}));

// ภาพรวมทั้งระบบรายเดือน
router.get('/overview', wrap(async (req, res) => {
  const ym = isMonth(req.query.month) ? req.query.month : monthTH();
  const [users, monthTx] = await Promise.all([store.listUsers(), store.txByMonth(ym)]);
  const s = tx.summarize(monthTx);
  res.json({
    month: ym, users: users.length, activeUsers: users.filter((u) => u.active !== false).length,
    cancelled: monthTx.filter((t) => t.status === 'cancelled').length, ...s,
  });
}));

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // กัน CSV injection
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/export.csv', wrap(async (req, res) => {
  const ym = isMonth(req.query.month) ? req.query.month : monthTH();
  const [users, list] = await Promise.all([store.listUsers(), store.txByMonth(ym)]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.nickname || u.displayName || u.id]));
  const rows = [['วันที่', 'ผู้บันทึก', 'ประเภท', 'หมวดหมู่', 'จำนวนเงิน', 'หมายเหตุ', 'สถานะ']];
  for (const t of tx.sortTx(list)) {
    rows.push([t.date, names[t.userId] || t.userId, t.type === 'income' ? 'รายรับ' : 'รายจ่าย', t.category, t.amount, t.note, t.status === 'active' ? 'ปกติ' : 'ยกเลิก']);
  }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="transactions-${ym}.csv"` });
  res.send('﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
}));

module.exports = router;
