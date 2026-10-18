'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const num = (n) => '฿' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const curMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const mlabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y + 543}`; };

let token = sessionStorage.getItem('adm') || '';
let tab = 'overview';
let month = curMonth();

async function api(path, opts = {}) {
  const res = await fetch('/admin/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && path !== '/login') { logout(); throw new Error('เซสชันหมดอายุ'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}
let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2500); }
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

/* ---- auth ---- */
function logout() { token = ''; sessionStorage.removeItem('adm'); show(); }
function show() {
  $('#login').hidden = !!token; $('#shell').hidden = !token;
  if (token) { renderTabs(); load(); }
}
$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target); const err = $('#login-err'); err.hidden = true;
  try {
    const r = await api('/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
    token = r.token; sessionStorage.setItem('adm', token); show();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
};
$('#logout').onclick = logout;

/* ---- tabs ---- */
const TABS = [['overview', 'ภาพรวม'], ['users', 'ผู้ใช้งาน'], ['categories', 'หมวดหมู่'], ['settings', 'ตั้งค่า']];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
}
$('#tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; renderTabs(); load(); } };

const monthPicker = () => `<input type="month" id="mp" value="${month}" max="${curMonth()}" style="width:auto">`;
function bindMonth() { const m = $('#mp'); if (m) m.onchange = () => { month = m.value || curMonth(); load(); }; }

const load = guard(async () => {
  $('#main').innerHTML = '<p class="muted">กำลังโหลด…</p>';
  await ({ overview, users, categories, settings }[tab])();
});

/* ---- overview ---- */
async function overview() {
  const o = await api('/overview?month=' + month);
  const u = await api('/users?month=' + month);
  $('#main').innerHTML = `
    <div class="head"><div><h2>ภาพรวม</h2><span class="muted">${mlabel(month)}</span></div>
      <div class="row2" style="flex:none">${monthPicker()}<button class="btn" id="csv">ดาวน์โหลด CSV</button></div></div>
    <div class="grid">
      <div class="stat in"><div class="l">รายรับรวม</div><div class="v">${num(o.income)}</div></div>
      <div class="stat out"><div class="l">รายจ่ายรวม</div><div class="v">${num(o.expense)}</div></div>
      <div class="stat"><div class="l">คงเหลือ</div><div class="v">${num(o.balance)}</div></div>
      <div class="stat"><div class="l">รายการ (ที่ยกเลิก ${o.cancelled})</div><div class="v">${o.count}</div></div>
      <div class="stat"><div class="l">ผู้ใช้งาน</div><div class="v">${o.activeUsers}<span class="muted" style="font-size:15px"> / ${o.users}</span></div></div>
    </div>
    <div class="cols">
      ${['expense', 'income'].map((k) => `<div class="card"><h3>${k === 'income' ? 'รายรับ' : 'รายจ่าย'}แบ่งตามหมวด</h3>
        ${o.byCategory[k].length ? `<table>${o.byCategory[k].map((c) => `<tr><td>${esc(c.category)}</td><td class="r ${k === 'income' ? 'in' : 'out'}"><b>${num(c.amount)}</b></td><td class="r muted">${c.percent}%</td></tr>`).join('')}</table>` : '<p class="muted">ไม่มีข้อมูล</p>'}</div>`).join('')}
    </div>
    <div class="card"><h3>แยกตามผู้ใช้งาน</h3><div class="tableWrap"><table>
      <tr><th>ผู้ใช้</th><th class="r">รายรับ</th><th class="r">รายจ่าย</th><th class="r">รายการ</th></tr>
      ${u.filter((x) => x.count).map((x) => `<tr><td>${esc(x.nickname || x.displayName || x.id)}</td><td class="r in">${num(x.income)}</td><td class="r out">${num(x.expense)}</td><td class="r">${x.count}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">ไม่มีข้อมูล</td></tr>'}
    </table></div></div>`;
  bindMonth();
  $('#csv').onclick = guard(async () => {
    const res = await fetch('/admin/api/export.csv?month=' + month, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = `transactions-${month}.csv`; a.click();
  });
}

/* ---- users ---- */
async function users() {
  const list = await api('/users?month=' + month);
  $('#main').innerHTML = `
    <div class="head"><div><h2>ผู้ใช้งาน</h2><span class="muted">ข้อมูลของแต่ละคนแยกกัน · ยอดเดือน ${mlabel(month)}</span></div>${monthPicker()}</div>
    <div class="card"><div class="tableWrap"><table>
      <tr><th>ผู้ใช้</th><th>ชื่อเรียก</th><th class="r">รายรับ</th><th class="r">รายจ่าย</th><th>ยอดยกมา (฿)</th><th>สถานะ</th><th></th></tr>
      ${list.map((u) => `<tr data-id="${esc(u.id)}">
        <td>${u.pictureUrl ? `<img class="avatar" src="${esc(u.pictureUrl)}" alt="">` : `<span class="avatar">${esc((u.displayName || '?')[0])}</span>`}${esc(u.displayName || '(ไม่ทราบชื่อ)')}</td>
        <td><input data-f="nickname" value="${esc(u.nickname)}" maxlength="40" style="min-width:110px"></td>
        <td class="r in">${num(u.income)}</td><td class="r out">${num(u.expense)}</td>
        <td><input data-f="openingBalance" type="number" step="0.01" value="${u.openingBalance}" style="min-width:110px"></td>
        <td><button class="badge ${u.active ? 'ok' : 'no'}" data-act="toggle" style="border:0">${u.active ? 'ใช้งาน' : 'ระงับ'}</button></td>
        <td style="white-space:nowrap"><button class="btn sm" data-act="save">บันทึก</button> <button class="btn sm ghost" data-act="view">รายการ</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">ยังไม่มีผู้ใช้งาน — ผู้ใช้จะถูกสร้างอัตโนมัติเมื่อเพิ่มเพื่อน LINE OA หรือเปิดแอป</td></tr>'}
    </table></div></div>`;
  bindMonth();
  $('#main').onclick = guard(async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const tr = b.closest('tr'); const id = tr.dataset.id; const u = list.find((x) => x.id === id);
    if (b.dataset.act === 'save') {
      await api('/users/' + id, { method: 'PATCH', body: { nickname: tr.querySelector('[data-f=nickname]').value, openingBalance: Number(tr.querySelector('[data-f=openingBalance]').value || 0) } });
      toast('บันทึกแล้ว');
    } else if (b.dataset.act === 'toggle') {
      if (u.active && !confirm('ระงับผู้ใช้นี้? จะบันทึกรายการไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง')) return;
      await api('/users/' + id, { method: 'PATCH', body: { active: !u.active } }); load();
    } else if (b.dataset.act === 'view') viewTx(u);
  });
}

async function viewTx(u) {
  const list = await api(`/users/${encodeURIComponent(u.id)}/transactions?month=${month}`);
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `<div class="modal-card"><div class="head"><h3 style="margin:0">รายการของ ${esc(u.nickname || u.displayName || u.id)} · ${mlabel(month)}</h3><button class="btn sm" id="mclose">ปิด</button></div>
    <div class="card tableWrap"><table><tr><th>วันที่</th><th>หมวด</th><th>หมายเหตุ</th><th class="r">จำนวน</th><th></th></tr>
    ${list.map((t) => `<tr style="${t.status === 'cancelled' ? 'opacity:.5;text-decoration:line-through' : ''}"><td>${esc(t.date)}</td><td>${esc(t.category)}</td><td>${esc(t.note)}</td>
      <td class="r ${t.type === 'income' ? 'in' : 'out'}"><b>${t.type === 'income' ? '+' : '−'}${num(t.amount)}</b></td>
      <td>${t.status === 'active' ? `<button class="btn sm ghost" data-cancel="${esc(t.id)}">ยกเลิก</button>` : '<span class="muted">ยกเลิกแล้ว</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">ไม่มีรายการ</td></tr>'}</table></div></div>`;
  $('#mclose').onclick = () => { m.hidden = true; };
  m.onclick = guard(async (e) => {
    if (e.target === m) { m.hidden = true; return; }
    const b = e.target.closest('[data-cancel]'); if (!b || !confirm('ยกเลิกรายการนี้?')) return;
    await api(`/transactions/${b.dataset.cancel}/cancel`, { method: 'POST' });
    toast('ยกเลิกรายการแล้ว'); viewTx(u);
  });
}

/* ---- categories ---- */
async function categories() {
  const s = await api('/settings');
  const draft = { expense: [...s.categories.expense], income: [...s.categories.income] };
  const draw = () => {
    $('#main').innerHTML = `
      <div class="head"><div><h2>หมวดหมู่</h2><span class="muted">ใช้กับหน้า LIFF และคำสั่งใน LINE แชท · รายการเก่าไม่ถูกแก้ไข</span></div><button class="btn" id="save">บันทึก</button></div>
      <div class="cols">${['expense', 'income'].map((k) => `<div class="card" data-k="${k}"><h3 class="${k === 'income' ? 'in' : 'out'}">${k === 'income' ? 'รายรับ' : 'รายจ่าย'}</h3>
        ${draft[k].map((c, i) => `<div class="catrow"><input data-i="${i}" value="${esc(c)}" maxlength="30"><button data-mv="-1:${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-mv="1:${i}" ${i === draft[k].length - 1 ? 'disabled' : ''}>↓</button><button data-del="${i}">✕</button></div>`).join('')}
        <div class="catrow"><input placeholder="เพิ่มหมวดใหม่…" data-new maxlength="30"><button data-add style="width:auto;padding:0 14px">เพิ่ม</button></div></div>`).join('')}</div>`;
    const sync = () => document.querySelectorAll('[data-k]').forEach((card) => { draft[card.dataset.k] = [...card.querySelectorAll('input[data-i]')].map((i) => i.value); });
    $('#main').onclick = (e) => {
      const card = e.target.closest('[data-k]'); const k = card?.dataset.k;
      const b = e.target.closest('button'); if (!b || !k) return;
      sync();
      if (b.dataset.del !== undefined) draft[k].splice(+b.dataset.del, 1);
      else if (b.dataset.mv) { const [d, i] = b.dataset.mv.split(':').map(Number); [draft[k][i], draft[k][i + d]] = [draft[k][i + d], draft[k][i]]; }
      else if (b.hasAttribute('data-add')) { const v = card.querySelector('[data-new]').value.trim(); if (v) draft[k].push(v); }
      else return;
      draw();
    };
    $('#save').onclick = guard(async () => { sync(); await api('/settings', { method: 'PUT', body: { categories: draft } }); toast('บันทึกหมวดหมู่แล้ว'); load(); });
  };
  draw();
}

/* ---- settings ---- */
async function settings() {
  const [s, st] = await Promise.all([api('/settings'), api('/status')]);
  const dot = (ok) => `<span class="${ok ? 'ok-dot' : 'no-dot'}">${ok ? '● พร้อม' : '● ยังไม่ได้ตั้งค่า'}</span>`;
  $('#main').innerHTML = `
    <div class="head"><h2>ตั้งค่า</h2></div>
    <div class="card"><h3>ข้อมูลทั่วไป</h3>
      <label>ชื่อที่แสดงบนหน้าแรกของแอป<input id="shop" value="${esc(s.shopName)}" maxlength="40"></label>
      <button class="btn" id="save">บันทึก</button></div>
    <div class="card"><h3>สถานะการเชื่อมต่อ</h3><dl class="kv">
      <dt>ฐานข้อมูล</dt><dd>${st.store === 'firestore' ? dot(true) + ' Firestore' : '<span class="no-dot">● Memory (ข้อมูลหายเมื่อรีสตาร์ท — ตั้ง STORE=firestore)</span>'}</dd>
      <dt>LIFF</dt><dd>${dot(st.liffConfigured)} ${st.liffUrl ? `<code>${esc(st.liffUrl)}</code>` : ''}</dd>
      <dt>LINE Login Channel</dt><dd>${dot(st.loginChannelConfigured)}</dd>
      <dt>Messaging API</dt><dd>${dot(st.messagingConfigured)}</dd>
      <dt>Webhook URL</dt><dd><code>${esc(st.webhookUrl)}</code></dd>
      <dt>LIFF Endpoint URL</dt><dd><code>${esc(st.liffEndpointUrl)}</code></dd>
      ${st.devAuth ? '<dt>⚠️ DEV_AUTH</dt><dd class="no-dot">เปิดอยู่ — ปิดก่อนใช้งานจริง</dd>' : ''}</dl>
      <p class="muted">ค่าเชื่อมต่อ (LIFF_ID, LINE channel, Firebase) ตั้งในไฟล์ <code>.env</code> ของเซิร์ฟเวอร์</p></div>`;
  $('#save').onclick = guard(async () => { await api('/settings', { method: 'PUT', body: { shopName: $('#shop').value } }); toast('บันทึกแล้ว'); });
}

show();
