const config = require('./config');
const { newId } = require('./util');

/* ------------------------------------------------------------------ */
/* Memory store (ไว้ทดสอบ / พัฒนา)                                       */
/* ------------------------------------------------------------------ */
function memoryStore() {
  const users = new Map();
  const txs = new Map();
  let settings = null;
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
  return {
    kind: 'memory',
    async getSettings() { return clone(settings); },
    async saveSettings(s) { settings = clone(s); },
    async getUser(id) { return clone(users.get(id)) || null; },
    async saveUser(id, data) { users.set(id, { ...(users.get(id) || {}), ...clone(data), id }); return clone(users.get(id)); },
    async listUsers() { return [...users.values()].map(clone); },
    async addTx(tx) { const id = newId(); txs.set(id, { ...clone(tx), id }); return clone(txs.get(id)); },
    async getTx(id) { return clone(txs.get(id)) || null; },
    async updateTx(id, patch) { txs.set(id, { ...txs.get(id), ...clone(patch) }); return clone(txs.get(id)); },
    async txByUserMonth(uid, ym) { return [...txs.values()].filter((t) => t.userId === uid && t.ym === ym).map(clone); },
    async txByUser(uid) { return [...txs.values()].filter((t) => t.userId === uid).map(clone); },
    async txByMonth(ym) { return [...txs.values()].filter((t) => t.ym === ym).map(clone); },
  };
}

/* ------------------------------------------------------------------ */
/* Firestore store                                                     */
/* ------------------------------------------------------------------ */
function firestoreStore() {
  const admin = require('firebase-admin');
  const opts = {};
  // Firestore emulator (docker compose) ไม่ต้องใช้ credential
  if (process.env.FIRESTORE_EMULATOR_HOST) opts.projectId = config.firebaseProjectId || 'demo-piggy';
  else if (config.serviceAccountJson) opts.credential = admin.credential.cert(JSON.parse(config.serviceAccountJson));
  else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    opts.credential = admin.credential.cert({
      projectId: config.firebaseProjectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else opts.credential = admin.credential.applicationDefault();
  if (config.firebaseProjectId && !opts.projectId) opts.projectId = config.firebaseProjectId;
  admin.initializeApp(opts);
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const docs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return {
    kind: 'firestore',
    async getSettings() { const d = await db.doc('settings/app').get(); return d.exists ? d.data() : null; },
    async saveSettings(s) { await db.doc('settings/app').set(s); },
    async getUser(id) { const d = await db.doc(`users/${id}`).get(); return d.exists ? { ...d.data(), id } : null; },
    async saveUser(id, data) { await db.doc(`users/${id}`).set(data, { merge: true }); return this.getUser(id); },
    async listUsers() { return docs(await db.collection('users').get()); },
    async addTx(tx) { const ref = await db.collection('transactions').add(tx); return { ...tx, id: ref.id }; },
    async getTx(id) { const d = await db.doc(`transactions/${id}`).get(); return d.exists ? { ...d.data(), id } : null; },
    async updateTx(id, patch) { await db.doc(`transactions/${id}`).update(patch); return this.getTx(id); },
    // ใช้ equality อย่างเดียว ไม่ต้องสร้าง composite index
    async txByUserMonth(uid, ym) {
      return docs(await db.collection('transactions').where('userId', '==', uid).where('ym', '==', ym).get());
    },
    async txByUser(uid) { return docs(await db.collection('transactions').where('userId', '==', uid).get()); },
    async txByMonth(ym) { return docs(await db.collection('transactions').where('ym', '==', ym).get()); },
  };
}

// บน serverless (Netlify) memory store ใช้ไม่ได้ เพราะข้อมูลหายทุกครั้งที่ function เริ่มใหม่
if (process.env.NETLIFY && config.store !== 'firestore' && !config.devAuth) {
  throw new Error('บน Netlify ต้องตั้ง STORE=firestore (memory store ใช้ไม่ได้)');
}

module.exports = config.store === 'firestore' ? firestoreStore() : memoryStore();
