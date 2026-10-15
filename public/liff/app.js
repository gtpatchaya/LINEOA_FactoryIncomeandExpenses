'use strict';
/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const bkk = () => new Date(Date.now() + 7 * 3600e3);
const todayStr = () => bkk().toISOString().slice(0, 10);
const curMonth = () => todayStr().slice(0, 7);
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y + 543}`; };
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return t.toISOString().slice(0, 7); };
const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const baht = (n) => '฿' + num(n);
const signed = (t) => (t.type === 'income' ? '+' : '−') + baht(t.amount);
const dayLabel = (d) => {
  const t = todayStr();
  if (d === t) return 'วันนี้';
  if (d === new Date(Date.parse(t) - 864e5).toISOString().slice(0, 10)) return 'เมื่อวาน';
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MS[m - 1]}`;
};
const fullDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y + 543}`; };

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  upc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 17V7M7.5 11.5L12 7l4.5 4.5"/></svg>',
  downc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v10M7.5 12.5L12 17l4.5-4.5"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/* ---------- state ---------- */
const S = {
  cache: new Map(), cfg: null, tab: 'home', token: null, devUser: null, user: null,
  histMonth: curMonth(), filter: 'all', showCancelled: false,
  sumMonth: curMonth(), sumType: 'expense',
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
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

function renderNav() {
  const nav = $('#nav');
  const items = [['home', 'หน้าหลัก', I.home], ['history', 'ประวัติ', I.clock], ['add', 'เพิ่มรายการ', `<span class="plus">${I.plus}</span>`], ['summary', 'สรุป', I.pie]];
  nav.hidden = false;
  nav.innerHTML = items.map(([k, l, ic]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('');
}
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  if (b.dataset.tab === 'add') S.form = { ...S.form, amount: '', note: '', date: todayStr() };
  go(b.dataset.tab);
});

function txRow(t) {
  const k = t.type === 'income' ? 'in' : 'out';
  const title = t.note || t.category;
  return `<button class="row ${t.status === 'cancelled' ? 'cancelled' : ''}" data-tx="${esc(t.id)}">
    <span class="ico ${k}">${t.type === 'income' ? I.up : I.down}</span>
    <span class="main"><div class="ttl">${esc(title)}</div><div class="meta">${esc(t.category)} · ${esc(dayLabel(t.date))}${t.status === 'cancelled' ? ' · ยกเลิกแล้ว' : ''}</div></span>
    <span class="amt ${k}">${signed(t)}</span></button>`;
}
const monthBar = (id, ym) => `<div class="monthbar"><button data-m="${id}:-1" aria-label="เดือนก่อน">${I.left}</button><b>${monthLabel(ym)}</b><button data-m="${id}:1" ${ym >= curMonth() ? 'disabled' : ''} aria-label="เดือนถัดไป">${I.right}</button></div>`;

/* ---------- pages ---------- */
const view = $('#app');
const loading = () => { view.innerHTML = '<div class="splash">กำลังโหลด…</div>'; };
const fail = (e) => { view.innerHTML = `<div class="err">${esc(e.message)}</div><button class="btn t-in" id="retry">ลองใหม่</button>`; $('#retry').onclick = () => go(S.tab); };

async function pageHome() {
  const [sum, recent] = await Promise.all([api('/summary?month=' + curMonth()), api('/transactions/recent')]);
  const d = bkk();
  view.innerHTML = `
    <p class="eyebrow">วัน${DAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}</p>
    <h1>${esc(S.cfg.shopName)}</h1>
    <div class="hero">
      <div class="lbl">เงินคงเหลือเดือนนี้</div>
      <div class="big ${sum.balance < 0 ? 'neg' : ''}">${sum.balance < 0 ? '−' : ''}${baht(Math.abs(sum.balance))}</div>
      <div class="hero-sub">คงเหลือสะสมทั้งหมด ${sum.totalBalance < 0 ? '−' : ''}${baht(Math.abs(sum.totalBalance))}</div>
      <div class="pair"><div class="tile"><div class="t">รายรับ</div><div class="v">${baht(sum.income)}</div></div><div class="tile"><div class="t">รายจ่าย</div><div class="v">${baht(sum.expense)}</div></div></div>
    </div>
    <div class="actions">
      <button class="act in" data-add="income">${I.upc}บันทึกรายรับ</button>
      <button class="act out" data-add="expense">${I.downc}บันทึกรายจ่าย</button>
    </div>
    <div class="sec-head"><h2>รายการล่าสุด</h2><button class="link" data-tab="history">ดูทั้งหมด</button></div>
    <div class="list">${recent.length ? recent.map(txRow).join('') : '<div class="empty">ยังไม่มีรายการ<br>กดปุ่มด้านบนเพื่อบันทึกรายการแรก</div>'}</div>`;
}

async function pageHistory() {
  const list = await api(`/transactions?month=${S.histMonth}&includeCancelled=1`);
  const shown = list.filter((t) => (S.showCancelled || t.status === 'active') && (S.filter === 'all' || t.type === S.filter));
  const chip = (k, l) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`;
  const hasCancelled = list.some((t) => t.status === 'cancelled');
  view.innerHTML = `
    <div class="page-head"><h1>ประวัติรายการ</h1></div>
    ${monthBar('hist', S.histMonth)}
    <div class="chips">${chip('all', 'ทั้งหมด')}${chip('income', 'รายรับ')}${chip('expense', 'รายจ่าย')}</div>
    <div class="list">${shown.length ? shown.map(txRow).join('') : '<div class="empty">ไม่มีรายการในเดือนนี้</div>'}</div>
    ${hasCancelled ? `<label class="togg"><input type="checkbox" id="showc" ${S.showCancelled ? 'checked' : ''}> แสดงรายการที่ยกเลิกแล้ว</label>` : ''}`;
  const c = $('#showc'); if (c) c.onchange = () => { S.showCancelled = c.checked; pageHistory().catch(fail); };
}

