const crypto = require('crypto');
const config = require('./config');
const store = require('./store');

/* ---------------- LINE LIFF user auth ---------------- */
const tokenCache = new Map(); // idToken -> { profile, exp }

async function verifyIdToken(idToken) {
  const hit = tokenCache.get(idToken);
  if (hit && hit.exp > Date.now()) return hit.profile;

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: config.loginChannelId }),
  });
  if (!res.ok) return null;
  const p = await res.json();
  const profile = { userId: p.sub, displayName: p.name || '', pictureUrl: p.picture || '' };
  tokenCache.set(idToken, { profile, exp: Math.min(p.exp * 1000, Date.now() + 10 * 60 * 1000) });
  if (tokenCache.size > 500) tokenCache.clear();
  return profile;
}

/* ข้อมูลแต่ละคนแยกกันด้วย userId ที่ได้จาก token ที่ผ่านการตรวจสอบเท่านั้น */
async function requireUser(req, res, next) {
  try {
    let profile = null;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (bearer) {
      profile = await verifyIdToken(bearer);
    } else if (config.devAuth && req.headers['x-dev-user']) {
      profile = { userId: String(req.headers['x-dev-user']).slice(0, 60), displayName: 'ผู้ใช้ทดสอบ', pictureUrl: '' };
    }
    if (!profile) return res.status(401).json({ error: 'unauthorized' });

    let user = await store.getUser(profile.userId);
    if (!user) {
      user = await store.saveUser(profile.userId, { ...profile, active: true, openingBalance: 0, createdAt: new Date().toISOString() });
    } else if (user.displayName !== profile.displayName || user.pictureUrl !== profile.pictureUrl) {
      user = await store.saveUser(profile.userId, { displayName: profile.displayName || user.displayName, pictureUrl: profile.pictureUrl || user.pictureUrl });
    }
    if (user.active === false) return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

/* ---------------- Admin auth (signed token) ---------------- */
const secret = () => config.sessionSecret || crypto.createHash('sha256').update('dev:' + config.adminPassword).digest('hex');
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const attempts = new Map();
function adminLogin(username, password, ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return { error: 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่', status: 429 };
  const ok = config.adminPassword && safeEq(username, config.adminUsername) && safeEq(password, config.adminPassword);
  if (!ok) {
    a.n += 1; if (a.n >= 5) { a.n = 0; a.until = Date.now() + 5 * 60 * 1000; }
    attempts.set(ip, a);
    return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', status: 401 };
  }
  attempts.delete(ip);
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 12 * 3600 * 1000 })).toString('base64url');
  return { token: `${payload}.${sign(payload)}` };
}

function requireAdmin(req, res, next) {
  const [payload, sig] = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').split('.');
  if (payload && sig && safeEq(sig, sign(payload))) {
    try {
      if (JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now()) return next();
    } catch { /* fallthrough */ }
  }
  res.status(401).json({ error: 'unauthorized' });
}

module.exports = { requireUser, requireAdmin, adminLogin };
