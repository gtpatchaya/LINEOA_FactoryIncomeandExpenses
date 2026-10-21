process.env.STORE = 'memory';
process.env.DEV_AUTH = 'true';
process.env.ADMIN_PASSWORD = 'secret';
process.env.LINE_CHANNEL_SECRET = 'testsecret';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { parseMessage } = require('../src/services/parse');
const { defaultSettings } = require('../src/config');
const app = require('../src/server');

const cats = defaultSettings.categories;

test('parse: พิมพ์อิสระ', () => {
  const p = (t) => parseMessage(t, cats);
  assert.deepEqual(p('จ่าย 120 อาหาร ข้าวมันไก่'), { type: 'expense', amount: 120, category: 'อาหาร', note: 'ข้าวมันไก่' });
  assert.deepEqual(p('ข้าวมันไก่ 60'), { type: 'expense', amount: 60, category: 'อาหาร', note: 'ข้าวมันไก่' });
  assert.deepEqual(p('60 กาแฟ'), { type: 'expense', amount: 60, category: 'อาหาร', note: 'กาแฟ' });
  assert.deepEqual(p('+5000 เงินเดือน'), { type: 'income', amount: 5000, category: 'เงินเดือน', note: '' });
  assert.deepEqual(p('ค่าขนม 1,500 บาท'), { type: 'income', amount: 1500, category: 'เงินเดือน', note: 'ค่าขนม' });
  assert.deepEqual(p('bts 44'), { type: 'expense', amount: 44, category: 'เดินทาง', note: 'bts' });
  assert.equal(p('ของแปลกๆ 99').category, 'อื่นๆ');
  assert.equal(p('สวัสดีครับ'), null);
  assert.equal(p('จ่าย 0 อาหาร'), null);
});

