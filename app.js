// ============================================
// KVARTIRA BOSHQARUV - ASOSIY MANTIQ
// ============================================

const State = {
  tenants: [],
  payments: [],
  currentPage: 'dashboard',
  currentMonth: getCurrentMonth(),
};

// ==================== HELPERS ====================
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '0';
  return Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['yanv', 'fev', 'mart', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
  return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function monthName(monthStr) {
  const [y, m] = monthStr.split('-');
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function daysBetween(a, b) {
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalContent').innerHTML = '';
}

// ==================== THEME ====================
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
  updateThemeMeta(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeBtn(next);
  updateThemeMeta(next);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateThemeMeta(theme) {
  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#4f46e5');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      State.currentPage = tab.dataset.page;
      renderPage();
    });
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    showToast('Yangilanmoqda...');
    await loadData();
    await autoGeneratePayments();
    renderPage();
    showToast('Yangilandi ✓', 'success');
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  init();
});

async function init() {
  try {
    await loadData();
    await autoGeneratePayments();
    renderPage();
  } catch (err) {
    console.error(err);
    document.getElementById('appContent').innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Ulanishda xatolik. supabase.js ni tekshiring.</div>
      </div>
    `;
  }
}

// ==================== DATA ====================
async function loadData() {
  const [tRes, pRes] = await Promise.all([
    window.db.from('tenants').select('*').order('created_at', { ascending: false }),
    window.db.from('payments').select('*').order('due_date', { ascending: true }),
  ]);
  if (tRes.error) throw tRes.error;
  if (pRes.error) throw pRes.error;
  State.tenants = tRes.data || [];
  State.payments = pRes.data || [];
}

async function autoGeneratePayments() {
  const month = getCurrentMonth();
  const activeTenants = State.tenants.filter(t => t.status === 'faol');
  const toCreate = [];

  for (const t of activeTenants) {
    const exists = State.payments.find(p => p.tenant_id === t.id && p.month === month);
    if (!exists) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const day = Math.min(t.payment_day, lastDay);
      const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      toCreate.push({
        tenant_id: t.id,
        month,
        amount: t.monthly_rent,
        paid_amount: 0,
        status: 'tolanmadi',
        due_date: dueDate,
      });
    }
  }

  if (toCreate.length > 0) {
    const { error } = await window.db.from('payments').insert(toCreate);
    if (!error) await loadData();
  }
}

// ==================== ROUTER ====================
function renderPage() {
  const titles = {
    dashboard: 'Asosiy',
    tenants: 'Ijarachilar',
    payments: "To'lovlar",
    reminders: 'Eslatmalar',
    settings: 'Sozlamalar',
  };
  document.getElementById('pageTitle').textContent = titles[State.currentPage] || '';

  const content = document.getElementById('appContent');
  content.innerHTML = '';
  content.scrollTop = 0;

  switch (State.currentPage) {
    case 'dashboard': renderDashboard(content); break;
    case 'tenants': renderTenants(content); break;
    case 'payments': renderPayments(content); break;
    case 'reminders': renderReminders(content); break;
    case 'settings': renderSettings(content); break;
  }
}

// ==================== DASHBOARD ====================
function renderDashboard(el) {
  const month = State.currentMonth;
  const activeTenants = State.tenants.filter(t => t.status === 'faol');
  const monthPayments = State.payments.filter(p => p.month === month);
  const paid = monthPayments.filter(p => p.status === 'tolandi');
  const unpaid = monthPayments.filter(p => p.status !== 'tolandi');
  const totalDebt = unpaid.reduce((s, p) => s + (Number(p.amount) - Number(p.paid_amount)), 0);

  const today = new Date();
  today.setHours(0,0,0,0);

  // Yaqin muddatlar — oldinda bo'lganlar (0 dan 7 kungacha)
  const nearDue = unpaid.filter(p => {
    const due = new Date(p.due_date);
    const diff = daysBetween(due, today); // musbat = kelajak, manfiy = o'tgan
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => a.due_date.localeCompare(b.due_date));

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box primary">
        <span class="num">${activeTenants.length}</span>
        <span class="label">Ijarachilar</span>
      </div>
      <div class="stat-box success">
        <span class="num">${paid.length}</span>
        <span class="label">To'ladi</span>
      </div>
      <div class="stat-box danger">
        <span class="num">${unpaid.length}</span>
        <span class="label">Qarzdor</span>
      </div>
    </div>

    <div class="card" style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; border: none;">
      <div style="font-size: 13px; opacity: 0.9;">${monthName(month)} — Qarz yig'indisi</div>
      <div style="font-size: 26px; font-weight: 800; margin-top: 6px;">${formatMoney(totalDebt)} so'm</div>
    </div>

    ${nearDue.length > 0 ? `
      <div class="section-title">🔔 To'lov muddati yaqin</div>
      ${nearDue.map(p => renderNearDueItem(p)).join('')}
    ` : ''}

    <div class="section-title">⚠️ Qarzdorlar</div>
    ${unpaid.length === 0 ? `
      <div class="empty">
        <div class="empty-icon">✅</div>
        <div class="empty-text">Hamma to'langan!</div>
      </div>
    ` : unpaid.map(p => renderDebtorItem(p)).join('')}
  `;

  el.querySelectorAll('[data-payment-id]').forEach(item => {
    item.addEventListener('click', () => openPaymentActions(item.dataset.paymentId));
  });
}

// ✅ TUZATILDI: "6 kun qoldi" (o'tdi emas)
function renderNearDueItem(p) {
  const t = State.tenants.find(x => x.id === p.tenant_id);
  if (!t) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(p.due_date);
  const diff = daysBetween(due, today); // musbat = qolgan kun
  let label;
  if (diff === 0) label = 'Bugun!';
  else if (diff === 1) label = 'Ertaga';
  else label = `${diff} kun qoldi`;
  return `
    <div class="list-item" data-payment-id="${p.id}">
      <div class="item-info">
        <div class="item-title">${esc(t.full_name)}</div>
        <div class="item-sub">${esc(t.room_number || '-')}-xona · ${formatDate(p.due_date)}</div>
      </div>
      <span class="badge warning">${label}</span>
    </div>
  `;
}

// ✅ TUZATILDI: "5 kun kechikish"
function renderDebtorItem(p) {
  const t = State.tenants.find(x => x.id === p.tenant_id);
  if (!t) return '';
  const debt = Number(p.amount) - Number(p.paid_amount);
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(p.due_date);
  const late = daysBetween(today, due); // musbat = kechikish

  let badge, badgeClass;
  if (late > 0) {
    badge = `${late} kun kechikish`;
    badgeClass = late > 30 ? 'danger' : 'danger';
  } else if (late === 0) {
    badge = 'Bugun';
    badgeClass = 'warning';
  } else {
    badge = `${-late} kun qoldi`;
    badgeClass = 'info';
  }

  return `
    <div class="list-item" data-payment-id="${p.id}">
      <div class="item-info">
        <div class="item-title">${esc(t.full_name)}</div>
        <div class="item-sub">${esc(t.room_number || '-')}-xona · ${formatDate(p.due_date)}</div>
      </div>
      <div class="item-right">
        <div class="item-amount">${formatMoney(debt)}</div>
        <span class="badge ${badgeClass}">${badge}</span>
      </div>
    </div>
  `;
}

// ==================== TENANTS ====================
function renderTenants(el) {
  const active = State.tenants.filter(t => t.status === 'faol');
  const gone = State.tenants.filter(t => t.status === 'ketgan');

  el.innerHTML = `
    <div class="search-box">
      <input type="text" id="tenantSearch" placeholder="Ism yoki xona bo'yicha qidirish...">
    </div>

    <div class="section-title">Faol ijarachilar (${active.length})</div>
    <div id="activeList"></div>

    ${gone.length > 0 ? `
      <div class="section-title">Ketganlar (${gone.length})</div>
      <div id="goneList"></div>
    ` : ''}

    <button class="fab" id="addTenantBtn">+</button>
  `;

  renderTenantLists('');

  document.getElementById('addTenantBtn').addEventListener('click', () => openTenantForm());
  document.getElementById('tenantSearch').addEventListener('input', (e) => {
    renderTenantLists(e.target.value.toLowerCase().trim());
  });
}

function renderTenantLists(query) {
  const activeEl = document.getElementById('activeList');
  const goneEl = document.getElementById('goneList');
  const filterFn = (t) => {
    if (!query) return true;
    return (t.full_name || '').toLowerCase().includes(query) ||
           (t.room_number || '').toLowerCase().includes(query) ||
           (t.phone || '').includes(query);
  };

  const active = State.tenants.filter(t => t.status === 'faol' && filterFn(t));
  const gone = State.tenants.filter(t => t.status === 'ketgan' && filterFn(t));

  if (activeEl) {
    activeEl.innerHTML = active.length === 0
      ? `<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">Faol ijarachi yo'q</div></div>`
      : active.map(t => renderTenantItem(t)).join('');
    activeEl.querySelectorAll('[data-tenant-id]').forEach(item => {
      item.addEventListener('click', () => openTenantDetails(item.dataset.tenantId));
    });
  }

  if (goneEl) {
    goneEl.innerHTML = gone.length === 0
      ? `<div class="empty"><div class="empty-text">Yo'q</div></div>`
      : gone.map(t => renderTenantItem(t)).join('');
    goneEl.querySelectorAll('[data-tenant-id]').forEach(item => {
      item.addEventListener('click', () => openTenantDetails(item.dataset.tenantId));
    });
  }
}

function renderTenantItem(t) {
  const isGone = t.status === 'ketgan';
  return `
    <div class="list-item" data-tenant-id="${t.id}" style="${isGone ? 'opacity: 0.65;' : ''}">
      <div class="item-info">
        <div class="item-title">${esc(t.full_name)}</div>
        <div class="item-sub">
          ${esc(t.room_number || '-')}-xona${t.bed_number ? ' · ' + esc(t.bed_number) + '-joy' : ''}
          ${t.phone ? ' · ' + esc(t.phone) : ''}
        </div>
      </div>
      <div class="item-right">
        <div class="item-amount">${formatMoney(t.monthly_rent)}</div>
        <span class="badge ${isGone ? 'gray' : 'success'}">${isGone ? 'Ketgan' : 'Faol'}</span>
      </div>
    </div>
  `;
}

function openTenantForm(tenantId) {
  const t = tenantId ? State.tenants.find(x => x.id === tenantId) : null;
  const isEdit = !!t;
  const today = new Date().toISOString().split('T')[0];

  showModal(`
    <h3>${isEdit ? 'Ijarachini tahrirlash' : 'Yangi ijarachi'}</h3>
    <form id="tenantForm">
      <div class="form-group">
        <label>Ism familiya *</label>
        <input type="text" name="full_name" value="${esc(t?.full_name || '')}" required>
      </div>
      <div class="form-group">
        <label>Telefon</label>
        <input type="tel" name="phone" value="${esc(t?.phone || '')}" placeholder="+998901234567">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Xona raqami</label>
          <input type="text" name="room_number" value="${esc(t?.room_number || '')}">
        </div>
        <div class="form-group">
          <label>Joy/karavot</label>
          <input type="text" name="bed_number" value="${esc(t?.bed_number || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>Kelgan sana *</label>
        <input type="date" name="check_in_date" value="${t?.check_in_date || today}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Oylik to'lov (so'm) *</label>
          <input type="number" name="monthly_rent" value="${t?.monthly_rent || ''}" required min="0" step="1000">
        </div>
        <div class="form-group">
          <label>To'lov kuni *</label>
          <input type="number" name="payment_day" value="${t?.payment_day || 5}" required min="1" max="31">
        </div>
      </div>
      <div class="form-group">
        <label>Izoh</label>
        <textarea name="notes">${esc(t?.notes || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Bekor</button>
        <button type="submit" class="btn btn-primary">Saqlash</button>
      </div>
    </form>
  `);

  document.getElementById('tenantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      full_name: fd.get('full_name').trim(),
      phone: fd.get('phone').trim() || null,
      room_number: fd.get('room_number').trim() || null,
      bed_number: fd.get('bed_number').trim() || null,
      check_in_date: fd.get('check_in_date'),
      monthly_rent: Number(fd.get('monthly_rent')),
      payment_day: Number(fd.get('payment_day')),
      notes: fd.get('notes').trim() || null,
    };

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';

    let error;
    if (isEdit) {
      ({ error } = await window.db.from('tenants').update(payload).eq('id', t.id));
    } else {
      payload.status = 'faol';
      ({ error } = await window.db.from('tenants').insert(payload));
    }

    if (error) {
      showToast('Xatolik: ' + error.message, 'danger');
      btn.disabled = false;
      btn.textContent = 'Saqlash';
      return;
    }

    closeModal();
    showToast(isEdit ? 'Yangilandi ✓' : "Qo'shildi ✓", 'success');
    await loadData();
    await autoGeneratePayments();
    renderPage();
  });
}

