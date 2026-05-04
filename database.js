const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'beauty.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    telegram_username TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT,
    client_phone TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    services TEXT NOT NULL,
    total_price REAL DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'active',
    booking_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );
`);

// Добавить стандартные услуги если нет
const servicesCount = db.prepare('SELECT COUNT(*) as count FROM services').get();
if (servicesCount.count === 0) {
  const insert = db.prepare('INSERT INTO services (name, price, duration) VALUES (?, ?, ?)');
  insert.run('Наращивание ресниц', 3500, 120);
  insert.run('Ламинирование ресниц', 2500, 90);
  insert.run('Архитектура бровей', 2000, 60);
  insert.run('Перманентный макияж', 8000, 180);
  insert.run('Консультация по психологии', 3000, 60);
}

module.exports = db;