let base; let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());
const call = async (path, { user = 'S1', method = 'GET', body } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Dev-User': user }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const add = (user, type, amount, category, date) => call('/api/transactions', { user, method: 'POST', body: { type, amount, category, date } });

test('งบ: ตั้งงบ + แจ้งเตือนข้ามเกณฑ์ 80% / 100% ครั้งเดียว', async () => {
  const set = await call('/api/budget', { method: 'PUT', body: { monthly: 5000, categories: [{ category: 'อาหาร', amount: 1000 }, { category: 'ไม่มีหมวดนี้', amount: 5 }] } });
  assert.equal(set.data.monthly, 5000);
  assert.equal(set.data.categories.length, 1); // หมวดที่ไม่มีจริงถูกตัดออก

  let r = await add('S1', 'expense', 3000, 'ที่พัก');
  assert.deepEqual(r.data.alerts, []);
  r = await add('S1', 'expense', 1200, 'อาหาร'); // รวม 4200 = 84% และหมวดอาหาร 120%
  assert.equal(r.data.alerts.length, 2);
  assert.match(r.data.alerts.map((a) => a.text).join(' '), /เงินใกล้หมดแล้ว/);
  assert.match(r.data.alerts.map((a) => a.text).join(' '), /หมวด "อาหาร" เกินงบ/);
  r = await add('S1', 'expense', 100, 'อาหาร'); // ยังอยู่ระหว่าง 80-100% → ไม่เตือนซ้ำ
  assert.deepEqual(r.data.alerts, []);
  r = await add('S1', 'expense', 900, 'เดินทาง'); // รวม 5200 → เกินงบ
  assert.equal(r.data.alerts.length, 1);
  assert.match(r.data.alerts[0].text, /เกินงบเดือนนี้แล้ว/);
  assert.match(r.data.alerts[0].text, /มาม่า/);
  r = await add('S1', 'expense', 10, 'เดินทาง');
  assert.deepEqual(r.data.alerts, []);

  const s = (await call('/api/summary')).data;
  assert.equal(s.budget.enabled, true);
  assert.equal(s.budget.level, 'over');
  assert.equal(s.budget.remaining, -(5210 - 5000));
  assert.equal(s.budget.categories[0].category, 'อาหาร');
});

test('งบ: เหลือใช้ได้วันละเท่าไร และผู้ใช้อื่นไม่มีงบ', async () => {
  await call('/api/budget', { user: 'S2', method: 'PUT', body: { monthly: 3000 } });
  await add('S2', 'expense', 100, 'อาหาร');
  const b = (await call('/api/summary', { user: 'S2' })).data.budget;
  assert.equal(b.remaining, 2900);
  assert.equal(b.level, 'ok');
  assert.ok(b.daysLeft >= 1 && b.dailyAllowance === Math.floor(2900 / b.daysLeft));
  assert.equal((await call('/api/summary', { user: 'S3' })).data.budget.enabled, false);
  await call('/api/budget', { user: 'S2', method: 'PUT', body: { monthly: 0, categories: [] } });
  assert.equal((await call('/api/summary', { user: 'S2' })).data.budget.enabled, false);
});

test('stats: กราฟรายวัน/เดือน/ปี', async () => {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const ym = today.slice(0, 7); const y = today.slice(0, 4);
  await add('G1', 'income', 1000, 'เงินเดือน', today);
  await add('G1', 'expense', 400, 'อาหาร', today);
  await add('G1', 'expense', 50, 'อาหาร', `${Number(y) - 1}-06-15`);

  const d = (await call(`/api/stats?period=day&anchor=${ym}`, { user: 'G1' })).data;
  assert.ok(d.buckets.length >= 28);
  assert.equal(d.buckets.find((b) => b.key === today).expense, 400);
  assert.equal(d.totals.income, 1000);

  const m = (await call('/api/stats?period=month', { user: 'G1' })).data;
  assert.equal(m.buckets.length, 6);
  assert.equal(m.buckets[5].key, ym);
  assert.equal(m.buckets[5].income, 1000);
  assert.equal(m.totals.countExpense, 1);
  assert.equal(m.totals.avgIncome, Math.round((1000 / 6) * 100) / 100);

  const yr = (await call('/api/stats?period=year', { user: 'G1' })).data;
  assert.equal(yr.buckets.length, 5);
  assert.equal(yr.buckets[3].expense, 50);
  assert.equal(yr.buckets[4].income, 1000);
  assert.equal((await call('/api/stats?period=zzz', { user: 'G1' })).status, 400);
});

test('webhook: ตั้งงบ + เตือนในแชท', async () => {
  const sent = [];
  global.fetch = ((orig) => async (url, opts) => {
    if (String(url).startsWith('https://api.line.me')) { if (!opts.body) return { ok: false }; sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
    return orig(url, opts);
  })(global.fetch);
  require('../src/config').channelAccessToken = 'tok';
  const say = async (t) => {
    sent.length = 0; const raw = JSON.stringify({ events: [{ type: 'message', replyToken: 'r', source: { userId: 'W1' }, message: { type: 'text', text: t } }] });
    const sig = crypto.createHmac('sha256', 'testsecret').update(raw).digest('base64');
    const res = await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': sig }, body: raw });
    assert.equal(res.status, 200);
    return (sent[0]?.messages || []).map((m) => m.text || m.altText).join(' | ');
  };
  assert.match(await say('งบ'), /ยังไม่ได้ตั้งงบ/);
  assert.match(await say('ตั้งงบ 1000'), /ตั้งงบเรียบร้อย/);
  assert.match(await say('งบ อาหาร 500'), /ตั้งงบเรียบร้อย/);
  assert.match(await say('งบ ไม่มีหมวด 5'), /ไม่พบหมวด/);
  assert.doesNotMatch(await say('ข้าวมันไก่ 100'), /เงินใกล้หมด/);
  assert.match(await say('จ่าย 750 เดินทาง'), /เงินใกล้หมดแล้ว/); // รวม 850 = 85%
  assert.match(await say('จ่าย 200 ช้อปปิ้ง'), /เกินงบเดือนนี้แล้ว/);
  assert.match(await say('งบ'), /งบเดือนนี้/);
  assert.match(await say('ปิดงบ'), /ปิดงบเรียบร้อย/);
});