function openTenantDetails(tenantId) {
  const t = State.tenants.find(x => x.id === tenantId);
  if (!t) return;

  const tPayments = State.payments
    .filter(p => p.tenant_id === t.id)
    .sort((a, b) => b.month.localeCompare(a.month));

  const totalDebt = tPayments.reduce((s, p) => s + (Number(p.amount) - Number(p.paid_amount)), 0);

  showModal(`
    <h3>${esc(t.full_name)}</h3>
    <div style="background: var(--gray-light); border-radius: 14px; padding: 14px; margin-bottom: 16px;">
      <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">
        ${esc(t.room_number || '-')}-xona${t.bed_number ? ' · ' + esc(t.bed_number) + '-joy' : ''}
      </div>
      ${t.phone ? `<div style="font-size: 14px; margin-bottom: 4px;">📞 ${esc(t.phone)}</div>` : ''}
      <div style="font-size: 14px;">📅 Kelgan: ${formatDate(t.check_in_date)}</div>
      ${t.check_out_date ? `<div style="font-size: 14px;">🚪 Ketgan: ${formatDate(t.check_out_date)}</div>` : ''}
      <div style="font-size: 14px; margin-top: 4px;">💰 Oylik: <b>${formatMoney(t.monthly_rent)} so'm</b></div>
      <div style="font-size: 14px;">📆 To'lov kuni: <b>har oyning ${t.payment_day}-kuni</b></div>
      ${totalDebt > 0 ? `<div style="font-size: 14px; margin-top: 6px; color: var(--danger);">⚠️ Qarz: <b>${formatMoney(totalDebt)} so'm</b></div>` : ''}
      ${t.notes ? `<div style="font-size: 13px; margin-top: 6px; color: var(--text-muted); font-style: italic;">${esc(t.notes)}</div>` : ''}
    </div>

    <div class="section-title" style="margin-top: 0;">To'lovlar tarixi</div>
    ${tPayments.length === 0 ? `
      <div class="empty"><div class="empty-text">To'lov yo'q</div></div>
    ` : tPayments.map(p => `
      <div class="list-item" style="cursor: default;">
        <div class="item-info">
          <div class="item-title">${monthName(p.month)}</div>
          <div class="item-sub">${formatDate(p.due_date)}</div>
        </div>
        <div class="item-right">
          <div class="item-amount">${formatMoney(p.amount)}</div>
          <span class="badge ${p.status === 'tolandi' ? 'success' : p.status === 'qismiy' ? 'warning' : 'danger'}">
            ${p.status === 'tolandi' ? "To'landi" : p.status === 'qismiy' ? 'Qismiy' : "To'lanmadi"}
          </span>
        </div>
      </div>
    `).join('')}

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Yopish</button>
      <button class="btn btn-primary" id="editTenantBtn">Tahrirlash</button>
      ${t.status === 'faol' ? `<button class="btn btn-danger" id="checkoutTenantBtn">Chiqarish</button>` : ''}
    </div>
  `);

  document.getElementById('editTenantBtn').addEventListener('click', () => {
    closeModal();
    openTenantForm(t.id);
  });

  const checkoutBtn = document.getElementById('checkoutTenantBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => openCheckoutForm(t.id));
  }
}

function openCheckoutForm(tenantId) {
  const t = State.tenants.find(x => x.id === tenantId);
  if (!t) return;
  const today = new Date().toISOString().split('T')[0];

  showModal(`
    <h3>Ijarachini chiqarish</h3>
    <p style="text-align:center; color: var(--text-muted); margin-bottom: 16px; font-size: 14px;">
      <b>${esc(t.full_name)}</b>
    </p>
    <div class="form-group">
      <label>Ketgan sana *</label>
      <input type="date" id="checkoutDate" value="${today}" required>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" id="confirmCheckout">Tasdiqlash</button>
    </div>
  `);

  document.getElementById('confirmCheckout').addEventListener('click', async () => {
    const date = document.getElementById('checkoutDate').value;
    if (!date) { showToast('Sanani tanlang', 'danger'); return; }

    const btn = document.getElementById('confirmCheckout');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';

    const { error } = await window.db.from('tenants').update({
      check_out_date: date,
      status: 'ketgan',
    }).eq('id', t.id);

    if (error) {
      showToast('Xatolik: ' + error.message, 'danger');
      btn.disabled = false;
      btn.textContent = 'Tasdiqlash';
      return;
    }

    closeModal();
    showToast('Chiqarildi ✓', 'success');
    await loadData();
    renderPage();
  });
}

// ==================== PAYMENTS ====================
function renderPayments(el) {
  const month = State.currentMonth;
  const monthPayments = State.payments.filter(p => p.month === month);
  const activeTenants = State.tenants.filter(t => t.status === 'faol');

  const rows = activeTenants.map(t => {
    const p = monthPayments.find(x => x.tenant_id === t.id);
    return { tenant: t, payment: p };
  }).sort((a, b) => {
    const da = a.payment?.due_date || '9999-99-99';
    const db = b.payment?.due_date || '9999-99-99';
    return da.localeCompare(db);
  });

  const paidCount = monthPayments.filter(p => p.status === 'tolandi').length;
  const unpaidCount = activeTenants.length - paidCount;
  const totalPaid = monthPayments.reduce((s, p) => s + Number(p.paid_amount), 0);
  const totalExpected = activeTenants.reduce((s, t) => s + Number(t.monthly_rent), 0);

  el.innerHTML = `
    <div class="month-selector">
      <button id="prevMonth">◀</button>
      <span class="month-label">${monthName(month)}</span>
      <button id="nextMonth">▶</button>
    </div>

    <div class="stat-grid">
      <div class="stat-box success">
        <span class="num">${paidCount}</span>
        <span class="label">To'ladi</span>
      </div>
      <div class="stat-box danger">
        <span class="num">${unpaidCount}</span>
        <span class="label">Qarzdor</span>
      </div>
      <div class="stat-box primary">
        <span class="num" style="font-size: 14px;">${formatMoney(totalPaid)}</span>
        <span class="label">Yig'ildi</span>
      </div>
    </div>

    <div class="card">
      <div style="font-size: 13px; color: var(--text-muted);">Kutilgan: <b>${formatMoney(totalExpected)} so'm</b></div>
      <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Yig'ildi: <b style="color: var(--success);">${formatMoney(totalPaid)} so'm</b></div>
    </div>

    <div class="section-title">Ijarachilar (${rows.length})</div>
    <div id="paymentRows"></div>
  `;

  const rowsEl = document.getElementById('paymentRows');
  if (rows.length === 0) {
    rowsEl.innerHTML = `<div class="empty"><div class="empty-icon">💰</div><div class="empty-text">Faol ijarachi yo'q</div></div>`;
  } else {
    rowsEl.innerHTML = rows.map(r => renderPaymentRow(r)).join('');
    rowsEl.querySelectorAll('[data-tenant-id]').forEach(item => {
      item.addEventListener('click', () => {
        const tenantId = item.dataset.tenantId;
        const p = State.payments.find(x => x.tenant_id === tenantId && x.month === State.currentMonth);
        if (p) openPaymentActions(p.id);
        else showToast("To'lov yozuvi topilmadi. Yangilang.", 'danger');
      });
    });
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    State.currentMonth = shiftMonth(State.currentMonth, -1);
    renderPage();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    State.currentMonth = shiftMonth(State.currentMonth, 1);
    renderPage();
  });
}

