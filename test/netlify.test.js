process.env.STORE = 'memory';
process.env.DEV_AUTH = 'true';
process.env.ADMIN_PASSWORD = 'secret';
process.env.LINE_CHANNEL_SECRET = 'testsecret';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { handler } = require('../netlify/functions/api');

// จำลอง event ของ Netlify Function (path ผ่านทั้งแบบ redirect เดิมและแบบ /.netlify/functions/api/...)
const invoke = (path, { method = 'GET', body, headers = {} } = {}) => handler({
  httpMethod: method, path, headers: { host: 'x.netlify.app', ...headers },
  rawUrl: 'https://x.netlify.app' + path, rawQuery: '', queryStringParameters: {},
  body: body === undefined ? null : body, isBase64Encoded: false,
}, {});

test('API ผ่าน Netlify Function (รองรับทั้งสอง path)', async () => {
  for (const prefix of ['', '/.netlify/functions/api']) {
    const h = { 'content-type': 'application/json', 'x-dev-user': 'U1' };
    const r = await invoke(prefix + '/api/transactions', { method: 'POST', headers: h, body: JSON.stringify({ type: 'income', amount: 100, category: 'เงินเดือน' }) });
    assert.equal(r.statusCode, 201);
    const s = JSON.parse((await invoke(prefix + '/api/summary', { headers: h })).body);
    assert.ok(s.income >= 100);
  }
  assert.equal((await invoke('/api/summary')).statusCode, 401);
  assert.equal(JSON.parse((await invoke('/healthz')).body).ok, true);
});

test('webhook ตรวจลายเซ็นได้ผ่าน Netlify Function', async () => {
  const raw = JSON.stringify({ events: [] });
  const sig = crypto.createHmac('sha256', 'testsecret').update(raw).digest('base64');
  const ok = await invoke('/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': sig }, body: raw });
  assert.equal(ok.statusCode, 200);
  const bad = await invoke('/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': 'bad' }, body: raw });
  assert.equal(bad.statusCode, 401);
});

test('หลังบ้านล็อกอินผ่าน function', async () => {
  const r = await invoke('/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'secret' }) });
  assert.equal(r.statusCode, 200);
  assert.ok(JSON.parse(r.body).token);
});
