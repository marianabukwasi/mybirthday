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

const MAX_BYTES = { photo: 10e6, postcard: 10e6, voice: 8e6, video: 80e6 };
const MIME_OK = { photo: /^image\//, postcard: /^image\//, voice: /^audio\//, video: /^video\// };

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
  if (!isAdult(birth)) return { error: 'mybirthday.life is for adults aged 18 or older.' };
  if (!validTimeZone(tz)) return { error: 'Please choose a valid time zone.' };
  if (!form.get('confirm')) return { error: 'Please confirm your birth date is accurate and will be locked.' };
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return { error: 'That email already has an account.' };

  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d);
  const c1 = hex(form.get('color1'), '#e11d48');
  const c2 = hex(form.get('color2'), '#f59e0b');

  const r = db.prepare(
    'INSERT INTO users (email, name, password_hash, birth_date, time_zone, country) VALUES (?,?,?,?,?,?)'
  ).run(email, name, hashPassword(password), birth, tz, country);
  db.prepare('INSERT INTO boards (user_id, slug, color1, color2) VALUES (?,?,?,?)').run(r.lastInsertRowid, slugify(name), c1, c2);
  await queueEmail(email, 'Welcome to mybirthday.life', `Hi ${name}, your birth date is locked and your celebration profile is ready.`);
  await createSession(Number(r.lastInsertRowid));
  redirect('/profile');
}

export async function login(prev, form) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || !verifyPassword(String(form.get('password') || ''), u.password_hash)) return { error: 'Wrong email or password.' };
  await createSession(u.id);
  redirect('/profile');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

async function mustOwn() {
  const u = await currentUser();
  if (!u) redirect('/login');
  return { u, board: db.prepare('SELECT * FROM boards WHERE user_id = ?').get(u.id) };
}

export async function saveProfile(form) {
  const { u, board } = await mustOwn();
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d);
  const vis = (v, d = 'public') => (['public', 'friends', 'private'].includes(String(v)) ? String(v) : d);
  const contrib = form.get('who_can_contribute') === 'friends' ? 'friends' : 'anyone';

  let avatarPath = board.avatar_path || '';
  const avatarFile = form.get('avatar');
  if (avatarFile && typeof avatarFile !== 'string' && avatarFile.size > 0 && /^image\//.test(avatarFile.type) && avatarFile.size <= 5e6) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    avatarPath = 'av-' + crypto.randomBytes(12).toString('hex') + path.extname(avatarFile.name || '.jpg').slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    fs.writeFileSync(path.join(UPLOAD_DIR, avatarPath), Buffer.from(await avatarFile.arrayBuffer()));
  }

  db.prepare(
    `UPDATE boards SET bio=?, likes=?, favorites=?, avatar_path=?, color1=?, color2=?, is_public=?, who_can_contribute=?, allow_late=?, live_title=?,
     vis_age=?, vis_birthday=?, vis_country=?, vis_bio=?, vis_likes=?, vis_wishlist=? WHERE id=?`
  ).run(
    String(form.get('bio') || '').slice(0, 500),
    String(form.get('likes') || '').slice(0, 300),
    String(form.get('favorites') || '').slice(0, 300),
    avatarPath,
    hex(form.get('color1'), '#e11d48'),
    hex(form.get('color2'), '#f59e0b'),
    form.get('is_public') ? 1 : 0,
    contrib,
    form.get('allow_late') ? 1 : 0,
    String(form.get('live_title') || 'Cut the Cake With Me').slice(0, 80),
    vis(form.get('vis_age'), 'private'),
    vis(form.get('vis_birthday'), 'public'),
    vis(form.get('vis_country'), 'public'),
    vis(form.get('vis_bio'), 'public'),
    vis(form.get('vis_likes'), 'public'),
    vis(form.get('vis_wishlist'), 'public'),
    board.id
  );
  revalidatePath('/profile');
  revalidatePath('/settings');
  revalidatePath(`/b/${board.slug}`);
  revalidatePath(`/api/avatar/${u.id}`);
}

export async function addRequest(form) {
  const { board } = await mustOwn();
  const t = String(form.get('title') || '').trim().slice(0, 120);
  if (t) db.prepare('INSERT INTO requests (board_id, title) VALUES (?,?)').run(board.id, t);
  revalidatePath('/profile');
  revalidatePath(`/b/${board.slug}`);
}

export async function deleteRequest(form) {
  const { board } = await mustOwn();
  db.prepare('DELETE FROM requests WHERE id=? AND board_id=?').run(Number(form.get('id')), board.id);
  revalidatePath('/profile');
  revalidatePath(`/b/${board.slug}`);
}

