const { baht, thDateShort } = require('./util');

const C = { in: '#0E5C63', out: '#B8480B', ink: '#1F2933', muted: '#6B7280', line: '#E8E3D6', track: '#EAE5D8', warn: '#E8A317', over: '#C53030', ok: '#3FA98B' };
const text = (t, o = {}) => ({ type: 'text', text: String(t), wrap: true, ...o });

function bar(pct, color) {
  const w = Math.max(3, Math.min(100, pct));
  return { type: 'box', layout: 'vertical', height: '10px', backgroundColor: C.track, cornerRadius: '5px', margin: 'sm', contents: [
    { type: 'box', layout: 'vertical', width: `${w}%`, height: '10px', backgroundColor: color, cornerRadius: '5px', contents: [{ type: 'filler' }] },
  ] };
}
const levelColor = (l) => (l === 'over' ? C.over : l === 'warn' ? C.warn : C.ok);

function budgetBlock(st) {
  if (!st?.enabled || !st.monthly) return [];
  const tail = st.remaining < 0 ? `เกินงบ ${baht(-st.remaining)}` : `เหลือ ${baht(st.remaining)}${st.dailyAllowance ? ` · วันละ ${baht(st.dailyAllowance)}` : ''}`;
  return [
    { type: 'separator', margin: 'lg', color: C.line },
    text(`งบเดือนนี้ ${baht(st.spent)} / ${baht(st.monthly)} (${st.percent}%)`, { size: 'sm', color: C.muted, margin: 'lg' }),
    bar(st.percent, levelColor(st.level)),
    text(tail, { size: 'sm', weight: 'bold', color: levelColor(st.level), margin: 'sm' }),
  ];
}

const btn = (label, msg, style = 'secondary') => ({ type: 'button', style, height: 'sm', action: { type: 'message', label, text: msg } });

/* การ์ดยืนยันการบันทึกรายการ */
function recordCard(t, code, st) {
  const income = t.type === 'income';
  const color = income ? C.in : C.out;
  return {
    type: 'flex', altText: `${income ? 'รายรับ' : 'รายจ่าย'} ${baht(t.amount)} · ${t.category}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: { type: 'box', layout: 'vertical', backgroundColor: color, paddingAll: '14px', contents: [text(`✅ บันทึก${income ? 'รายรับ' : 'รายจ่าย'}แล้ว`, { color: '#ffffff', weight: 'bold' })] },
      body: { type: 'box', layout: 'vertical', contents: [
        text(`${income ? '+' : '−'}${baht(t.amount)}`, { size: 'xxl', weight: 'bold', color }),
        text(`${t.category} · ${thDateShort(t.date)}`, { size: 'sm', color: C.muted, margin: 'sm' }),
        ...(t.note ? [text(`📝 ${t.note}`, { size: 'sm', margin: 'sm' })] : []),
        ...budgetBlock(st),
      ] },
      footer: { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [btn('ยกเลิกรายการนี้', `ยกเลิก ${code}`), btn('ดูสรุป', 'สรุป')] },
    },
  };
}

/* การ์ดยอดคงเหลือ */
function balanceCard(sum, st) {
  return {
    type: 'flex', altText: `เงินคงเหลือ ${baht(sum.balance)}`,
    contents: {
      type: 'bubble', size: 'kilo',
      body: { type: 'box', layout: 'vertical', contents: [
        text('💰 เงินคงเหลือ', { weight: 'bold', color: C.muted }),
        text(`เดือนนี้`, { size: 'xs', color: C.muted, margin: 'md' }),
        text(`${sum.balance < 0 ? '−' : ''}${baht(Math.abs(sum.balance))}`, { size: 'xxl', weight: 'bold', color: sum.balance < 0 ? C.out : C.in }),
        text(`สะสมทั้งหมด ${sum.totalBalance < 0 ? '−' : ''}${baht(Math.abs(sum.totalBalance))}`, { size: 'sm', color: C.muted, margin: 'sm' }),
        { type: 'box', layout: 'horizontal', margin: 'lg', contents: [
          { type: 'box', layout: 'vertical', contents: [text('รายรับ', { size: 'xs', color: C.muted }), text(baht(sum.income), { weight: 'bold', color: C.in })] },
          { type: 'box', layout: 'vertical', contents: [text('รายจ่าย', { size: 'xs', color: C.muted }), text(baht(sum.expense), { weight: 'bold', color: C.out })] },
        ] },
        ...budgetBlock(st),
      ] },
      footer: { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [btn('สรุป', 'สรุป'), btn('งบ', 'งบ')] },
    },
  };
}

/* การ์ดงบประมาณ */
function budgetCard(st) {
  const rows = (st.categories || []).map((c) => ({ type: 'box', layout: 'vertical', margin: 'md', contents: [
    { type: 'box', layout: 'horizontal', contents: [text(c.category, { size: 'sm', flex: 3 }), text(`${baht(c.spent)} / ${baht(c.limit)}`, { size: 'xs', color: C.muted, align: 'end', flex: 4 })] },
    bar(c.percent, levelColor(c.level)),
  ] }));
  return {
    type: 'flex', altText: `งบเดือนนี้ ${baht(st.spent)} / ${baht(st.monthly)}`,
    contents: {
      type: 'bubble', size: 'kilo',
      body: { type: 'box', layout: 'vertical', contents: [
        text('🐷 งบเดือนนี้', { weight: 'bold', color: C.muted }),
        text(baht(st.remaining < 0 ? -st.remaining : st.remaining), { size: 'xxl', weight: 'bold', color: levelColor(st.level), margin: 'md' }),
        text(st.remaining < 0 ? 'เกินงบแล้ว 🍜' : `คงเหลือใช้ได้${st.dailyAllowance ? ` · วันละ ${baht(st.dailyAllowance)} (อีก ${st.daysLeft} วัน)` : ''}`, { size: 'sm', color: C.muted }),
        text(`ใช้ไป ${baht(st.spent)} จาก ${baht(st.monthly)} (${st.percent}%)`, { size: 'xs', color: C.muted, margin: 'lg' }),
        bar(st.percent, levelColor(st.level)),
        ...(rows.length ? [{ type: 'separator', margin: 'lg', color: C.line }, text('แยกตามหมวด', { size: 'xs', color: C.muted, margin: 'lg' }), ...rows] : []),
      ] },
    },
  };
}

module.exports = { recordCard, balanceCard, budgetCard };
