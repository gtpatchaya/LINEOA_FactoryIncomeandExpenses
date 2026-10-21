'use strict';
/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const PALETTE = ['#F2994A', '#2E9C7F', '#D9534F', '#5B8DEF', '#F2C94C', '#9B6BDF', '#6BC7A5', '#E88EA6'];
const EMOJI = { 'อาหาร': '🍜', 'เดินทาง': '🚌', 'ช้อปปิ้ง': '🛍️', 'ที่พัก': '🏠', 'ค่าน้ำ-ไฟ': '💡', 'อื่นๆ': '🧾', 'เงินเดือน': '💼', 'รายได้เสริม': '✨', 'รายรับอื่นๆ': '🎁' };
const emoji = (c, type) => EMOJI[c] || (type === 'income' ? '💵' : '🏷️');

const bkk = () => new Date(Date.now() + 7 * 3600e3);
const todayStr = () => bkk().toISOString().slice(0, 10);
const curMonth = () => todayStr().slice(0, 7);
const curYear = () => todayStr().slice(0, 4);
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y + 543}`; };
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7); };
const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const baht = (n) => '฿' + num(n);
const money = (n) => (n < 0 ? '−' : '') + baht(Math.abs(n));
const signed = (t) => (t.type === 'income' ? '+' : '−') + baht(t.amount);
const dayLabel = (d) => {
  const t = todayStr();
  if (d === t) return 'วันนี้';
  if (d === new Date(Date.parse(t) - 864e5).toISOString().slice(0, 10)) return 'เมื่อวาน';
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MS[m - 1]}`;
};
const fullDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y + 543}`; };
const weekday = (d) => DAYS[new Date(d + 'T00:00:00Z').getUTCDay()];

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/* ---------- มาสคอตหมูออมสิน (อารมณ์ตามสถานะงบ) ---------- */
function pig(mood = 'happy', cls = 'pigm') {
  const face = {
    happy: '<circle cx="204" cy="284" r="15" fill="#2B2330"/><circle cx="308" cy="284" r="15" fill="#2B2330"/><circle cx="209" cy="278" r="5" fill="#fff"/><circle cx="313" cy="278" r="5" fill="#fff"/><path d="M236 372Q256 388 276 372" stroke="#C85A74" stroke-width="7" stroke-linecap="round" fill="none"/>',
    worried: '<circle cx="204" cy="288" r="15" fill="#2B2330"/><circle cx="308" cy="288" r="15" fill="#2B2330"/><circle cx="209" cy="282" r="5" fill="#fff"/><circle cx="313" cy="282" r="5" fill="#fff"/><path d="M182 256l36-12M330 244l36 12" stroke="#7A3B4B" stroke-width="7" stroke-linecap="round"/><path d="M238 378Q256 366 274 378" stroke="#C85A74" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M372 230q22 28 0 44q-22-16 0-44z" fill="#7FC8F8"/>',
    over: '<path d="M190 270l28 28m0-28l-28 28M294 270l28 28m0-28l-28 28" stroke="#2B2330" stroke-width="9" stroke-linecap="round"/><path d="M236 384Q256 362 276 384" stroke="#C85A74" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M168 316q-10 30 0 40q10-10 0-40z" fill="#7FC8F8"/>',
  }[mood] || '';
  return `<svg class="${cls}" viewBox="60 130 392 340" aria-hidden="true">
  <rect x="158" y="372" width="48" height="64" rx="22" fill="#F59AAF"/><rect x="306" y="372" width="48" height="64" rx="22" fill="#F59AAF"/>
  <ellipse cx="172" cy="204" rx="32" ry="42" transform="rotate(-28 172 204)" fill="#F48AA0"/><ellipse cx="340" cy="204" rx="32" ry="42" transform="rotate(28 340 204)" fill="#F48AA0"/>
  <ellipse cx="256" cy="298" rx="156" ry="120" fill="#F9B4C3"/><path d="M138 268C150 226 190 204 232 200" stroke="#fff" stroke-opacity=".55" stroke-width="12" stroke-linecap="round" fill="none"/>
  <rect x="212" y="184" width="88" height="14" rx="7" fill="#C85A74"/>
  <ellipse cx="166" cy="322" rx="20" ry="12" fill="#F2728F" fill-opacity=".55"/><ellipse cx="346" cy="322" rx="20" ry="12" fill="#F2728F" fill-opacity=".55"/>
  <ellipse cx="256" cy="326" rx="54" ry="38" fill="#F48AA0"/><ellipse cx="238" cy="324" rx="7" ry="11" fill="#C85A74"/><ellipse cx="274" cy="324" rx="7" ry="11" fill="#C85A74"/>
  ${face}</svg>`;
}
const moodOf = (b) => (!b?.enabled || b.level === 'ok' || b.level === 'none' ? 'happy' : b.level === 'warn' ? 'worried' : 'over');

/* ---------- state ---------- */
const S = {
  cache: new Map(), cfg: null, tab: 'home', token: null, devUser: null, me: null,
  histMonth: curMonth(), filter: 'all', showCancelled: false,
  sumTab: 'cat', sumMonth: curMonth(), sumType: 'expense',
  period: 'month', anchor: { day: curMonth(), month: curMonth(), year: curYear() },
  form: { type: 'expense', amount: '', category: '', date: todayStr(), note: '' },
};

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  else if (S.devUser) headers['X-Dev-User'] = S.devUser;
  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401 && window.liff && S.cfg?.liffId) { liff.logout(); liff.login(); return new Promise(() => {}); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  // เก็บรายการที่โหลดไว้ เพื่อเปิดรายละเอียดโดยไม่ยิง API เพิ่ม
  if (Array.isArray(data) && data[0]?.type) data.forEach((t) => S.cache.set(t.id, t));
  return data;
}

/* ---------- ui bits ---------- */
let toastTimer;
function toast(msg, actionLabel, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button id="toast-act">${esc(actionLabel)}</button>` : ''}`;
  el.hidden = false;
  if (actionLabel) $('#toast-act').onclick = () => { el.hidden = true; action(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 7000 : 2500);
}
const closeSheet = () => { $('#sheet').hidden = true; };
const openSheet = (html) => { const s = $('#sheet'); s.innerHTML = `<div class="sheet">${html}</div>`; s.hidden = false; };
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

function renderNav() {
  const items = [['home', 'หน้าหลัก', I.home], ['history', 'ประวัติ', I.clock], ['add', 'เพิ่มรายการ', `<span class="plus">${I.plus}</span>`], ['summary', 'สรุป', I.pie]];
  const nav = $('#nav'); nav.hidden = false;
  nav.innerHTML = items.map(([k, l, ic]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('');
}
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  if (b.dataset.tab === 'add') S.form = { ...S.form, amount: '', note: '', date: todayStr() };
  go(b.dataset.tab);
});

function txRow(t) {
  const k = t.type === 'income' ? 'in' : 'out';
  return `<button class="row ${t.status === 'cancelled' ? 'cancelled' : ''}" data-tx="${esc(t.id)}">
    <span class="ico ${k}">${emoji(t.category, t.type)}</span>
    <span class="main"><div class="ttl">${esc(t.note || t.category)}</div><div class="meta">${esc(t.category)} · ${esc(dayLabel(t.date))}${t.status === 'cancelled' ? ' · ยกเลิกแล้ว' : ''}</div></span>
    <span class="amt ${k}">${signed(t)}</span></button>`;
}
const monthBar = (id, label, canNext) => `<div class="monthbar"><button data-m="${id}:-1" aria-label="ก่อนหน้า">${I.left}</button><b>${esc(label)}</b><button data-m="${id}:1" ${canNext ? '' : 'disabled'} aria-label="ถัดไป">${I.right}</button></div>`;
const view = $('#app');
const loading = () => { view.innerHTML = '<div class="splash">กำลังโหลด…</div>'; };
const fail = (e) => { view.innerHTML = `<div class="err">${esc(e.message)}</div><button class="btn" id="retry">ลองใหม่</button>`; $('#retry').onclick = () => go(S.tab); };

/* ---------- วงแหวนงบ ---------- */
function ring(pct, level) {
  const r = 42; const c = 2 * Math.PI * r; const p = Math.min(100, pct);
  const col = level === 'over' ? 'var(--out)' : level === 'warn' ? 'var(--warn)' : 'var(--in)';
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--track)" stroke-width="11"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}"/></svg><b>${pct}%</b></div>`;
}
function budgetCard(b) {
  if (!b?.enabled || !b.monthly) {
    return `<button class="card cta" data-act="budget">${pig('happy')}<div><b>ตั้งงบเดือนนี้ 🎯</b><span>กันเงินหมดก่อนสิ้นเดือน จะได้ไม่ต้องกินมาม่า 🍜</span></div></button>`;
  }
  const left = b.remaining < 0 ? `เกินงบ ${baht(-b.remaining)}` : `เหลือใช้ได้ ${baht(b.remaining)}`;
  const sub = b.remaining < 0 ? 'ถึงเวลามาม่าแล้ว 🍜' : b.dailyAllowance ? `วันละ ${baht(b.dailyAllowance)} · อีก ${b.daysLeft} วัน` : 'ใช้ไปไม่เกินงบ เยี่ยมมาก!';
  return `<button class="card budget lvl-${b.level}" data-act="budget">${ring(b.percent, b.level)}
    <div class="bi"><div class="b-t">งบเดือนนี้</div><div class="b-left">${left}</div><div class="b-sub">${sub}</div><div class="b-sub">ใช้ไป ${baht(b.spent)} / ${baht(b.monthly)}</div></div>${pig(moodOf(b))}</button>`;
}

