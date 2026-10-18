const crypto = require('crypto');

// วันที่ปัจจุบันตามเวลาไทย (YYYY-MM-DD)
const todayTH = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const monthTH = () => todayTH().slice(0, 7);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const newId = () => crypto.randomBytes(8).toString('hex');
const round2 = (n) => Math.round(n * 100) / 100;

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const thMonthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
};
const thDateShort = (d) => {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${THAI_MONTHS_SHORT[m - 1]}`;
};
const baht = (n) => '฿' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

module.exports = { todayTH, monthTH, isDate, isMonth, newId, round2, thMonthLabel, thDateShort, baht, THAI_MONTHS };
