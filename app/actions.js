'use server';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db, UPLOAD_DIR } from '../lib/db';
import { hashPassword, verifyPassword, createSession, destroySession, currentUser, slugify, queueEmail } from '../lib/auth';
import { getPhase, canSendWishes, isAdult, validTimeZone, cashEnabledFor } from '../lib/phase';
import { recordCashGift } from '../lib/integrations';

const MAX_BYTES = { photo: 10e6, voice: 8e6, video: 80e6 };
const MIME_OK = { photo: /^image\//, voice: /^audio\//, video: /^video\// };

export async function signup(prev, form) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const name = String(form.get('name') || '').trim();
  const password = String(form.get('password') || '');
  const birth = String(form.get('birth_date') || '');
  const tz = String(form.get('time_zone') || '');
  const country = String(form.get('country') || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please enter a valid email.' };
  if (!name || !country) return { error: 'Name and country are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (!isAdult(birth)) return { error: 'mybirthday.life is for people aged 18 or older.' };
  if (!validTimeZone(tz)) return { error: 'Please choose a valid time zone.' };
  if (!form.get('confirm')) return { error: 'Please confirm your birth date is correct and will be locked.' };
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return { error: 'That email already has an account.' };

  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d);
  const c1 = hex(form.get('color1'), '#7c3aed');
  const c2 = hex(form.get('color2'), '#ec4899');

  const r = db.prepare(
    'INSERT INTO users (email, name, password_hash, birth_date, time_zone, country) VALUES (?,?,?,?,?,?)'
  ).run(email, name, hashPassword(password), birth, tz, country);
  db.prepare('INSERT INTO boards (user_id, slug, color1, color2) VALUES (?,?,?,?)').run(r.lastInsertRowid, slugify(name), c1, c2);
  queueEmail(email, 'Welcome to mybirthday.life', `Hi ${name}, your birth date is locked and your board is set up.`);
  await createSession(Number(r.lastInsertRowid));
  redirect('/dashboard');
}

export async function login(prev, form) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || !verifyPassword(String(form.get('password') || ''), u.password_hash)) return { error: 'Wrong email or password.' };
  await createSession(u.id);
  redirect('/dashboard');
}

export async function logout() { await destroySession(); redirect('/'); }

async function mustOwn() {
  const u = await currentUser();
  if (!u) redirect('/login');
  return { u, board: db.prepare('SELECT * FROM boards WHERE user_id = ?').get(u.id) };
}

export async function saveProfile(form) {
  const { board } = await mustOwn();
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
  db.prepare('UPDATE boards SET bio=?, likes=?, color1=?, color2=?, is_public=?, allow_late=? WHERE id=?').run(
    String(form.get('bio') || '').slice(0, 500), String(form.get('likes') || '').slice(0, 300),
    hex(form.get('color1'), '#7c3aed'), hex(form.get('color2'), '#ec4899'),
    form.get('is_public') ? 1 : 0, form.get('allow_late') ? 1 : 0, board.id);
  revalidatePath('/dashboard');
}

export async function addRequest(form) {
  const { board } = await mustOwn();
  const t = String(form.get('title') || '').trim().slice(0, 120);
  if (t) db.prepare('INSERT INTO requests (board_id, title) VALUES (?,?)').run(board.id, t);
  revalidatePath('/dashboard');
}

