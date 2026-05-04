const API = '';
let currentWeekStart = getMonday(new Date());
let services = [];
let clients = [];
let appointments = [];
let editingApptId = null;

// ── НАВИГАЦИЯ ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'schedule') renderSchedule();
    if (btn.dataset.page === 'clients') loadClients();
    if (btn.dataset.page === 'services') loadServices();
    if (btn.dataset.page === 'todos') loadTodos();
  });
});

// ── УТИЛИТЫ ───────────────────────────────────────────────────────────────
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  return r.json();
}

// ── РАСПИСАНИЕ ────────────────────────────────────────────────────────────
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

document.getElementById('prevWeek').addEventListener('click', () => {
  currentWeekStart = addDays(currentWeekStart, -7);
  renderSchedule();
  renderWeekTodos();
});
document.getElementById('nextWeek').addEventListener('click', () => {
  currentWeekStart = addDays(currentWeekStart, 7);
  renderSchedule();
  renderWeekTodos();
});

async function renderSchedule() {
  const end = addDays(currentWeekStart, 6);
  const label = `${currentWeekStart.getDate()} ${MONTHS_RU[currentWeekStart.getMonth()]} — ${end.getDate()} ${MONTHS_RU[end.getMonth()]}`;
  document.getElementById('weekLabel').textContent = label;

  const data = await api(`/api/appointments?start=${formatDate(currentWeekStart)}&end=${formatDate(end)}`);
  appointments = data;

  const grid = document.getElementById('scheduleGrid');
  grid.innerHTML = '';

  const today = formatDate(new Date());

  // Шапка
  const cornerCell = document.createElement('div');
  cornerCell.className = 'schedule-header';
  grid.appendChild(cornerCell);

  for (let i = 0; i < 7; i++) {
    const d = addDays(currentWeekStart, i);
    const cell = document.createElement('div');
    cell.className = 'schedule-header' + (formatDate(d) === today ? ' today' : '');
    cell.textContent = `${DAYS_RU[i]} ${d.getDate()}`;
    grid.appendChild(cell);
  }

  // Слоты по 30 минут с 9:00 до 20:00
  for (let h = 9; h < 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

      const timeLabel = document.createElement('div');
      timeLabel.className = 'time-label';
      timeLabel.textContent = m === 0 ? time : '';
      grid.appendChild(timeLabel);

      for (let i = 0; i < 7; i++) {
        const d = addDays(currentWeekStart, i);
        const dateStr = formatDate(d);
        const cell = document.createElement('div');
        cell.className = 'slot' + (dateStr === today ? ' today' : '');

        const appt = appointments.find(a => a.date === dateStr && a.time === time);
        if (appt) {
          cell.classList.add('has-appt');
          const chip = document.createElement('div');
          chip.className = 'appt-chip';
          const svcs = safeParseServices(appt.services);
          chip.textContent = `${appt.client_name} — ${svcs.join(', ')}`;
          chip.title = `${appt.client_name}\n${svcs.join(', ')}\n${appt.total_price} ₽`;
          chip.addEventListener('click', e => { e.stopPropagation(); openApptModal(appt); });
          cell.appendChild(chip);
        }

        cell.addEventListener('click', () => {
          if (!appt) openApptModal(null, dateStr, time);
        });
        grid.appendChild(cell);
      }
    }
  }
}

function safeParseServices(s) {
  try { return JSON.parse(s) || []; } catch { return []; }
}

// ── ДЕЛА НА НЕДЕЛЮ (на главной) ───────────────────────────────────────────
async function renderWeekTodos() {
  const grid = document.getElementById('weekTodosGrid');
  grid.innerHTML = '';
  const today = formatDate(new Date());

  for (let i = 0; i < 7; i++) {
    const d = addDays(currentWeekStart, i);
    const dateStr = formatDate(d);
    const isToday = dateStr === today;

    const todos = await api(`/api/todos?date=${dateStr}`);

    const col = document.createElement('div');
    col.className = 'week-todos-col' + (isToday ? ' today-col' : '');

    const dayLabel = document.createElement('div');
    dayLabel.className = 'week-todos-day';
    dayLabel.textContent = `${DAYS_RU[i]} ${d.getDate()}`;
    col.appendChild(dayLabel);

    todos.forEach(t => {
      const item = document.createElement('div');
      item.className = 'week-todo-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!t.done;
      cb.addEventListener('change', async () => {
        await api(`/api/todos/${t.id}`, 'PUT', { done: cb.checked, text: t.text });
        span.classList.toggle('done', cb.checked);
      });
      const span = document.createElement('span');
      span.textContent = t.text;
      if (t.done) span.classList.add('done');
      item.appendChild(cb);
      item.appendChild(span);
      col.appendChild(item);
    });

    // Поле добавить дело
    const addRow = document.createElement('div');
    addRow.className = 'week-todo-add';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'week-todo-input';
    inp.placeholder = '+ дело';
    const btn = document.createElement('button');
    btn.className = 'week-todo-btn';
    btn.textContent = '+';
    const addTodoForDay = async () => {
      const text = inp.value.trim();
      if (!text) return;
      await api('/api/todos', 'POST', { text, date: dateStr });
      inp.value = '';
      renderWeekTodos();
    };
    btn.addEventListener('click', addTodoForDay);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') addTodoForDay(); });
    addRow.appendChild(inp);
    addRow.appendChild(btn);
    col.appendChild(addRow);

    grid.appendChild(col);
  }
}