export async function addWishlist(form) {
  const { board } = await mustOwn();
  const t = String(form.get('title') || '').trim().slice(0, 120);
  const desc = String(form.get('description') || '').trim().slice(0, 240);
  let url = String(form.get('url') || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = '';
  if (t) db.prepare('INSERT INTO wishlist (board_id, title, description, url) VALUES (?,?,?,?)').run(board.id, t, desc, url);
  revalidatePath('/wishlist');
  revalidatePath('/profile');
  revalidatePath(`/b/${board.slug}`);
}

export async function claimWishlist(form) {
  const id = Number(form.get('id'));
  const slug = String(form.get('slug') || '');
  const who = String(form.get('claimed_by') || 'A friend').trim().slice(0, 60);
  db.prepare("UPDATE wishlist SET claimed_by=? WHERE id=? AND claimed_by=''").run(who, id);
  revalidatePath(`/b/${slug}`);
}

export async function toggleConnection(form) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const targetId = Number(form.get('target_id'));
  if (!targetId || targetId === me.id) return;
  const exists = db.prepare('SELECT 1 FROM connections WHERE follower_id=? AND target_id=?').get(me.id, targetId);
  if (exists) {
    db.prepare('DELETE FROM connections WHERE follower_id=? AND target_id=?').run(me.id, targetId);
  } else {
    db.prepare('INSERT INTO connections (follower_id, target_id) VALUES (?,?)').run(me.id, targetId);
  }
  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/celebrations');
}

