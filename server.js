require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── КЛИЕНТЫ ───────────────────────────────────────────────────────────────

app.get('/api/clients', (req, res) => {
  const search = req.query.search || '';
  const clients = db.prepare(`
    SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ? ORDER BY name
  `).all(`%${search}%`, `%${search}%`);
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { name, phone, telegram_username, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO clients (name, phone, telegram_username, notes) VALUES (?, ?, ?, ?)'
  ).run(name, phone, telegram_username, notes);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/clients/:id', (req, res) => {
  const { name, phone, telegram_username, notes } = req.body;
  db.prepare(
    'UPDATE clients SET name=?, phone=?, telegram_username=?, notes=? WHERE id=?'
  ).run(name, phone, telegram_username, notes, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/clients/:id/history', (req, res) => {
  const history = db.prepare(
    'SELECT * FROM appointments WHERE client_id=? ORDER BY date DESC, time DESC'
  ).all(req.params.id);
  res.json(history);
});

// ─── УСЛУГИ ────────────────────────────────────────────────────────────────

app.get('/api/services', (req, res) => {
  res.json(db.prepare('SELECT * FROM services ORDER BY name').all());
});

app.post('/api/services', (req, res) => {
  const { name, price, duration } = req.body;
  const result = db.prepare(
    'INSERT INTO services (name, price, duration) VALUES (?, ?, ?)'
  ).run(name, price, duration || 60);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/services/:id', (req, res) => {
  const { name, price, duration } = req.body;
  db.prepare('UPDATE services SET name=?, price=?, duration=? WHERE id=?')
    .run(name, price, duration, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/services/:id', (req, res) => {
  db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ЗАПИСИ ────────────────────────────────────────────────────────────────

app.get('/api/appointments', (req, res) => {
  const { start, end } = req.query;
  let query = 'SELECT * FROM appointments WHERE status != "cancelled"';
  const params = [];
  if (start && end) {
    query += ' AND date >= ? AND date <= ?';
    params.push(start, end);
  }
  query += ' ORDER BY date, time';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/appointments', (req, res) => {
  const { client_id, client_name, client_phone, date, time, services, total_price, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO appointments (client_id, client_name, client_phone, date, time, services, total_price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, client_name, client_phone, date, time, JSON.stringify(services), total_price, notes);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/appointments/:id', (req, res) => {
  const { client_id, client_name, client_phone, date, time, services, total_price, notes, status } = req.body;
  db.prepare(`
    UPDATE appointments SET client_id=?, client_name=?, client_phone=?, date=?, time=?,
    services=?, total_price=?, notes=?, status=? WHERE id=?
  `).run(client_id, client_name, client_phone, date, time, JSON.stringify(services), total_price, notes, status || 'active', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/appointments/:id', (req, res) => {
  db.prepare('UPDATE appointments SET status="cancelled" WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ССЫЛКА НА БРОНИРОВАНИЕ ────────────────────────────────────────────────

app.post('/api/booking-link', (req, res) => {
  const token = uuidv4();
  res.json({ link: `http://localhost:${process.env.PORT || 3000}/booking/${token}` });
});

app.get('/booking/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking.html'));
});

app.get('/api/available-slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.json([]);

  const booked = db.prepare(
    'SELECT time FROM appointments WHERE date=? AND status="active"'
  ).all(date).map(r => r.time);

  const slots = [];
  for (let h = 9; h < 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      if (!booked.includes(time)) slots.push(time);
    }
  }
  res.json(slots);
});

app.post('/api/book', (req, res) => {
  const { date, time, client_name, client_phone } = req.body;
  const result = db.prepare(`
    INSERT INTO appointments (client_name, client_phone, date, time, services, total_price, status)
    VALUES (?, ?, ?, ?, '[]', 0, 'pending')
  `).run(client_name, client_phone, date, time);
  res.json({ ok: true, id: result.lastInsertRowid });
});

// ─── ДЕЛА (TO-DO) ──────────────────────────────────────────────────────────

app.get('/api/todos', (req, res) => {
  const { date } = req.query;
  const todos = date
    ? db.prepare('SELECT * FROM todos WHERE date=? ORDER BY created_at').all(date)
    : db.prepare('SELECT * FROM todos ORDER BY date, created_at').all();
  res.json(todos);
});

app.post('/api/todos', (req, res) => {
  const { text, date } = req.body;
  const result = db.prepare('INSERT INTO todos (text, date) VALUES (?, ?)').run(text, date);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/todos/:id', (req, res) => {
  const { done, text } = req.body;
  db.prepare('UPDATE todos SET done=?, text=? WHERE id=?').run(done ? 1 : 0, text, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/todos/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── НАПОМИНАНИЕ — ТЕКСТ ───────────────────────────────────────────────────

app.post('/api/reminder-text', (req, res) => {
  const { client_name, time, services, template } = req.body;
  const serviceList = Array.isArray(services) ? services.join(', ') : services;
  const text = (template || 'Здравствуйте, [имя]! Напоминаю о вашей записи завтра в [время] на [услуга]. Жду вас!')
    .replace('[имя]', client_name)
    .replace('[время]', time)
    .replace('[услуга]', serviceList);
  res.json({ text });
});

// ─── УВЕДОМЛЕНИЯ В 10:00 (без звука через Telegram) ───────────────────────

cron.schedule('0 10 * * *', () => {
  const today = new Date().toISOString().split('T')[0];
  const todos = db.prepare('SELECT * FROM todos WHERE date=? AND done=0').all(today);
  if (todos.length > 0) {
    console.log(`Напоминание о делах на ${today}: ${todos.length} дел`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