/* ---------- หน้าหลัก ---------- */
async function pageHome() {
  const [sum, recent] = await Promise.all([api('/summary?month=' + curMonth()), api('/transactions/recent')]);
  const d = bkk(); const name = S.me?.displayName || '';
  view.innerHTML = `
    <div class="top"><div><div class="hi">วัน${DAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}</div>
      <div class="name">${name ? 'สวัสดี ' + esc(name.split(' ')[0]) : esc(S.cfg.shopName)} 👋</div></div>${pig(moodOf(sum.budget))}</div>
    <div class="hero">
      <div class="lbl">เงินคงเหลือเดือนนี้</div>
      <div class="big ${sum.balance < 0 ? 'neg' : ''}">${money(sum.balance)}</div>
      <div class="acc">คงเหลือสะสมทั้งหมด ${money(sum.totalBalance)}</div>
      <div class="pair"><div class="tile"><div class="t">รายรับ</div><div class="v">${baht(sum.income)}</div></div><div class="tile"><div class="t">รายจ่าย</div><div class="v">${baht(sum.expense)}</div></div></div>
    </div>
    ${budgetCard(sum.budget)}
    <div class="actions">
      <button class="act in" data-add="income"><i>${I.up}</i>บันทึกรายรับ</button>
      <button class="act out" data-add="expense"><i>${I.down}</i>บันทึกรายจ่าย</button>
    </div>
    <div class="sec-head"><h2>รายการล่าสุด</h2><button class="link" data-tab="history">ดูทั้งหมด</button></div>
    <div class="list">${recent.length ? recent.map(txRow).join('') : '<div class="empty">ยังไม่มีรายการ 🐷<br>กดปุ่มด้านบน หรือพิมพ์ในแชท เช่น "ข้าวมันไก่ 60"</div>'}</div>`;
}

