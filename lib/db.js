import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.join(process.cwd(), 'data');
fs.mkdirSync(dir, { recursive: true });

const g = globalThis;
if (!g.__db) {
  const db = new DatabaseSync(path.join(dir, 'app.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      birth_date TEXT NOT NULL,           -- locked at signup, never updated
      time_zone TEXT NOT NULL,
      country TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      bio TEXT DEFAULT '',
      color1 TEXT DEFAULT '#7c3aed',
      color2 TEXT DEFAULT '#ec4899',
      likes TEXT DEFAULT '',
      is_public INTEGER DEFAULT 1,
      allow_late INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_birth_date TEXT NOT NULL,
      guest_city TEXT DEFAULT '',
      kind TEXT NOT NULL,                 -- text | photo | voice | video
      message TEXT DEFAULT '',
      media_path TEXT DEFAULT '',
      request_title TEXT DEFAULT '',
      reply TEXT DEFAULT '',
      status TEXT DEFAULT 'ok',           -- ok | reported | removed
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER, board_id INTEGER, reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    -- Email outbox: swap the sender for a real provider (Resend/Postmark) at launch.
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT, subject TEXT, body TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS live_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                 -- cheer | gift | candles | cake
      sender_name TEXT NOT NULL,
      sender_city TEXT DEFAULT '',
      gift_type TEXT DEFAULT '',
      amount_cents INTEGER DEFAULT 0,
      message TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      platform_fee_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'held',         -- held | released
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                 -- video_full | keepsake_card
      amount_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'paid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  g.__db = db;
}

export const db = g.__db;
