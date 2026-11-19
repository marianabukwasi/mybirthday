import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const g = globalThis;
if (!g.__db_v2) {
  const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      birth_date TEXT NOT NULL,           -- locked at signup
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
      avatar_path TEXT DEFAULT '',
      color1 TEXT DEFAULT '#e11d48',
      color2 TEXT DEFAULT '#f59e0b',
      likes TEXT DEFAULT '',
      favorites TEXT DEFAULT '',
      is_public INTEGER DEFAULT 1,
      who_can_contribute TEXT DEFAULT 'anyone', -- anyone | friends
      allow_late INTEGER DEFAULT 0,
      live_title TEXT DEFAULT 'Cut the Cake With Me',
      vis_age TEXT DEFAULT 'private',           -- public | friends | private
      vis_birthday TEXT DEFAULT 'public',
      vis_country TEXT DEFAULT 'public',
      vis_bio TEXT DEFAULT 'public',
      vis_likes TEXT DEFAULT 'public',
      vis_wishlist TEXT DEFAULT 'public'
    );

    CREATE TABLE IF NOT EXISTS connections (
      follower_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, target_id)
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
      description TEXT DEFAULT '',
      url TEXT DEFAULT '',
      claimed_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_birth_date TEXT NOT NULL,
      guest_city TEXT DEFAULT '',
      guest_country TEXT DEFAULT '',
      is_anonymous INTEGER DEFAULT 0,
      kind TEXT NOT NULL,                 -- text | photo | postcard | voice | video | giftcard
      message TEXT DEFAULT '',
      media_path TEXT DEFAULT '',
      request_title TEXT DEFAULT '',
      reply TEXT DEFAULT '',
      status TEXT DEFAULT 'ok',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS live_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                 -- cheer | candles | cake
      sender_name TEXT NOT NULL,
      sender_city TEXT DEFAULT '',
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
      status TEXT DEFAULT 'held',
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

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                 -- activity | reminder
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wish_id INTEGER,
      board_id INTEGER,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT,
      subject TEXT,
      body TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations if upgrading an existing local app.db
  const alters = [
    "ALTER TABLE boards ADD COLUMN avatar_path TEXT DEFAULT ''",
    "ALTER TABLE boards ADD COLUMN who_can_contribute TEXT DEFAULT 'anyone'",
    "ALTER TABLE boards ADD COLUMN favorites TEXT DEFAULT ''",
    "ALTER TABLE boards ADD COLUMN live_title TEXT DEFAULT 'Cut the Cake With Me'",
    "ALTER TABLE boards ADD COLUMN vis_age TEXT DEFAULT 'private'",
    "ALTER TABLE boards ADD COLUMN vis_birthday TEXT DEFAULT 'public'",
    "ALTER TABLE boards ADD COLUMN vis_country TEXT DEFAULT 'public'",
    "ALTER TABLE boards ADD COLUMN vis_bio TEXT DEFAULT 'public'",
    "ALTER TABLE boards ADD COLUMN vis_likes TEXT DEFAULT 'public'",
    "ALTER TABLE boards ADD COLUMN vis_wishlist TEXT DEFAULT 'public'",
    "ALTER TABLE wishlist ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE wishlist ADD COLUMN claimed_by TEXT DEFAULT ''",
    "ALTER TABLE wishes ADD COLUMN guest_country TEXT DEFAULT ''",
    "ALTER TABLE wishes ADD COLUMN is_anonymous INTEGER DEFAULT 0",
  ];
  for (const sql of alters) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // Seed initial sample celebrants when database is empty so the globe & boards can be tested immediately
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
    const todayMd = new Date().toISOString().slice(5, 10); // e.g. '11-19'
    const samples = [
      {
        name: 'Amara Lindqvist', email: 'amara@example.com', birth: '1995-12-17', tz: 'Europe/Stockholm', country: 'Sweden',
        slug: 'amara-lindqvist', bio: 'Architect & winter sea swimmer in Stockholm. Collecting stories from friends around the world.',
        likes: 'Nordic architecture, Cold plunges, Jazz', favorites: 'Cardamom buns, Vinyl records', c1: '#4f46e5', c2: '#0ea5e9',
        req: 'Send me a photograph of autumn where you live', wishItem: 'Japanese Brass Sketching Pen',
      },
      {
        name: 'Mateo Silva', email: 'mateo@example.com', birth: `1992-${todayMd}`, tz: 'Europe/Luxembourg', country: 'Luxembourg',
        slug: 'mateo-silva', bio: 'Celebrating my birthday today in Luxembourg! Join the live cake cutting room.',
        likes: 'Ceramics, Cycling, Acoustic music', favorites: 'Espresso, Sea salt chocolate', c1: '#0ea5e9', c2: '#6366f1',
        req: 'Record a 60-second memory you have of me', wishItem: 'Stoneware Glaze Kit',
      },
      {
        name: 'Grace Namukasa', email: 'grace@example.com', birth: '1994-01-09', tz: 'Africa/Kampala', country: 'Uganda',
        slug: 'grace-namukasa', bio: 'Botanical illustrator & community garden founder in Kampala.',
        likes: 'Botanical art, Poetry, Acoustic guitar', favorites: 'Fresh mango, Sunlit mornings', c1: '#7c3aed', c2: '#38bdf8',
        req: 'Share a photograph of a flower or tree near you', wishItem: 'Travel Watercolor Set',
      },
      {
        name: 'Elena Vance', email: 'elena@example.com', birth: `1991-${todayMd}`, tz: 'America/New_York', country: 'United States of America',
        slug: 'elena-vance', bio: 'Bookstore owner celebrating today! Drop a note or join my live birthday dinner.',
        likes: 'Indie bookstores, Film photography, Hiking', favorites: 'Matcha lattes, Handwritten letters', c1: '#2563eb', c2: '#818cf8',
        req: 'Write me a handwritten note and photograph it', wishItem: 'Vintage Polaroid Film Pack',
      },
      {
        name: 'Oliver Bennett', email: 'oliver@example.com', birth: '1990-12-28', tz: 'Europe/London', country: 'United Kingdom',
        slug: 'oliver-bennett', bio: 'Chef & weekend marathoner in London counting down to December 28.',
        likes: 'Sourdough baking, Running, Vinyl', favorites: 'Earl Grey, Rainy Sunday walks', c1: '#0284c7', c2: '#4f46e5',
        req: 'Tell me something you appreciate about me', wishItem: 'Cast Iron Dutch Oven',
      },
      {
        name: 'Kenji Takahashi', email: 'kenji@example.com', birth: '1988-01-19', tz: 'Asia/Tokyo', country: 'Japan',
        slug: 'kenji-takahashi', bio: 'Woodworker & gravel cyclist in Kyoto.',
        likes: 'Joinery, Gravel cycling, Tea', favorites: 'Hinoki wood, Kyoto mornings', c1: '#4338ca', c2: '#0ea5e9',
        req: 'Send a photo of your favourite street or trail', wishItem: 'Hand-Forged Japanese Chisel Roll',
      },
    ];

    const insUser = db.prepare('INSERT INTO users (email, name, password_hash, birth_date, time_zone, country) VALUES (?,?,?,?,?,?)');
    const insBoard = db.prepare('INSERT INTO boards (user_id, slug, bio, color1, color2, likes, favorites) VALUES (?,?,?,?,?,?,?)');
    const insReq = db.prepare('INSERT INTO requests (board_id, title) VALUES (?,?)');
    const insWl = db.prepare('INSERT INTO wishlist (board_id, title) VALUES (?,?)');
    const insWish = db.prepare('INSERT INTO wishes (board_id, guest_name, guest_email, guest_birth_date, guest_city, guest_country, kind, message) VALUES (?,?,?,?,?,?,?,?)');

    for (const s of samples) {
      const u = insUser.run(s.email, s.name, 'demo-seeded-no-login', s.birth, s.tz, s.country);
      const b = insBoard.run(u.lastInsertRowid, s.slug, s.bio, s.c1, s.c2, s.likes, s.favorites);
      insReq.run(b.lastInsertRowid, s.req);
      insWl.run(b.lastInsertRowid, s.wishItem);
      insWish.run(b.lastInsertRowid, 'Soren Lind', 'soren@example.com', '1990-04-12', 'Gothenburg', 'Sweden', 'text', `Happy birthday ${s.name.split(' ')[0]}! Wishing you an unforgettable year ahead!`);
    }
  }

  g.__db_v2 = db;
}

export const db = g.__db_v2;