function pageAdd() {
  const f = S.form; const k = f.type === 'income' ? 'in' : 'out';
  const cats = S.cfg.categories[f.type];
  if (!cats.includes(f.category)) f.category = cats[0];
  view.innerHTML = `<div class="t-${k}">
    <div class="page-head"><h1>เพิ่มรายการ</h1><p class="sub">เลือกประเภท แล้วกรอกจำนวนเงิน</p></div>
    <div class="seg"><button class="${f.type === 'expense' ? 'on out' : ''}" data-type="expense">รายจ่าย</button><button class="${f.type === 'income' ? 'on in' : ''}" data-type="income">รายรับ</button></div>
    <label class="f" for="amt">จำนวนเงิน (บาท)</label>
    <div class="amount"><span>฿</span><input id="amt" inputmode="decimal" placeholder="0" autocomplete="off" value="${esc(f.amount)}"></div>
    <label class="f">หมวดหมู่</label>
    <div class="cats">${cats.map((c) => `<button class="cat ${c === f.category ? 'on' : ''}" data-cat="${esc(c)}"><span>${esc(c)}</span>${c === f.category ? I.check : ''}</button>`).join('')}</div>
    <label class="f" for="date">วันที่</label>
    <input class="inp" id="date" type="date" max="${todayStr()}" value="${esc(f.date)}">
    <p class="sub" id="date-th" style="margin:6px 4px 0">${esc(dayLabel(f.date))} · ${esc(fullDate(f.date))}</p>
    <label class="f" for="note">หมายเหตุ (ไม่ใส่ก็ได้)</label>
    <input class="inp" id="note" maxlength="200" placeholder="${f.type === 'income' ? 'เช่น ลูกค้าร้านสยามค้าส่ง' : 'เช่น ซื้อจากร้านประจำ'}" value="${esc(f.note)}">
    <div id="form-err"></div>
    <button class="btn" id="save">${I.check}บันทึกรายการ</button></div>`;
  const amt = $('#amt');
  amt.oninput = () => {
    const raw = amt.value.replace(/[^\d.]/g, '').replace(/(\..*?)\./g, '$1');
    const [i, d] = raw.split('.');
    f.amount = (i ? Number(i).toLocaleString('en-US') : '') + (d !== undefined ? '.' + d.slice(0, 2) : '');
    amt.value = f.amount;
  };
  $('#date').onchange = (e) => { f.date = e.target.value || todayStr(); $('#date-th').textContent = `${dayLabel(f.date)} · ${fullDate(f.date)}`; };
  $('#note').oninput = (e) => { f.note = e.target.value; };
  $('#save').onclick = saveTx;
}

async function saveTx() {
  const f = S.form; const btn = $('#save');
  $('#form-err').innerHTML = '';
  btn.disabled = true;
  try {
    const t = await api('/transactions', { method: 'POST', body: { type: f.type, amount: f.amount.replace(/,/g, ''), category: f.category, date: f.date || todayStr(), note: f.note } });
    S.form = { ...f, amount: '', note: '', date: todayStr() };
    toast(`บันทึก${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${baht(t.amount)} แล้ว`, 'ยกเลิก', async () => {
      try { await api(`/transactions/${t.id}/cancel`, { method: 'POST' }); toast('ยกเลิกรายการแล้ว'); if (S.tab === 'home') go('home'); } catch (e) { toast(e.message); }
    });
    go('home', true);
  } catch (e) {
    $('#form-err').innerHTML = `<div class="err">${esc(e.message)}</div>`;
    btn.disabled = false;
  }
}

