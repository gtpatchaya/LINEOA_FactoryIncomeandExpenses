const path = require('path');
const express = require('express');
const config = require('./config');
const store = require('./store');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  next();
});

// เก็บ raw body ไว้ตรวจลายเซ็น LINE webhook
app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use('/api', require('./routes/api'));
app.use('/admin/api', require('./routes/admin'));
app.use('/webhook', require('./routes/webhook'));

const pub = path.join(__dirname, '..', 'public');
app.use('/liff', express.static(path.join(pub, 'liff')));
app.use('/admin', express.static(path.join(pub, 'admin')));
app.get('/', (_req, res) => res.redirect('/liff/'));
app.get('/healthz', async (req, res, next) => {
  try {
    if (req.query.deep) await store.getSettings(); // แตะ Firestore เพื่ออุ่นการเชื่อมต่อ (ใช้กับ keepwarm)
    res.json({ ok: true, store: store.kind });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'เกิดข้อผิดพลาดของระบบ' });
});

if (require.main === module) {
  if (config.devAuth) console.warn('⚠️  DEV_AUTH เปิดอยู่ — ห้ามใช้บน production');
  if (!config.adminPassword) console.warn('⚠️  ยังไม่ได้ตั้ง ADMIN_PASSWORD — เข้าหลังบ้านไม่ได้');
  app.listen(config.port, () => console.log(`Server on :${config.port} (store=${store.kind})`));
}

module.exports = app;