// ── ЗАПИСЬ ────────────────────────────────────────────────────────────────
document.getElementById('btnAddAppointment').addEventListener('click', () => openApptModal(null));
document.getElementById('btnCancelAppt').addEventListener('click', () => closeModal('modalAppointment'));
document.getElementById('btnSaveAppt').addEventListener('click', saveAppointment);
document.getElementById('btnCopyReminder').addEventListener('click', copyReminder);
document.getElementById('btnSendTelegram').addEventListener('click', sendTelegram);

document.getElementById('apptClientId').addEventListener('change', function () {
  const id = this.value;
  const newFields = document.getElementById('newClientFields');
  if (id) {
    const c = clients.find(c => c.id == id);
    document.getElementById('apptClientName').value = c ? c.name : '';
    document.getElementById('apptClientPhone').value = c ? c.phone : '';
    newFields.style.opacity = '0.5';
  } else {
    document.getElementById('apptClientName').value = '';
    document.getElementById('apptClientPhone').value = '';
    newFields.style.opacity = '1';
  }
});

async function openApptModal(appt, date, time) {
  editingApptId = appt ? appt.id : null;
  await loadServicesData();
  await loadClientsData();

  // Заполнить список клиентов
  const sel = document.getElementById('apptClientId');
  sel.innerHTML = '<option value="">— новый клиент —</option>';
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.phone || '—'})`;
    sel.appendChild(opt);
  });

  // Заполнить услуги
  const container = document.getElementById('apptServices');
  container.innerHTML = '';
  const selectedServices = appt ? safeParseServices(appt.services) : [];
  services.forEach(s => {
    const item = document.createElement('div');
    item.className = 'service-check-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = s.name;
    cb.dataset.price = s.price;
    cb.id = 'svc_' + s.id;
    cb.checked = selectedServices.includes(s.name);
    cb.addEventListener('change', updateTotal);
    const lbl = document.createElement('label');
    lbl.htmlFor = 'svc_' + s.id;
    lbl.textContent = `${s.name} — ${s.price.toLocaleString('ru')} ₽`;
    lbl.style.cursor = 'pointer';
    item.appendChild(cb);
    item.appendChild(lbl);
    container.appendChild(item);
  });

  // Заполнить поля
  if (appt) {
    document.getElementById('apptId').value = appt.id;
    document.getElementById('apptClientId').value = appt.client_id || '';
    document.getElementById('apptClientName').value = appt.client_name || '';
    document.getElementById('apptClientPhone').value = appt.client_phone || '';
    document.getElementById('apptDate').value = appt.date;
    document.getElementById('apptTime').value = appt.time;
    document.getElementById('apptNotes').value = appt.notes || '';
  } else {
    document.getElementById('apptId').value = '';
    document.getElementById('apptClientId').value = '';
    document.getElementById('apptClientName').value = '';
    document.getElementById('apptClientPhone').value = '';
    document.getElementById('apptDate').value = date || formatDate(new Date());
    document.getElementById('apptTime').value = time || '09:00';
    document.getElementById('apptNotes').value = '';
  }

  updateTotal();
  openModal('modalAppointment');
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll('#apptServices input[type=checkbox]:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price) || 0;
  });
  document.getElementById('apptTotal').textContent = total.toLocaleString('ru') + ' ₽';
}

async function saveAppointment() {
  const id = document.getElementById('apptId').value;
  const clientId = document.getElementById('apptClientId').value;
  const clientName = document.getElementById('apptClientName').value.trim();
  const clientPhone = document.getElementById('apptClientPhone').value.trim();
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  const notes = document.getElementById('apptNotes').value.trim();

  const selectedServices = [];
  let total = 0;
  document.querySelectorAll('#apptServices input[type=checkbox]:checked').forEach(cb => {
    selectedServices.push(cb.value);
    total += parseFloat(cb.dataset.price) || 0;
  });

  if (!clientName || !date || !time) { toast('Заполните имя, дату и время'); return; }

  const body = { client_id: clientId || null, client_name: clientName, client_phone: clientPhone, date, time, services: selectedServices, total_price: total, notes };

  if (id) {
    await api(`/api/appointments/${id}`, 'PUT', body);
  } else {
    await api('/api/appointments', 'POST', body);
  }

  closeModal('modalAppointment');
  renderSchedule();
  renderWeekTodos();
  toast('Запись сохранена!');
}

async function copyReminder() {
  const name = document.getElementById('apptClientName').value;
  const time = document.getElementById('apptTime').value;
  const svcs = [];
  document.querySelectorAll('#apptServices input[type=checkbox]:checked').forEach(cb => svcs.push(cb.value));
  const template = localStorage.getItem('reminderTemplate') || 'Здравствуйте, [имя]! Напоминаю о вашей записи завтра в [время] на [услуга]. Жду вас!';
  const data = await api('/api/reminder-text', 'POST', { client_name: name, time, services: svcs, template });
  await navigator.clipboard.writeText(data.text);
  toast('Текст скопирован!');
}

async function sendTelegram() {
  const name = document.getElementById('apptClientName').value;
  const time = document.getElementById('apptTime').value;
  const svcs = [];
  document.querySelectorAll('#apptServices input[type=checkbox]:checked').forEach(cb => svcs.push(cb.value));
  const template = localStorage.getItem('reminderTemplate') || 'Здравствуйте, [имя]! Напоминаю о вашей записи завтра в [время] на [услуга]. Жду вас!';
  const data = await api('/api/reminder-text', 'POST', { client_name: name, time, services: svcs, template });

  const clientId = document.getElementById('apptClientId').value;
  const client = clients.find(c => c.id == clientId);
  const username = client?.telegram_username;

  if (username) {
    const url = `https://t.me/${username.replace('@','')}?text=${encodeURIComponent(data.text)}`;
    window.open(url, '_blank');
  } else {
    await navigator.clipboard.writeText(data.text);
    toast('Telegram не указан — текст скопирован!');
  }
}