function renderPaymentRow(r) {
  const t = r.tenant;
  const p = r.payment;

  if (!p) {
    return `
      <div class="list-item" data-tenant-id="${t.id}">
        <div class="item-info">
          <div class="item-title">${esc(t.full_name)}</div>
          <div class="item-sub">${esc(t.room_number || '-')}-xona · yozuv yo'q</div>
        </div>
        <span class="badge gray">—</span>
      </div>
    `;
  }

  const debt = Number(p.amount) - Number(p.paid_amount);
  let badge, badgeClass;
  if (p.status === 'tolandi') {
    badge = "To'landi"; badgeClass = 'success';
  } else if (p.status === 'qismiy') {
    badge = `Qismiy (${formatMoney(debt)} qoldi)`; badgeClass = 'warning';
  } else {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(p.due_date);
    const late = daysBetween(today, due);
    if (late > 0) { badge = `${late} kun kechikish`; badgeClass = 'danger'; }
    else if (late === 0) { badge = 'Bugun'; badgeClass = 'warning'; }
    else { badge = `${-late} kun qoldi`; badgeClass = 'info'; }
  }

  return `
    <div class="list-item" data-tenant-id="${t.id}">
      <div class="item-info">
        <div class="item-title">${esc(t.full_name)}</div>
        <div class="item-sub">${esc(t.room_number || '-')}-xona · ${formatDate(p.due_date)}</div>
      </div>
      <div class="item-right">
        <div class="item-amount">${formatMoney(p.amount)}</div>
        <span class="badge ${badgeClass}">${badge}</span>
      </div>
    </div>
  `;
}