export async function sendWish(prev, form) {
  const slug = String(form.get('slug'));
  const row = db.prepare(
    'SELECT b.*, u.birth_date, u.time_zone, u.name AS owner_name FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?'
  ).get(slug);
  if (!row) return { error: 'Board not found.' };

  if (row.who_can_contribute === 'friends') {
    const me = await currentUser();
    const isConn = me && (me.id === row.user_id || db.prepare('SELECT 1 FROM connections WHERE follower_id=? AND target_id=?').get(me.id, row.user_id));
    if (!isConn) return { error: 'Only connected friends can contribute to this board.' };
  }

  const phase = getPhase(row.birth_date, row.time_zone);
  if (!canSendWishes(phase, row.allow_late)) return { error: 'This board is not open for wishes right now.' };

  const isAnon = form.get('is_anonymous') ? 1 : 0;
  const name = isAnon ? 'Anonymous Friend' : String(form.get('guest_name') || '').trim();
  const email = String(form.get('guest_email') || '').trim().toLowerCase();
  const gbirth = String(form.get('guest_birth_date') || '');
  const city = String(form.get('guest_city') || '').trim().slice(0, 80);
  const country = String(form.get('guest_country') || '').trim().slice(0, 60);
  const kind = String(form.get('kind') || 'text');
  const message = String(form.get('message') || '').trim().slice(0, 2000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please enter your name and a valid email.' };
  if (!isAdult(gbirth)) return { error: 'Contributors must be 18 or older.' };
  if (!form.get('license')) return { error: 'Please accept the media licence to continue.' };
  if (!['text', 'photo', 'postcard', 'voice', 'video', 'giftcard'].includes(kind)) return { error: 'Unknown wish type.' };
  if (['text', 'postcard', 'giftcard'].includes(kind) && !message) return { error: 'Please write your message.' };

  let mediaPath = '';
  if (kind === 'photo' || kind === 'voice' || kind === 'video') {
    const file = form.get('media');
    if (!file || typeof file === 'string' || file.size === 0) return { error: `Please attach your ${kind}.` };
    if (!MIME_OK[kind].test(file.type)) return { error: `That file is not a valid ${kind}.` };
    if (file.size > MAX_BYTES[kind]) return { error: 'That file is too large.' };
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    mediaPath = crypto.randomBytes(16).toString('hex') + path.extname(file.name || '').slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    fs.writeFileSync(path.join(UPLOAD_DIR, mediaPath), Buffer.from(await file.arrayBuffer()));
  }

  db.prepare(
    `INSERT INTO wishes (board_id, guest_name, guest_email, guest_birth_date, guest_city, guest_country, is_anonymous, kind, message, media_path, request_title)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(row.id, name, email, gbirth, city, country, isAnon, kind, message, mediaPath, String(form.get('request_title') || '').slice(0, 120));

  const kindNoun = {
    text: 'sent you a birthday wish',
    photo: 'shared a photograph with you',
    postcard: 'sent you a postcard',
    voice: 'recorded a voice message',
    video: 'shared a birthday video',
    giftcard: 'sent you a gift card',
  }[kind];
  const fromPlace = country ? ` from ${country}` : city ? ` from ${city}` : '';
  db.prepare('INSERT INTO notifications (user_id, kind, message) VALUES (?,?,?)').run(
    row.user_id,
    'activity',
    `Someone ${kindNoun}${fromPlace}.`
  );

  await queueEmail(email, `Your wish for ${row.owner_name} is in the Open Vault`,
    `Thank you! Your wish stays hidden until ${row.owner_name}'s birthday reveal at 00:00 (${row.time_zone}).`);
  revalidatePath(`/b/${slug}`);
  revalidatePath('/notifications');
  return { ok: true };
}

export async function replyToWish(form) {
  const { board } = await mustOwn();
  const id = Number(form.get('id'));
  db.prepare('UPDATE wishes SET reply=? WHERE id=? AND board_id=?').run(String(form.get('reply') || '').slice(0, 500), id, board.id);
  revalidatePath(`/b/${board.slug}`);
  revalidatePath('/profile');
}

export async function reportWish(form) {
  const id = Number(form.get('id'));
  const w = db.prepare('SELECT board_id FROM wishes WHERE id=?').get(id);
  if (w) {
    db.prepare('INSERT INTO reports (wish_id, board_id, reason) VALUES (?,?,?)').run(id, w.board_id, String(form.get('reason') || 'Reported').slice(0, 300));
    db.prepare("UPDATE wishes SET status='reported' WHERE id=? AND status='ok'").run(id);
  }
  revalidatePath('/profile');
}

export async function sendCashGift(prev, form) {
  const slug = String(form.get('slug') || '');
  const row = db.prepare('SELECT b.id, u.country, u.user_id, u.id AS uid FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?').get(slug);
  if (!row) return { error: 'Board not found.' };
  if (!cashEnabledFor(row.country)) return { error: `Monetary gifts are not available in ${row.country} yet.` };
  const amount = Number(form.get('amount') || 0);
  const senderName = String(form.get('sender_name') || '').trim();
  const senderEmail = String(form.get('sender_email') || '').trim().toLowerCase();
  if (!senderName || !/^\S+@\S+\.\S+$/.test(senderEmail)) return { error: 'Please enter your name and valid email.' };
  if (!Number.isFinite(amount) || amount < 5 || amount > 5000) return { error: 'Gift amount must be between $5 and $5,000.' };

  const res = await recordCashGift({ boardId: row.id, senderName, senderEmail, amountCents: Math.round(amount * 100) });
  db.prepare('INSERT INTO notifications (user_id, kind, message) VALUES (?,?,?)').run(row.uid, 'activity', 'Someone added a monetary gift to your celebration.');
  revalidatePath(`/b/${slug}`);
  return { ok: true, amount, totalDollars: (res.totalCents / 100).toFixed(2) };
}

export async function sendLiveEvent(form) {
  const slug = String(form.get('slug') || '');
  const row = db.prepare('SELECT b.id FROM boards b WHERE b.slug=?').get(slug);
  if (!row) return { error: 'Board not found.' };
  const kind = String(form.get('kind') || 'cheer');
  const senderName = String(form.get('sender_name') || 'Guest').trim().slice(0, 60);
  const senderCity = String(form.get('sender_city') || '').trim().slice(0, 60);
  const message = String(form.get('message') || '').trim().slice(0, 240);
  db.prepare('INSERT INTO live_events (board_id, kind, sender_name, sender_city, message) VALUES (?,?,?,?,?)').run(
    row.id, kind, senderName, senderCity, message
  );
  revalidatePath(`/b/${slug}/live`);
  return { ok: true };
}

export async function purchaseKeepsake(form) {
  const slug = String(form.get('slug') || '');
  const kind = String(form.get('kind') || 'video_full');
  const row = db.prepare('SELECT id FROM boards WHERE slug=?').get(slug);
  if (!row) return;
  db.prepare('INSERT INTO orders (board_id, kind, amount_cents, status) VALUES (?,?,?,?)').run(
    row.id, kind, kind === 'keepsake_card' ? 1200 : 1900, 'paid'
  );
  revalidatePath(`/b/${slug}/keepsake`);
  revalidatePath('/memories');
}

export async function markNotificationsRead() {
  const { u } = await mustOwn();
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(u.id);
  revalidatePath('/notifications');
}

export async function deleteAccount() {
  const { u, board } = await mustOwn();
  const files = db.prepare("SELECT media_path FROM wishes WHERE board_id=? AND media_path!=''").all(board.id);
  for (const f of files) fs.rmSync(path.join(UPLOAD_DIR, f.media_path), { force: true });
  if (board.avatar_path) fs.rmSync(path.join(UPLOAD_DIR, board.avatar_path), { force: true });
  db.prepare('DELETE FROM connections WHERE follower_id=? OR target_id=?').run(u.id, u.id);
  db.prepare('DELETE FROM notifications WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM wishes WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM requests WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM wishlist WHERE board_id=?').run(board.id);
  db.prepare('DELETE FROM boards WHERE id=?').run(board.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  await destroySession();
  redirect('/');
}