// ── ССЫЛКА ────────────────────────────────────────────────────────────────
document.getElementById('btnBookingLink').addEventListener('click', async () => {
  const data = await api('/api/booking-link', 'POST');
  document.getElementById('bookingLink').textContent = data.link;
  openModal('modalLink');
});
document.getElementById('btnCopyLink').addEventListener('click', async () => {
  const link = document.getElementById('bookingLink').textContent;
  await navigator.clipboard.writeText(link);
  toast('Ссылка скопирована!');
});
document.getElementById('btnCloseLink').addEventListener('click', () => closeModal('modalLink'));

// ── КЛИЕНТЫ ───────────────────────────────────────────────────────────────
document.getElementById('btnAddClient').addEventListener('click', () => openClientModal(null));
document.getElementById('btnCancelClient').addEventListener('click', () => closeModal('modalClient'));
document.getElementById('btnSaveClient').addEventListener('click', saveClient);
document.getElementById('clientSearch').addEventListener('input', loadClients);

async function loadClientsData() {
  clients = await api('/api/clients');
}

async function loadClients() {
  const search = document.getElementById('clientSearch').value;
  clients = await api(`/api/clients?search=${encodeURIComponent(search)}`);
  const list = document.getElementById('clientsList');
  list.innerHTML = '';
  clients.forEach(c => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div>
        <div class="client-name">${c.name}</div>
        <div class="client-phone">${c.phone || '—'} ${c.telegram_username ? '· ' + c.telegram_username : ''}</div>
      </div>
      <div class="client-actions">
        <button class="icon-btn" title="Редактировать" onclick="openClientModal(${c.id})">✏️</button>
        <button class="icon-btn" title="Удалить" onclick="deleteClient(${c.id})">🗑️</button>
      </div>`;
    list.appendChild(card);
  });
}

async function openClientModal(id) {
  if (id) {
    const c = clients.find(c => c.id === id);
    document.getElementById('clientId').value = c.id;
    document.getElementById('clientName').value = c.name;
    document.getElementById('clientPhone').value = c.phone || '';
    document.getElementById('clientTelegram').value = c.telegram_username || '';
    document.getElementById('clientNotes').value = c.notes || '';
    // История
    const history = await api(`/api/clients/${id}/history`);
    const hDiv = document.getElementById('clientHistory');
    if (history.length) {
      hDiv.innerHTML = '<h4>История визитов</h4>' + history.map(a =>
        `<div class="history-item">${a.date} ${a.time} — ${safeParseServices(a.services).join(', ')} — ${(a.total_price||0).toLocaleString('ru')} ₽</div>`
      ).join('');
    } else {
      hDiv.innerHTML = '';
    }
  } else {
    document.getElementById('clientId').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientTelegram').value = '';
    document.getElementById('clientNotes').value = '';
    document.getElementById('clientHistory').innerHTML = '';
  }
  openModal('modalClient');
}

async function saveClient() {
  const id = document.getElementById('clientId').value;
  const body = {
    name: document.getElementById('clientName').value.trim(),
    phone: document.getElementById('clientPhone').value.trim(),
    telegram_username: document.getElementById('clientTelegram').value.trim(),
    notes: document.getElementById('clientNotes').value.trim()
  };
  if (!body.name) { toast('Введите имя'); return; }
  if (id) await api(`/api/clients/${id}`, 'PUT', body);
  else await api('/api/clients', 'POST', body);
  closeModal('modalClient');
  loadClients();
  toast('Клиент сохранён!');
}

async function deleteClient(id) {
  if (!confirm('Удалить клиента?')) return;
  await api(`/api/clients/${id}`, 'DELETE');
  loadClients();
  toast('Клиент удалён');
}

// ── УСЛУГИ ────────────────────────────────────────────────────────────────
document.getElementById('btnAddService').addEventListener('click', () => openServiceModal(null));
document.getElementById('btnCancelService').addEventListener('click', () => closeModal('modalService'));
document.getElementById('btnSaveService').addEventListener('click', saveService);

async function loadServicesData() {
  services = await api('/api/services');
}

async function loadServices() {
  await loadServicesData();
  const list = document.getElementById('servicesList');
  list.innerHTML = '';
  services.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <div>
        <div class="service-name">${s.name}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span class="service-price">${s.price.toLocaleString('ru')} ₽</span>
        <button class="icon-btn" onclick="openServiceModal(${s.id})">✏️</button>
        <button class="icon-btn" onclick="deleteService(${s.id})">🗑️</button>
      </div>`;
    list.appendChild(card);
  });
}