function openPaymentActions(paymentId) {
  const p = State.payments.find(x => x.id === paymentId);
  if (!p) return;
  const t = State.tenants.find(x => x.id === p.tenant_id);
  if (!t) return;

  const debt = Number(p.amount) - Number(p.paid_amount);
  const today = new Date().toISOString().split('T')[0];

  showModal(`
    <h3>${esc(t.full_name)}</h3>
    <div style="background: var(--gray-light); border-radius: 14px; padding: 14px; margin-bottom: 16px; font-size: 14px;">
      <div>📅 Oy: <b>${monthName(p.month)}</b></div>
      <div>💰 Summa: <b>${formatMoney(p.amount)} so'm</b></div>
      <div>✅ To'langan: <b>${formatMoney(p.paid_amount)} so'm</b></div>
      ${debt > 0 ? `<div style="color: var(--danger);">⚠️ Qarz: <b>${formatMoney(debt)} so'm</b></div>` : ''}
      <div>📆 Muddat: <b>${formatDate(p.due_date)}</b></div>
      ${p.paid_date ? `<div>💵 To'langan sana: <b>${formatDate(p.paid_date)}</b></div>` : ''}
    </div>

    <div class="form-group">
      <label>To'lov summasi (so'm)</label>
      <input type="number" id="payAmount" value="${p.paid_amount > 0 ? p.paid_amount : p.amount}" min="0" step="1000">
    </div>

    <div class="form-group">
      <label>To'lov sanasi</label>
      <input type="date" id="payDate" value="${p.paid_date || today}">
    </div>

    <div class="form-group">
      <label>Izoh</label>
      <input type="text" id="payNote" value="${esc(p.notes || '')}" placeholder="Ixtiyoriy">
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Bekor</button>
      <button class="btn btn-warning" id="partialPayBtn">Qismiy</button>
      <button class="btn btn-success" id="fullPayBtn">To'liq</button>
    </div>

    ${p.status === 'tolandi' ? `
      <button class="btn btn-outline btn-block" id="unpayBtn" style="margin-top: 10px; color: var(--danger);">
        To'lovni bekor qilish
      </button>
    ` : ''}
  `);

  document.getElementById('fullPayBtn').addEventListener('click', async () => {
    const btn = document.getElementById('fullPayBtn');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';
    const { error } = await window.db.from('payments').update({
      paid_amount: p.amount,
      status: 'tolandi',
      paid_date: document.getElementById('payDate').value || today,
      notes: document.getElementById('payNote').value.trim() || null,
    }).eq('id', p.id);
    if (error) { showToast('Xatolik: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = "To'liq"; return; }
    closeModal();
    showToast("To'landi ✓", 'success');
    await loadData();
    renderPage();
  });

  document.getElementById('partialPayBtn').addEventListener('click', async () => {
    const amt = Number(document.getElementById('payAmount').value);
    if (!amt || amt <= 0) { showToast('Summani kiriting', 'danger'); return; }
    if (amt >= Number(p.amount)) { showToast("To'liq to'lov uchun boshqa tugmani bosing", 'danger'); return; }
    const btn = document.getElementById('partialPayBtn');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';
    const { error } = await window.db.from('payments').update({
      paid_amount: amt,
      status: 'qismiy',
      paid_date: document.getElementById('payDate').value || today,
      notes: document.getElementById('payNote').value.trim() || null,
    }).eq('id', p.id);
    if (error) { showToast('Xatolik: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = 'Qismiy'; return; }
    closeModal();
    showToast("Qismiy to'lov saqlandi ✓", 'success');
    await loadData();
    renderPage();
  });

  const unpayBtn = document.getElementById('unpayBtn');
  if (unpayBtn) {
    unpayBtn.addEventListener('click', async () => {
      if (!confirm("To'lovni bekor qilishni tasdiqlaysizmi?")) return;
      const { error } = await window.db.from('payments').update({
        paid_amount: 0,
        status: 'tolanmadi',
        paid_date: null,
      }).eq('id', p.id);
      if (error) { showToast('Xatolik: ' + error.message, 'danger'); return; }
      closeModal();
      showToast('Bekor qilindi', 'success');
      await loadData();
      renderPage();
    });
  }
}

// ==================== REMINDERS ====================
function renderReminders(el) {
  const today = new Date(); today.setHours(0,0,0,0);
  const activeTenantIds = State.tenants.filter(t => t.status === 'faol').map(t => t.id);

  const unpaid = State.payments.filter(p =>
    activeTenantIds.includes(p.tenant_id) && p.status !== 'tolandi'
  );

  const overdue = unpaid.filter(p => {
    const due = new Date(p.due_date);
    return daysBetween(today, due) > 0; // musbat = o'tgan
  }).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const near = unpaid.filter(p => {
    const due = new Date(p.due_date);
    const diff = daysBetween(due, today);
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const debtByTenant = {};
  unpaid.forEach(p => {
    const d = Number(p.amount) - Number(p.paid_amount);
    debtByTenant[p.tenant_id] = (debtByTenant[p.tenant_id] || 0) + d;
  });
  const debtors = Object.entries(debtByTenant)
    .map(([id, debt]) => ({ tenant: State.tenants.find(t => t.id === id), debt }))
    .filter(x => x.tenant && x.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  const totalDebt = debtors.reduce((s, d) => s + d.debt, 0);

  el.innerHTML = `
    <div class="card" style="background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; border: none;">
      <div style="font-size: 13px; opacity: 0.9;">Umumiy qarz</div>
      <div style="font-size: 26px; font-weight: 800; margin-top: 6px;">${formatMoney(totalDebt)} so'm</div>
      <div style="font-size: 13px; margin-top: 4px; opacity: 0.9;">${debtors.length} ta qarzdor</div>
    </div>

    ${overdue.length > 0 ? `
      <div class="section-title">🔴 Muddati o'tgan (${overdue.length})</div>
      ${overdue.map(p => renderReminderItem(p, 'danger')).join('')}
    ` : ''}

    ${near.length > 0 ? `
      <div class="section-title">🟡 Yaqin 7 kun (${near.length})</div>
      ${near.map(p => renderReminderItem(p, 'warning')).join('')}
    ` : ''}

    ${debtors.length > 0 ? `
      <div class="section-title">💸 Har ijarachi bo'yicha qarz</div>
      ${debtors.map(d => `
        <div class="list-item" data-tenant-id="${d.tenant.id}">
          <div class="item-info">
            <div class="item-title">${esc(d.tenant.full_name)}</div>
            <div class="item-sub">${esc(d.tenant.room_number || '-')}-xona</div>
          </div>
          <div class="item-right">
            <div class="item-amount" style="color: var(--danger);">${formatMoney(d.debt)}</div>
          </div>
        </div>
      `).join('')}
    ` : ''}

    ${unpaid.length === 0 ? `
      <div class="empty">
        <div class="empty-icon">🎉</div>
        <div class="empty-text">Hamma to'lagan! Qarz yo'q.</div>
      </div>
    ` : ''}
  `;

  el.querySelectorAll('[data-payment-id]').forEach(item => {
    item.addEventListener('click', () => openPaymentActions(item.dataset.paymentId));
  });
  el.querySelectorAll('[data-tenant-id]').forEach(item => {
    item.addEventListener('click', () => openTenantDetails(item.dataset.tenantId));
  });
}

function renderReminderItem(p, cls) {
  const t = State.tenants.find(x => x.id === p.tenant_id);
  if (!t) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(p.due_date);
  const late = daysBetween(today, due);
  let label;
  if (late > 0) label = `${late} kun kechikish`;
  else if (late === 0) label = 'Bugun';
  else label = `${-late} kun qoldi`;
  const debt = Number(p.amount) - Number(p.paid_amount);
  return `
    <div class="list-item" data-payment-id="${p.id}">
      <div class="item-info">
        <div class="item-title">${esc(t.full_name)}</div>
        <div class="item-sub">${monthName(p.month)} · ${formatDate(p.due_date)}</div>
      </div>
      <div class="item-right">
        <div class="item-amount">${formatMoney(debt)}</div>
        <span class="badge ${cls}">${label}</span>
      </div>
    </div>
  `;
}

// ==================== SETTINGS ====================
function renderSettings(el) {
  const active = State.tenants.filter(t => t.status === 'faol').length;
  const gone = State.tenants.filter(t => t.status === 'ketgan').length;
  const totalPayments = State.payments.length;
  const totalCollected = State.payments.reduce((s, p) => s + Number(p.paid_amount), 0);
  const currentTheme = document.documentElement.getAttribute('data-theme');

  el.innerHTML = `
    <div class="card">
      <div class="card-title">🎨 Ko'rinish</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0;">
        <div>
          <div style="font-weight: 700; font-size: 14px;">${currentTheme === 'dark' ? 'Tun rejimi' : 'Kunduz rejimi'}</div>
          <div style="font-size: 12px; color: var(--text-muted);">Ko'zga qulay ko'rinish</div>
        </div>
        <button class="btn btn-outline btn-sm" id="themeBtn2">${currentTheme === 'dark' ? '☀️ Kunduz' : '🌙 Tun'}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📊 Statistika</div>
      <div style="font-size: 14px; line-height: 2;">
        <div>Faol ijarachilar: <b>${active}</b></div>
        <div>Ketganlar: <b>${gone}</b></div>
        <div>Jami to'lov yozuvlari: <b>${totalPayments}</b></div>
        <div>Umumiy yig'ilgan: <b>${formatMoney(totalCollected)} so'm</b></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🔄 Amallar</div>
      <button class="btn btn-outline btn-block" id="reloadAllBtn" style="margin-bottom: 10px;">
        Ma'lumotlarni qayta yuklash
      </button>
      <button class="btn btn-outline btn-block" id="exportBtn">
        JSON sifatida yuklab olish
      </button>
    </div>

    <div style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">
      Kvartira Boshqaruv v1.1<br>
      ${new Date().getFullYear()}
    </div>
  `;

  document.getElementById('themeBtn2').addEventListener('click', () => {
    toggleTheme();
    renderPage();
  });

  document.getElementById('reloadAllBtn').addEventListener('click', async () => {
    showToast('Yuklanmoqda...');
    await loadData();
    await autoGeneratePayments();
    renderPage();
    showToast('Yangilandi ✓', 'success');
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {
      exported_at: new Date().toISOString(),
      tenants: State.tenants,
      payments: State.payments,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvartira-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Yuklab olindi ✓', 'success');
  });
}