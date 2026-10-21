// Scheduled function: ยิง /healthz?deep=1 ทุก 4 นาที ให้ฟังก์ชัน api + การเชื่อมต่อ Firestore อุ่นอยู่เสมอ
// (ลด cold start ที่ทำให้บอท LINE ตอบช้าในข้อความแรกหลังเงียบไปนาน)
exports.handler = async () => {
  const base = process.env.URL || process.env.PUBLIC_BASE_URL;
  if (!base) return { statusCode: 200, body: 'no base url' };
  const t = Date.now();
  try {
    const res = await fetch(`${base}/healthz?deep=1`);
    return { statusCode: 200, body: `warm ${res.status} ${Date.now() - t}ms` };
  } catch (e) {
    return { statusCode: 200, body: `warm failed: ${e.message}` };
  }
};