function openServiceModal(id) {
  if (id) {
    const s = services.find(s => s.id === id);
    document.getElementById('serviceId').value = s.id;
    document.getElementById('serviceName').value = s.name;
    document.getElementById('servicePrice').value = s.price;
  } else {
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
  }
  openModal('modalService');
}

async function saveService() {
  const id = document.getElementById('serviceId').value;
  const body = {
    name: document.getElementById('serviceName').value.trim(),
    price: parseFloat(document.getElementById('servicePrice').value) || 0,
    duration: 60
  };
  if (!body.name) { toast('Введите название'); return; }
  if (id) await api(`/api/services/${id}`, 'PUT', body);
  else await api('/api/services', 'POST', body);
  closeModal('modalService');
  loadServices();
  toast('Услуга сохранена!');
}

async function deleteService(id) {
  if (!confirm('Удалить услугу?')) return;
  await api(`/api/services/${id}`, 'DELETE');
  loadServices();
  toast('Услуга удалена');
}

// ── ДЕЛА ──────────────────────────────────────────────────────────────────
const todoDateInput = document.getElementById('todoDate');
todoDateInput.value = formatDate(new Date());
todoDateInput.addEventListener('change', loadTodos);

document.getElementById('btnAddTodo').addEventListener('click', addTodo);
document.getElementById('newTodoText').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

async function loadTodos() {
  const date = todoDateInput.value;
  const todos = await api(`/api/todos?date=${date}`);
  const list = document.getElementById('todosList');
  list.innerHTML = '';
  todos.forEach(t => {
    const item = document.createElement('div');
    item.className = 'todo-item';
    item.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo(${t.id}, this.checked, '${t.text.replace(/'/g,"\\'")}')">
      <span class="todo-text ${t.done ? 'done' : ''}">${t.text}</span>
      <button class="todo-delete icon-btn" onclick="deleteTodo(${t.id})">✕</button>`;
    list.appendChild(item);
  });
}

async function addTodo() {
  const text = document.getElementById('newTodoText').value.trim();
  if (!text) return;
  await api('/api/todos', 'POST', { text, date: todoDateInput.value });
  document.getElementById('newTodoText').value = '';
  loadTodos();
}

async function toggleTodo(id, done, text) {
  await api(`/api/todos/${id}`, 'PUT', { done, text });
  loadTodos();
}

async function deleteTodo(id) {
  await api(`/api/todos/${id}`, 'DELETE');
  loadTodos();
}

// ── НАСТРОЙКИ ─────────────────────────────────────────────────────────────
document.getElementById('reminderTemplate').value = localStorage.getItem('reminderTemplate') || 'Здравствуйте, [имя]! Напоминаю о вашей записи завтра в [время] на [услуга]. Жду вас!';
document.getElementById('btnSaveSettings').addEventListener('click', () => {
  localStorage.setItem('reminderTemplate', document.getElementById('reminderTemplate').value);
  toast('Настройки сохранены!');
});

// ── СТАРТ ─────────────────────────────────────────────────────────────────
renderSchedule();
renderWeekTodos();