/* ---------- ประวัติ ---------- */
async function pageHistory() {
  const list = await api(`/transactions?month=${S.histMonth}&includeCancelled=1`);
  const shown = list.filter((t) => (S.showCancelled || t.status === 'active') && (S.filter === 'all' || t.type === S.filter));
  const chip = (k, l) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`;
  const groups = []; 
  for (const t of shown) { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); }
  const body = groups.map((g) => {
    const out = g.items.filter((t) => t.status === 'active' && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return `<div class="dayh"><span>${esc(dayLabel(g.date))} · วัน${weekday(g.date)}</span><span>${out ? 'จ่าย ' + baht(out) : ''}</span></div>${g.items.map(txRow).join('')}`;
  }).join('');
  view.innerHTML = `
    <div class="page-head"><h1>ประวัติรายการ</h1></div>
    ${monthBar('hist', monthLabel(S.histMonth), S.histMonth < curMonth())}
    <div class="chips">${chip('all', 'ทั้งหมด')}${chip('income', 'รายรับ')}${chip('expense', 'รายจ่าย')}</div>
    <div class="list">${shown.length ? body : '<div class="empty">ไม่มีรายการในเดือนนี้</div>'}</div>
    ${list.some((t) => t.status === 'cancelled') ? `<label class="togg"><input type="checkbox" id="showc" ${S.showCancelled ? 'checked' : ''}> แสดงรายการที่ยกเลิกแล้ว</label>` : ''}`;
  const c = $('#showc'); if (c) c.onchange = () => { S.showCancelled = c.checked; pageHistory().catch(fail); };
}

/* ---------- เพิ่มรายการ ---------- */
function pageAdd() {
  const f = S.form; const k = f.type === 'income' ? 'in' : 'out';
  const cats = S.cfg.categories[f.type];
  if (!cats.includes(f.category)) f.category = cats[0];
  view.innerHTML = `<div class="t-${k}">
    <div class="page-head"><h1>เพิ่มรายการ</h1><p class="sub">เลือกประเภท แล้วกรอกจำนวนเงิน — หรือพิมพ์ในแชทได้เลย เช่น "ข้าวมันไก่ 60"</p></div>
    <div class="seg type"><button class="${f.type === 'expense' ? 'on out' : ''}" data-type="expense">รายจ่าย</button><button class="${f.type === 'income' ? 'on in' : ''}" data-type="income">รายรับ</button></div>
    <label class="f" for="amt">จำนวนเงิน (บาท)</label>
    <div class="amount"><span>฿</span><input id="amt" inputmode="decimal" placeholder="0" autocomplete="off" value="${esc(f.amount)}"></div>
    <div class="quick">${[20, 50, 100, 500, 1000].map((n) => `<button data-plus="${n}">+${n}</button>`).join('')}<button data-plus="0">ล้าง</button></div>
    <label class="f">หมวดหมู่</label>
    <div class="cats">${cats.map((c) => `<button class="cat ${c === f.category ? 'on' : ''}" data-cat="${esc(c)}"><span class="e">${emoji(c, f.type)}</span><span>${esc(c)}</span></button>`).join('')}</div>
    <label class="f" for="date">วันที่</label>
    <input class="inp" id="date" type="date" max="${todayStr()}" value="${esc(f.date)}">
    <p class="sub" id="date-th" style="margin:6px 4px 0">${esc(dayLabel(f.date))} · ${esc(fullDate(f.date))}</p>
    <label class="f" for="note">หมายเหตุ (ไม่ใส่ก็ได้)</label>
    <input class="inp" id="note" maxlength="200" placeholder="${f.type === 'income' ? 'เช่น เงินเดือนเดือนนี้' : 'เช่น ข้าวมันไก่ + น้ำเปล่า'}" value="${esc(f.note)}">
    <div id="form-err"></div>
    <button class="btn" id="save">${I.check}บันทึกรายการ</button></div>`;
  const amt = $('#amt');
  const fmt = () => {
    const raw = amt.value.replace(/[^\d.]/g, '').replace(/(\..*?)\./g, '$1');
    const [i, d] = raw.split('.');
    f.amount = (i ? Number(i).toLocaleString('en-US') : '') + (d !== undefined ? '.' + d.slice(0, 2) : '');
    amt.value = f.amount;
  };
  amt.oninput = fmt;
  document.querySelectorAll('[data-plus]').forEach((b) => { b.onclick = () => { const n = Number(b.dataset.plus); amt.value = n ? String((Number(f.amount.replace(/,/g, '')) || 0) + n) : ''; fmt(); }; });
  $('#date').onchange = (e) => { f.date = e.target.value || todayStr(); $('#date-th').textContent = `${dayLabel(f.date)} · ${fullDate(f.date)}`; };
  $('#note').oninput = (e) => { f.note = e.target.value; };
  $('#save').onclick = saveTx;
}

function showAlerts(alerts, txId) {
  const over = alerts.some((a) => a.level === 'over');
  openSheet(`<div class="alertbox">${pig(over ? 'over' : 'worried', 'pigbig')}<h3>${over ? 'เกินงบแล้วนะ! 🍜' : 'เงินใกล้หมดแล้ว!'}</h3>
    <p>${esc(alerts.map((a) => a.text).join('\n\n'))}</p>
    <button class="btn" style="--c:var(--teal)" id="close-sheet">รับทราบ</button>
    <button class="btn soft" id="undo-tx">ยกเลิกรายการที่เพิ่งบันทึก</button></div>`);
  $('#close-sheet').onclick = closeSheet;
  $('#undo-tx').onclick = async () => {
    try { await api(`/transactions/${txId}/cancel`, { method: 'POST' }); closeSheet(); toast('ยกเลิกรายการแล้ว'); go('home'); } catch (e) { toast(e.message); }
  };
}

async function saveTx() {
  const f = S.form; const btn = $('#save');
  $('#form-err').innerHTML = ''; btn.disabled = true;
  try {
    const t = await api('/transactions', { method: 'POST', body: { type: f.type, amount: f.amount.replace(/,/g, ''), category: f.category, date: f.date || todayStr(), note: f.note } });
    S.form = { ...f, amount: '', note: '', date: todayStr() };
    if (!t.alerts?.length) {
      toast(`บันทึก${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${baht(t.amount)} แล้ว`, 'ยกเลิก', async () => {
        try { await api(`/transactions/${t.id}/cancel`, { method: 'POST' }); toast('ยกเลิกรายการแล้ว'); if (S.tab === 'home') go('home'); } catch (e) { toast(e.message); }
      });
    }
    await go('home');
    if (t.alerts?.length) setTimeout(() => showAlerts(t.alerts, t.id), 350);
  } catch (e) {
    $('#form-err').innerHTML = `<div class="err">${esc(e.message)}</div>`; btn.disabled = false;
  }
}

/* ---------- สรุป: ตามหมวดหมู่ (โดนัท) ---------- */
function donut(list, total) {
  const r = 80; const c = 2 * Math.PI * r; let acc = 0;
  const segs = list.map((x, i) => {
    const len = Math.max(0, (x.amount / total) * c - (list.length > 1 ? 2 : 0));
    const s = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="34" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}"/>`;
    acc += (x.amount / total) * c; return s;
  }).join('');
  return `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--track)" stroke-width="34"/>${segs}</svg>`;
}
async function summaryCategory() {
  const s = await api('/summary?month=' + S.sumMonth);
  const list = s.byCategory[S.sumType]; const total = S.sumType === 'income' ? s.income : s.expense;
  const b = s.budget;
  return `
    ${monthBar('sum', monthLabel(S.sumMonth), S.sumMonth < curMonth())}
    <div class="seg type"><button class="${S.sumType === 'expense' ? 'on out' : ''}" data-sumtype="expense">รายจ่าย</button><button class="${S.sumType === 'income' ? 'on in' : ''}" data-sumtype="income">รายรับ</button></div>
    <div class="card">${total ? `<div class="donutwrap">${donut(list, total)}<div class="mid"><small>รวม${S.sumType === 'income' ? 'รายรับ' : 'รายจ่าย'}</small><b>${baht(total)}</b></div></div>
      <div class="legend">${list.map((x, i) => `<div class="lg"><div class="h"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="n">${emoji(x.category, S.sumType)} ${esc(x.category)}</span><span class="v">${baht(x.amount)}</span><span class="p">${x.percent}%</span></div><div class="tr"><div class="fl" style="width:${Math.max(x.percent, 2)}%;background:${PALETTE[i % PALETTE.length]}"></div></div></div>`).join('')}</div>`
      : '<div class="empty">ยังไม่มีข้อมูลในเดือนนี้</div>'}</div>
    <div class="stat2"><div class="s in"><div class="t">รายรับ</div><div class="v">${baht(s.income)}</div></div><div class="s out"><div class="t">รายจ่าย</div><div class="v">${baht(s.expense)}</div></div></div>
    ${b.enabled && S.sumMonth === curMonth() ? `<div style="margin-top:14px">${budgetCard(b)}</div>` : ''}
    <p class="rangenote">คงเหลือเดือนนี้ ${money(s.balance)} · สะสมทั้งหมด ${money(s.totalBalance)}</p>`;
}