export async function addWishlist(form) {
  const { board } = await mustOwn();
  const t = String(form.get('title') || '').trim().slice(0, 120);
  let url = String(form.get('url') || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = '';
  if (t) db.prepare('INSERT INTO wishlist (board_id, title, url) VALUES (?,?,?)').run(board.id, t, url);
  revalidatePath('/dashboard');
}

export async function sendWish(prev, form) {
  const slug = String(form.get('slug'));
  const row = db.prepare(
    'SELECT b.*, u.birth_date, u.time_zone, u.name AS owner_name FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?'
  ).get(slug);
  if (!row) return { error: 'Board not found.' };
  const phase = getPhase(row.birth_date, row.time_zone);
  if (!canSendWishes(phase, row.allow_late)) return { error: 'This board is not accepting wishes right now.' };

  const name = String(form.get('guest_name') || '').trim();
  const email = String(form.get('guest_email') || '').trim().toLowerCase();
  const gbirth = String(form.get('guest_birth_date') || '');
  const city = String(form.get('guest_city') || '').trim().slice(0, 80);
  const kind = String(form.get('kind') || 'text');
  const message = String(form.get('message') || '').trim().slice(0, 2000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please enter your name and a valid email.' };
  if (!isAdult(gbirth)) return { error: 'Guests must be 18 or older.' };
  if (!form.get('license')) return { error: 'Please accept the media licence to continue.' };
  if (!['text', 'photo', 'voice', 'video'].includes(kind)) return { error: 'Unknown wish type.' };
  if (kind === 'text' && !message) return { error: 'Please write your wish.' };

  let mediaPath = '';
  if (kind !== 'text') {
    const file = form.get('media');
    if (!file || typeof file === 'string' || file.size === 0) return { error: `Please attach your ${kind}.` };
    if (!MIME_OK[kind].test(file.type)) return { error: `That file is not a valid ${kind}.` };
    if (file.size > MAX_BYTES[kind]) return { error: 'That file is too large.' };
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    mediaPath = crypto.randomBytes(16).toString('hex') + path.extname(file.name || '').slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    fs.writeFileSync(path.join(UPLOAD_DIR, mediaPath), Buffer.from(await file.arrayBuffer()));
  }

  db.prepare(
    `INSERT INTO wishes (board_id, guest_name, guest_email, guest_birth_date, guest_city, kind, message, media_path, request_title)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(row.id, name, email, gbirth, city, kind, message, mediaPath, String(form.get('request_title') || '').slice(0, 120));
  queueEmail(email, `Your birthday wish for ${row.owner_name} is wrapped!`,
    `Thank you ${name}! Your wish is wrapped up as a surprise until the birthday. We'll remind you when your own birthday celebration opens.`);
  revalidatePath(`/b/${slug}`);
  return { ok: true };
}

export async function replyToWish(form) {
  const { board } = await mustOwn();
  const id = Number(form.get('id'));
  db.prepare('UPDATE wishes SET reply=? WHERE id=? AND board_id=?').run(String(form.get('reply') || '').slice(0, 500), id, board.id);
  revalidatePath('/dashboard');
}

export async function reportWish(form) {
  const id = Number(form.get('id'));
  const w = db.prepare('SELECT board_id FROM wishes WHERE id=?').get(id);
  if (w) {
    db.prepare('INSERT INTO reports (wish_id, board_id, reason) VALUES (?,?,?)').run(id, w.board_id, String(form.get('reason') || 'Reported').slice(0, 300));
    db.prepare("UPDATE wishes SET status='reported' WHERE id=? AND status='ok'").run(id);
  }
  revalidatePath('/dashboard');
}

export async function deleteAccount() {
  const { u, board } = await mustOwn();
  const files = db.prepare("SELECT media_path FROM wishes WHERE board_id=? AND media_path!=''").all(board.id);
  for (const f of files) fs.rmSync(path.join(UPLOAD_DIR, f.media_path), { force: true });
  db.prepare('DELETE FROM wishes WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM requests WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM wishlist WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM boards WHERE id=?').run(board.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  await destroySession();
  redirect('/');
}

export async function sendCashGift(prev, form) {
  const slug = String(form.get('slug') || '');
  const row = db.prepare(
    'SELECT b.id, u.country, u.name FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?'
  ).get(slug);
  if (!row) return { error: 'Board not found.' };
  if (!cashEnabledFor(row.country)) {
    return { error: `Cash gifts are currently turned off for boards in ${row.country}.` };
  }
  const amount = Number(form.get('amount') || 0);
  const senderName = String(form.get('sender_name') || '').trim();
  const senderEmail = String(form.get('sender_email') || '').trim().toLowerCase();
  if (!senderName || !/^\S+@\S+\.\S+$/.test(senderEmail)) return { error: 'Please enter your name and valid email.' };
  if (!Number.isFinite(amount) || amount < 5 || amount > 5000) return { error: 'Gift amount must be between $5 and $5,000.' };

  const res = await recordCashGift({
    boardId: row.id,
    senderName,
    senderEmail,
    amountCents: Math.round(amount * 100),
  });
  revalidatePath(`/b/${slug}`);
  return { ok: true, amount, totalDollars: (res.totalCents / 100).toFixed(2) };
}

export async function sendLiveEvent(form) {
  const slug = String(form.get('slug') || '');
  const row = db.prepare('SELECT b.id, u.country FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?').get(slug);
  if (!row) return { error: 'Board not found.' };
  const kind = String(form.get('kind') || 'cheer');
  const senderName = String(form.get('sender_name') || 'Guest').trim().slice(0, 60);
  const senderCity = String(form.get('sender_city') || '').trim().slice(0, 60);
  const giftType = String(form.get('gift_type') || '').slice(0, 40);
  const amountCents = Number(form.get('amount_cents') || 0);
  const message = String(form.get('message') || '').trim().slice(0, 240);

  if (kind === 'gift' && !cashEnabledFor(row.country)) return { error: 'Paid live gifts are off for this country.' };
  db.prepare(
    'INSERT INTO live_events (board_id, kind, sender_name, sender_city, gift_type, amount_cents, message) VALUES (?,?,?,?,?,?,?)'
  ).run(row.id, kind, senderName, senderCity, giftType, amountCents, message);
  revalidatePath(`/b/${slug}/live`);
  return { ok: true };
}

export async function purchaseKeepsake(form) {
  const slug = String(form.get('slug') || '');
  const kind = String(form.get('kind') || 'video_full');
  const row = db.prepare('SELECT id FROM boards WHERE slug=?').get(slug);
  if (!row) return;
  const amountCents = kind === 'keepsake_card' ? 1200 : 1900;
  db.prepare('INSERT INTO orders (board_id, kind, amount_cents, status) VALUES (?,?,?,?)').run(row.id, kind, amountCents, 'paid');
  revalidatePath(`/b/${slug}/keepsake`);
}
