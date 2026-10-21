const store = require('../store');
const { getSettings } = require('./settings');
const { todayTH, isDate, isMonth, round2 } = require('../util');
const { summarize } = require('./summary');
const { status: budgetStatus } = require('./budget-status');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* 1 + 2) บันทึกรายรับ / รายจ่าย */
async function addTransaction(userId, input, source = 'liff') {
  const type = input.type;
  if (type !== 'income' && type !== 'expense') throw httpError(400, 'ประเภทรายการไม่ถูกต้อง');

  const amount = round2(Number(String(input.amount).replace(/,/g, '')));
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'กรุณากรอกจำนวนเงินให้ถูกต้อง');
  if (amount > 999999999) throw httpError(400, 'จำนวนเงินสูงเกินไป');

  const settings = await getSettings();
  const cats = settings.categories[type];
  const category = String(input.category || '').trim();
  if (!cats.includes(category)) throw httpError(400, 'กรุณาเลือกหมวดหมู่');

  const date = input.date || todayTH();
  if (!isDate(date)) throw httpError(400, 'วันที่ไม่ถูกต้อง');

  return store.addTx({
    userId, type, amount, category,
    note: String(input.note || '').trim().slice(0, 200),
    date, ym: date.slice(0, 7),
    status: 'active', source,
    createdAt: new Date().toISOString(),
  });
}

/* 7) ยกเลิกรายการ (soft delete เพื่อเก็บประวัติ) */
async function cancelTransaction(id, { userId = null, by = 'user' } = {}) {
  const tx = await store.getTx(id);
  // ผู้ใช้ยกเลิกได้เฉพาะรายการของตัวเอง (userId = null เฉพาะแอดมิน)
  if (!tx || (userId && tx.userId !== userId)) throw httpError(404, 'ไม่พบรายการ');
  if (tx.status === 'cancelled') throw httpError(409, 'รายการนี้ถูกยกเลิกไปแล้ว');
  return store.updateTx(id, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: by });
}

const sortTx = (list) => list.sort((a, b) => (b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt));

async function listMonth(userId, ym, { includeCancelled = false } = {}) {
  if (!isMonth(ym)) throw httpError(400, 'เดือนไม่ถูกต้อง');
  const list = await store.txByUserMonth(userId, ym);
  return sortTx(includeCancelled ? list : list.filter((t) => t.status === 'active'));
}

/* 4 + 5 + 6) สรุปรายเดือน + ยอดคงเหลือ (เดือนนี้ และสะสมทั้งหมด) */
async function monthSummary(userId, ym) {
  const [list, all, user] = await Promise.all([store.txByUserMonth(userId, ym), store.txByUser(userId), store.getUser(userId)]);
  const month = summarize(list);
  const total = summarize(all);
  const opening = Number(user?.openingBalance) || 0;
  return { month: ym, ...month, totalBalance: round2(opening + total.balance), openingBalance: opening, budget: budgetStatus(user, month, ym) };
}

async function recent(userId, limit = 5) {
  const all = await store.txByUser(userId);
  return sortTx(all.filter((t) => t.status === 'active')).slice(0, limit);
}

module.exports = { addTransaction, cancelTransaction, listMonth, monthSummary, summarize, recent, sortTx, httpError };