/* ---------- สรุป: ภาพรวม (กราฟแท่ง วัน/เดือน/ปี) ---------- */
function niceMax(v) {
  const step = v / 4; const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const pick = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= step) || step;
  return pick * 4;
}
function barChart(buckets, period) {
  const W = 340; const H = 220; const L = 50; const R = 6; const T = 10; const B = 40;
  const max = niceMax(Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense])));
  const pw = W - L - R; const ph = H - T - B; const slot = pw / buckets.length;
  const bw = period === 'day' ? Math.max(2, slot * 0.38) : Math.min(15, slot * 0.34);
  const y = (v) => T + ph - (v / max) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${i ? '#DCE7E2' : '#B9C9C2'}" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
  }
  let bars = '';
  buckets.forEach((b, i) => {
    const cx = L + slot * i + slot / 2;
    bars += `<rect x="${cx - bw - 0.5}" y="${y(b.income)}" width="${bw}" height="${Math.max(0, T + ph - y(b.income))}" rx="2" fill="var(--in-bar)"/><rect x="${cx + 0.5}" y="${y(b.expense)}" width="${bw}" height="${Math.max(0, T + ph - y(b.expense))}" rx="2" fill="var(--out-bar)"/>`;
    const show = period !== 'day' || i === 0 || (i + 1) % 5 === 0;
    if (show) { const [a, c2] = b.label.split('\n'); bars += `<text x="${cx}" y="${H - B + 16}" text-anchor="middle">${esc(a)}</text>${c2 ? `<text x="${cx}" y="${H - B + 28}" text-anchor="middle">${esc(c2)}</text>` : ''}`; }
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}${bars}</svg>`;
}
async function summaryOverview() {
  const p = S.period; const a = S.anchor[p];
  const s = await api(`/stats?period=${p}&anchor=${a}`);
  const canNext = p === 'year' ? a < curYear() : a < curMonth();
  const t = s.totals;
  return `
    <div class="seg"><button class="${p === 'day' ? 'on' : ''}" data-period="day">รายวัน</button><button class="${p === 'month' ? 'on' : ''}" data-period="month">รายเดือน</button><button class="${p === 'year' ? 'on' : ''}" data-period="year">รายปี</button></div>
    ${monthBar('per', s.range, canNext)}
    <div class="card" style="padding:14px 10px 10px">${barChart(s.buckets, p)}
      <div class="legend2"><span><i style="background:var(--in-bar)"></i>เงินเข้า</span><span><i style="background:var(--out-bar)"></i>เงินออก</span></div></div>
    <div class="stat2">
      <div class="s in"><div class="t">รวมเงินเข้า (บาท)</div><div class="v">${num(t.income)}</div><div class="r"><span>รายการ</span><b>${t.countIncome}</b></div><div class="r"><span>${s.avgLabel}</span><b>${num(t.avgIncome)}</b></div></div>
      <div class="s out"><div class="t">รวมเงินออก (บาท)</div><div class="v">${num(t.expense)}</div><div class="r"><span>รายการ</span><b>${t.countExpense}</b></div><div class="r"><span>${s.avgLabel}</span><b>${num(t.avgExpense)}</b></div></div>
    </div>
    <p class="rangenote">สรุปเงินเข้า - เงินออก (${esc(s.range)})</p>`;
}

async function pageSummary() {
  const inner = S.sumTab === 'cat' ? await summaryCategory() : await summaryOverview();
  view.innerHTML = `<div class="page-head"><h1>สรุป</h1></div>
    <div class="seg pill"><button class="${S.sumTab === 'cat' ? 'on' : ''}" data-sumtab="cat">ตามหมวดหมู่</button><button class="${S.sumTab === 'over' ? 'on' : ''}" data-sumtab="over">ภาพรวม</button></div>${inner}`;
}

/* ---------- ตั้งงบ ---------- */
async function openBudget() {
  const b = await api('/budget');
  const limits = Object.fromEntries(b.categories.map((c) => [c.category, c.amount]));
  openSheet(`<h3>🎯 ตั้งงบรายเดือน</h3><p class="sub">ใส่วงเงินที่ใช้จ่ายได้ต่อเดือน (เช่น เงินเดือน/ค่าขนม) ระบบจะเตือนเมื่อใช้ถึง 80% และเมื่อเกินงบ</p>
    <label class="f" for="bm">งบใช้จ่ายต่อเดือน (บาท)</label>
    <div class="amount" style="--c:var(--teal)"><span>฿</span><input id="bm" inputmode="numeric" placeholder="0" value="${b.monthly || ''}"></div>
    <div class="quick">${[3000, 5000, 8000, 10000, 15000].map((n) => `<button data-bpreset="${n}">${num(n)}</button>`).join('')}</div>
    <label class="f">งบแยกหมวด (ไม่ใส่ก็ได้)</label>
    ${b.expenseCategories.map((c) => `<div class="bcat"><span>${emoji(c, 'expense')} ${esc(c)}</span><input data-bcat="${esc(c)}" inputmode="numeric" placeholder="ไม่จำกัด" value="${limits[c] || ''}"></div>`).join('')}
    <div id="b-err"></div>
    <button class="btn" style="--c:var(--teal)" id="b-save">${I.check}บันทึกงบ</button>
    <button class="btn soft" id="b-off">ปิดงบ</button>`);
  document.querySelectorAll('[data-bpreset]').forEach((x) => { x.onclick = () => { $('#bm').value = x.dataset.bpreset; }; });
  const send = async (body, msg) => {
    try { await api('/budget', { method: 'PUT', body }); closeSheet(); toast(msg); go(S.tab); }
    catch (e) { $('#b-err').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  $('#b-save').onclick = () => send({
    monthly: Number($('#bm').value.replace(/,/g, '')) || 0,
    categories: [...document.querySelectorAll('[data-bcat]')].map((i) => ({ category: i.dataset.bcat, amount: Number(i.value.replace(/,/g, '')) || 0 })).filter((c) => c.amount > 0),
  }, 'บันทึกงบแล้ว 🎯');
  $('#b-off').onclick = () => send({ monthly: 0, categories: [] }, 'ปิดงบแล้ว');
}

/* ---------- รายละเอียดรายการ / ยกเลิก (ฟังก์ชัน 7) ---------- */
function openTx(id) {
  const t = S.cache.get(id); if (!t) return;
  const k = t.type === 'income' ? 'in' : 'out';
  openSheet(`<h3>${emoji(t.category, t.type)} ${esc(t.note || t.category)}</h3>
    <div class="big amt ${k}">${signed(t)}</div>
    <div class="kv"><span>ประเภท</span><span>${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</span></div>
    <div class="kv"><span>หมวดหมู่</span><span>${esc(t.category)}</span></div>
    <div class="kv"><span>วันที่</span><span>${esc(fullDate(t.date))}</span></div>
    <div class="kv"><span>หมายเหตุ</span><span>${esc(t.note || '-')}</span></div>
    ${t.status === 'cancelled' ? '<div class="err">รายการนี้ถูกยกเลิกแล้ว</div>' : '<button class="btn ghost" id="cancel-tx">ยกเลิกรายการนี้</button>'}
    <button class="btn" style="--c:var(--teal);margin-top:12px" id="close-sheet">ปิด</button>`);
  $('#close-sheet').onclick = closeSheet;
  const c = $('#cancel-tx');
  if (c) c.onclick = () => {
    c.textContent = 'ยืนยันยกเลิกรายการ?'; c.style.cssText = 'background:var(--out);color:#fff';
    c.onclick = async () => {
      c.disabled = true;
      try { await api(`/transactions/${id}/cancel`, { method: 'POST' }); closeSheet(); toast('ยกเลิกรายการแล้ว'); go(S.tab); }
      catch (e) { closeSheet(); toast(e.message); }
    };
  };
}

/* ---------- routing / events ---------- */
async function go(tab) {
  S.tab = tab; renderNav(); closeSheet();
  window.scrollTo(0, 0);
  if (tab === 'add') return pageAdd();
  loading();
  try {
    S.cache = new Map();
    if (tab === 'home') await pageHome();
    if (tab === 'history') await pageHistory();
    if (tab === 'summary') await pageSummary();
  } catch (e) { fail(e); }
}

view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-tx],[data-tab],[data-add],[data-filter],[data-m],[data-type],[data-cat],[data-sumtype],[data-sumtab],[data-period],[data-act]');
  if (!el) return;
  const d = el.dataset;
  if (d.tx) return openTx(d.tx);
  if (d.tab) return go(d.tab);
  if (d.act === 'budget') return openBudget().catch((x) => toast(x.message));
  if (d.add) { S.form.type = d.add; S.form.category = ''; return go('add'); }
  if (d.filter) { S.filter = d.filter; return go('history'); }
  if (d.m) {
    const [id, step] = d.m.split(':'); const n = +step;
    if (id === 'hist') S.histMonth = shiftMonth(S.histMonth, n);
    else if (id === 'sum') S.sumMonth = shiftMonth(S.sumMonth, n);
    else if (S.period === 'year') S.anchor.year = String(Number(S.anchor.year) + n);
    else S.anchor[S.period] = shiftMonth(S.anchor[S.period], n);
    return go(id === 'hist' ? 'history' : 'summary');
  }
  if (d.type) { S.form.type = d.type; S.form.category = ''; return pageAdd(); }
  if (d.cat) { S.form.category = d.cat; return pageAdd(); }
  if (d.sumtype) { S.sumType = d.sumtype; return go('summary'); }
  if (d.sumtab) { S.sumTab = d.sumtab; return go('summary'); }
  if (d.period) { S.period = d.period; return go('summary'); }
});

/* ---------- boot ---------- */
const introStart = Date.now();
// แสดงโลโก้อย่างน้อย 0.9 วินาที แล้วค่อยเฟดออกหลังโหลดข้อมูลหน้าแรกเสร็จ
function hideIntro() {
  const el = $('#intro'); if (!el) return;
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 600); }, Math.max(0, 900 - (Date.now() - introStart)));
}
(async function boot() {
  try {
    S.cfg = await (await fetch('/api/config')).json();
    document.title = S.cfg.shopName;
    if (S.cfg.liffId && window.liff) {
      await liff.init({ liffId: S.cfg.liffId });
      if (!liff.isLoggedIn()) { liff.login(); return; }
      S.token = liff.getIDToken();
    } else if (S.cfg.devAuth) {
      S.devUser = localStorage.getItem('devUser') || 'dev-' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('devUser', S.devUser);
    } else {
      view.innerHTML = '<div class="err">ยังไม่ได้ตั้งค่า LIFF_ID ที่เซิร์ฟเวอร์</div>';
      hideIntro();
      return;
    }
    S.me = await api('/me').catch(() => null);
    const q = new URLSearchParams(location.search);
    const t = q.get('tab'); const ty = q.get('type');
    if (ty === 'income' || ty === 'expense') S.form.type = ty;
    await go(['home', 'history', 'add', 'summary'].includes(t) ? t : 'home');
    hideIntro();
  } catch (e) { fail(e); hideIntro(); }
})();