async function pageSummary() {
  const s = await api('/summary?month=' + S.sumMonth);
  const k = S.sumType === 'income' ? 'in' : 'out';
  const list = s.byCategory[S.sumType];
  const isCur = S.sumMonth === curMonth();
  view.innerHTML = `
    <div class="page-head"><h1>สรุปรายเดือน</h1></div>
    ${monthBar('sum', S.sumMonth)}
    ${isCur ? `<p class="sub" style="margin:-4px 4px 12px">ข้อมูลถึงวันที่ ${bkk().getUTCDate()}</p>` : ''}
    <div class="hero light">
      <div class="lbl">เงินคงเหลือ</div>
      <div class="big ${s.balance < 0 ? 'neg' : ''}">${s.balance < 0 ? '−' : ''}${baht(Math.abs(s.balance))}</div>
      <div class="pair"><div class="tile in"><div class="t">รายรับ</div><div class="v">${baht(s.income)}</div></div><div class="tile out"><div class="t">รายจ่าย</div><div class="v">${baht(s.expense)}</div></div></div>
    </div>
    <div class="seg sm"><button class="${S.sumType === 'expense' ? 'on out' : ''}" data-sumtype="expense">รายจ่าย</button><button class="${S.sumType === 'income' ? 'on in' : ''}" data-sumtype="income">รายรับ</button></div>
    <div class="sec-title" style="margin-top:0">${S.sumType === 'income' ? 'รายรับ' : 'รายจ่าย'}แบ่งตามหมวด</div>
    <div class="bars t-${k}">${list.length ? list.map((c) => `<div class="bar"><div class="h"><span class="n">${esc(c.category)}</span><span><span class="v">${baht(c.amount)}</span><span class="p">${c.percent}%</span></span></div><div class="tr"><div class="fl" style="width:${Math.max(c.percent, 2)}%"></div></div></div>`).join('') : '<div class="empty">ยังไม่มีข้อมูลในเดือนนี้</div>'}</div>
    <p class="sub" style="text-align:center;margin-top:14px">คงเหลือสะสมทั้งหมด ${s.totalBalance < 0 ? '−' : ''}${baht(Math.abs(s.totalBalance))}</p>`;
}

/* ---------- transaction detail sheet (7: ยกเลิกรายการ) ---------- */
async function openTx(id) {
  const t = S.cache.get(id);
  if (!t) return;
  const k = t.type === 'income' ? 'in' : 'out';
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet">
    <h3>${esc(t.note || t.category)}</h3>
    <div class="big amt ${k}">${signed(t)}</div>
    <div class="kv"><span>ประเภท</span><span>${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</span></div>
    <div class="kv"><span>หมวดหมู่</span><span>${esc(t.category)}</span></div>
    <div class="kv"><span>วันที่</span><span>${esc(fullDate(t.date))}</span></div>
    <div class="kv"><span>หมายเหตุ</span><span>${esc(t.note || '-')}</span></div>
    ${t.status === 'cancelled' ? '<div class="err">รายการนี้ถูกยกเลิกแล้ว</div>' : '<button class="btn ghost" id="cancel-tx">ยกเลิกรายการนี้</button>'}
    <button class="btn" style="--c:var(--teal);margin-top:12px" id="close-sheet">ปิด</button></div>`;
  sheet.hidden = false;
  $('#close-sheet').onclick = closeSheet;
  const c = $('#cancel-tx');
  if (c) c.onclick = () => {
    c.textContent = 'ยืนยันยกเลิกรายการ?'; c.style.cssText = 'background:var(--orange);color:#fff';
    c.onclick = async () => {
      c.disabled = true;
      try { await api(`/transactions/${id}/cancel`, { method: 'POST' }); closeSheet(); toast('ยกเลิกรายการแล้ว'); go(S.tab); }
      catch (e) { closeSheet(); toast(e.message); }
    };
  };
}

/* ---------- routing / events ---------- */
async function go(tab, push) {
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
  const el = e.target.closest('[data-tx],[data-tab],[data-add],[data-filter],[data-m],[data-type],[data-cat],[data-sumtype]');
  if (!el) return;
  const d = el.dataset;
  if (d.tx) return openTx(d.tx);
  if (d.tab) return go(d.tab);
  if (d.add) { S.form.type = d.add; S.form.category = ''; return go('add'); }
  if (d.filter) { S.filter = d.filter; return go('history'); }
  if (d.m) {
    const [id, step] = d.m.split(':');
    if (id === 'hist') S.histMonth = shiftMonth(S.histMonth, +step); else S.sumMonth = shiftMonth(S.sumMonth, +step);
    return go(id === 'hist' ? 'history' : 'summary');
  }
  if (d.type) { S.form.type = d.type; S.form.category = ''; return pageAdd(); }
  if (d.cat) { S.form.category = d.cat; return pageAdd(); }
  if (d.sumtype) { S.sumType = d.sumtype; return go('summary'); }
});

/* ---------- boot ---------- */
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
      return;
    }
    const q = new URLSearchParams(location.search);
    const t = q.get('tab'); const ty = q.get('type');
    if (ty === 'income' || ty === 'expense') S.form.type = ty;
    await go(['home', 'history', 'add', 'summary'].includes(t) ? t : 'home');
  } catch (e) { fail(e); }
})();
