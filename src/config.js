require('dotenv').config();

const bool = (v) => String(v || '').toLowerCase() === 'true';

module.exports = {
  port: Number(process.env.PORT) || 3000,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  store: process.env.STORE || (process.env.FIREBASE_PROJECT_ID ? 'firestore' : 'memory'),
  liffId: process.env.LIFF_ID || '',
  loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  devAuth: bool(process.env.DEV_AUTH),
};

// ค่าเริ่มต้นของการตั้งค่า (แก้ไขได้ที่หลังบ้าน)
module.exports.defaultSettings = {
  shopName: 'บัญชีโรงงาน',
  categories: {
    expense: ['วัตถุดิบ', 'ค่าแรง', 'ค่าไฟ-น้ำ', 'ซ่อมเครื่องจักร', 'ค่าขนส่ง', 'อื่นๆ'],
    income: ['ขายสินค้า', 'รับชำระหนี้', 'รายรับอื่นๆ'],
  },
};
