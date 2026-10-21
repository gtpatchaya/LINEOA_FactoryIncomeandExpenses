/* แปลงข้อความแชทเป็นรายการ: "จ่าย 120 อาหาร", "ข้าวมันไก่ 60", "60 กาแฟ", "+25000 เงินเดือน" */

// คำสำคัญ → ชื่อหมวดมาตรฐาน (ใช้เมื่อหมวดนั้นมีอยู่ในการตั้งค่าของผู้ใช้)
const KEYWORDS = {
  expense: {
    'อาหาร': ['ข้าว', 'กิน', 'อาหาร', 'กาแฟ', 'ชา', 'ชานม', 'ขนม', 'มาม่า', 'ส้มตำ', 'หมูกระทะ', 'บุฟเฟ่', 'เซเว่น', '7-11', 'ก๋วยเตี๋ยว', 'น้ำหวาน', 'ผลไม้', 'ตลาด', 'ข้าวมันไก่', 'ร้านอาหาร', 'ค่าอาหาร', 'เครื่องดื่ม'],
    'เดินทาง': ['รถ', 'bts', 'mrt', 'แท็กซี่', 'วิน', 'น้ำมัน', 'grab', 'bolt', 'รถเมล์', 'มอไซ', 'เรือ', 'ทางด่วน', 'ค่าเดินทาง', 'ตั๋ว', 'จอดรถ'],
    'ช้อปปิ้ง': ['เสื้อ', 'รองเท้า', 'ช้อป', 'shopee', 'lazada', 'ของใช้', 'เครื่องสำอาง', 'กางเกง', 'กระเป๋า', 'ซื้อของ'],
    'ที่พัก': ['ค่าเช่า', 'หอ', 'ค่าห้อง', 'เช่า', 'ที่พัก', 'คอนโด'],
    'ค่าน้ำ-ไฟ': ['ค่าไฟ', 'ค่าน้ำ', 'ค่าเน็ต', 'อินเทอร์เน็ต', 'ค่าโทร', 'เติมเงิน', 'ค่าเน็ตมือถือ', 'ไฟฟ้า', 'ประปา'],
  },
  income: {
    'เงินเดือน': ['เงินเดือน', 'ค่าขนม', 'เบี้ยเลี้ยง', 'ทุน', 'ค่าแรง', 'เงินพ่อแม่', 'เงินแม่', 'เงินพ่อ'],
    'รายได้เสริม': ['ฟรีแลนซ์', 'ขาย', 'งานเสริม', 'พาร์ทไทม์', 'part-time', 'โบนัส', 'ได้เงิน', 'ค่าจ้าง', 'ทิป'],
  },
};

const AMT = '฿?\\s*(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(?:บาท|฿)?';
const EXPLICIT = new RegExp(`^(รายรับ|รายจ่าย|รับ|จ่าย|\\+|-|−)\\s*${AMT}\\s*(.*)$`, 's');
const AMOUNT_FIRST = new RegExp(`^${AMT}\\s+(.+)$`, 's');
const AMOUNT_LAST = new RegExp(`^(.+?)\\s*${AMT}$`, 's');

function guessCategory(type, text, cats) {
  const t = text.toLowerCase();
  const exact = cats.find((c) => t.startsWith(c.toLowerCase()) || t.includes(c.toLowerCase()));
  if (exact) return exact;
  for (const [cat, words] of Object.entries(KEYWORDS[type])) {
    if (cats.includes(cat) && words.some((w) => t.includes(w.toLowerCase()))) return cat;
  }
  return null;
}

function inferType(text, categories) {
  const t = text.toLowerCase();
  if (categories.income.some((c) => t.includes(c.toLowerCase()))) return 'income';
  for (const words of Object.values(KEYWORDS.income)) if (words.some((w) => t.includes(w.toLowerCase()))) return 'income';
  return 'expense';
}

function parseMessage(raw, categories) {
  const msg = raw.trim().replace(/\s+/g, ' ');
  if (!msg || msg.length > 80) return null;
  let type; let amount; let rest;

  let m = msg.match(EXPLICIT);
  if (m) {
    type = ['รับ', 'รายรับ', '+'].includes(m[1]) ? 'income' : 'expense'; amount = m[2]; rest = m[3].trim();
  } else if ((m = msg.match(AMOUNT_FIRST))) {
    amount = m[1]; rest = m[2].trim();
  } else if ((m = msg.match(AMOUNT_LAST))) {
    rest = m[1].trim(); amount = m[2];
  } else return null;

  const value = Number(amount.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (!type) type = inferType(rest, categories);

  const cats = categories[type];
  const first = rest.split(' ')[0] || '';
  let category = first ? cats.find((c) => c === first || c.startsWith(first)) : null;
  let note = category ? rest.slice(first.length).trim() : rest;
  if (!category) category = guessCategory(type, rest, cats);
  if (!category) category = cats.find((c) => c.startsWith('อื่น') || c.includes('อื่นๆ')) || cats[cats.length - 1];
  return { type, amount: value, category, note };
}

module.exports = { parseMessage };
