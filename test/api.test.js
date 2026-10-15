process.env.STORE = 'memory';
process.env.DEV_AUTH = 'true';
process.env.ADMIN_PASSWORD = 'secret';
process.env.LINE_CHANNEL_SECRET = 'testsecret';
process.env.LIFF_ID = '';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const app = require('../src/server');

let base; let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());

const call = async (path, { user = 'U1', method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Dev-User': user } : {}), ...headers }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('บันทึกรายรับ/รายจ่าย + สรุป + คงเหลือ + ยกเลิก + แยกผู้ใช้', async () => {
  assert.equal((await call('/api/summary', { user: null })).status, 401);
  const e = await call('/api/transactions', { method: 'POST', body: { type: 'expense', amount: '48,000', category: 'อาหาร' } });
  assert.equal(e.status, 201);
  const i = await call('/api/transactions', { method: 'POST', body: { type: 'income', amount: 125000, category: 'เงินเดือน', note: 'บริษัท' } });
  const bad = await call('/api/transactions', { method: 'POST', body: { type: 'income', amount: 1, category: 'อาหาร' } });
  assert.equal(bad.status, 400);
  assert.equal((await call('/api/transactions', { method: 'POST', body: { type: 'expense', amount: -5, category: 'อาหาร' } })).status, 400);

  let s = (await call('/api/summary')).data;
  assert.equal(s.income, 125000); assert.equal(s.expense, 48000); assert.equal(s.balance, 77000);
  assert.equal(s.byCategory.expense[0].percent, 100);

  // ผู้ใช้อื่นต้องไม่เห็น/ยกเลิกข้อมูลของ U1
  assert.equal((await call('/api/summary', { user: 'U2' })).data.income, 0);
  assert.equal((await call(`/api/transactions/${e.data.id}/cancel`, { user: 'U2', method: 'POST' })).status, 404);

  assert.equal((await call(`/api/transactions/${e.data.id}/cancel`, { method: 'POST' })).status, 200);
  assert.equal((await call(`/api/transactions/${e.data.id}/cancel`, { method: 'POST' })).status, 409);
  s = (await call('/api/summary')).data;
  assert.equal(s.expense, 0); assert.equal(s.balance, 125000);
  assert.equal((await call('/api/transactions?includeCancelled=1')).data.length, 2);
  assert.equal((await call('/api/transactions')).data.length, 1);
  void i;
});

const post = async (events) => {
  const raw = JSON.stringify({ events });
  const sig = crypto.createHmac('sha256', 'testsecret').update(raw).digest('base64');
  return fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': sig }, body: raw });
};

test('webhook ตรวจลายเซ็น', async () => {
  const r = await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': 'bad' }, body: '{"events":[]}' });
  assert.equal(r.status, 401);
  assert.equal((await post([])).status, 200);
});

test('webhook คำสั่งข้อความ', async () => {
  const sent = [];
  global.fetch = ((orig) => async (url, opts) => {
    if (String(url).startsWith('https://api.line.me')) { if (!opts.body) return { ok: false }; sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
    return orig(url, opts);
  })(global.fetch);
  require('../src/config').channelAccessToken = 'tok';
  const say = async (t) => { sent.length = 0; await post([{ type: 'message', replyToken: 'r', source: { userId: 'U9' }, message: { type: 'text', text: t } }]); await new Promise((r) => setTimeout(r, 80)); return sent[0]?.messages[0].text; };
  assert.match(await say('รับ 5000 เงินเดือน บริษัท'), /บันทึกรายรับ/);
  assert.match(await say('จ่าย 300 อาหาร ข้าวมันไก่'), /−฿300 · อาหาร/);
  assert.match(await say('-120 ค่าอะไรก็ไม่รู้'), /อื่นๆ/);
  assert.match(await say('ยอด'), /฿4,580/);
  assert.match(await say('สรุป'), /รายจ่าย ฿420/);
  assert.match(await say('ประวัติ'), /รายการล่าสุด/);
  assert.match(await say('ยกเลิก'), /ยกเลิกรายการแล้ว/);
  assert.match(await say('ยอด'), /฿4,700/);
  assert.match(await say('สวัสดี'), /วิธีใช้งาน/);
});

test('หลังบ้าน', async () => {
  assert.equal((await call('/admin/api/users', { user: null })).status, 401);
  assert.equal((await call('/admin/api/login', { user: null, method: 'POST', body: { username: 'admin', password: 'x' } })).status, 401);
  const { data } = await call('/admin/api/login', { user: null, method: 'POST', body: { username: 'admin', password: 'secret' } });
  const h = { Authorization: 'Bearer ' + data.token };
  const users = (await call('/admin/api/users', { user: null, headers: h })).data;
  assert.ok(users.length >= 2);
  assert.equal((await call('/admin/api/users/U1', { user: null, headers: h, method: 'PATCH', body: { openingBalance: 1000, active: false } })).status, 200);
  assert.equal((await call('/api/summary')).status, 403);
  await call('/admin/api/users/U1', { user: null, headers: h, method: 'PATCH', body: { active: true } });
  assert.equal((await call('/api/summary')).data.totalBalance, 126000);
  const st = await call('/admin/api/settings', { user: null, headers: h, method: 'PUT', body: { shopName: 'สมุดทดสอบ', categories: { expense: ['เช่า', 'อื่นๆ'] } } });
  assert.deepEqual(st.data.categories.expense, ['เช่า', 'อื่นๆ']);
  assert.equal((await call('/api/config', { user: null })).data.shopName, 'สมุดทดสอบ');
  const csv = await fetch(base + '/admin/api/export.csv', { headers: h });
  assert.match(await csv.text(), /วันที่/);
});
