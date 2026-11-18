import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { sendTransactionalEmail } from './integrations';

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  (await cookies()).set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get('session')?.value;
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  jar.delete('session');
}

export async function currentUser() {
  const t = (await cookies()).get('session')?.value;
  if (!t) return null;
  const row = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).get(t, Date.now());
  return row || null;
}

export function slugify(name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'friend';
  let slug = base, i = 1;
  while (db.prepare('SELECT 1 FROM boards WHERE slug = ?').get(slug)) slug = `${base}-${++i}`;
  return slug;
}

export function queueEmail(to, subject, body) {
  return sendTransactionalEmail({ to, subject, text: body });
}
