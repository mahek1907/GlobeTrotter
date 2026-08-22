const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'globetrotter.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  photo TEXT DEFAULT '',
  language TEXT DEFAULT 'English',
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  cost_index INTEGER NOT NULL,      -- avg cost per day (stay+food) in USD
  popularity INTEGER NOT NULL,      -- 1-100
  image_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- sightseeing, food, adventure, culture, relaxation
  cost REAL NOT NULL,
  duration_hours REAL NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT DEFAULT '',
  cover_photo TEXT DEFAULT '',
  is_public INTEGER DEFAULT 0,
  public_slug TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  city_id TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (city_id) REFERENCES cities(id)
);

CREATE TABLE IF NOT EXISTS trip_activities (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  day_number INTEGER DEFAULT 1,
  time_slot TEXT DEFAULT '',
  FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id)
);
`);

module.exports = db;
