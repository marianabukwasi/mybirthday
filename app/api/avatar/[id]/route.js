import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from '../../../../lib/db';

export async function GET(req, { params }) {
  const { id } = await params;
  const b = db.prepare('SELECT avatar_path FROM boards WHERE user_id=?').get(Number(id));
  if (!b || !b.avatar_path) return new Response('Not found', { status: 404 });
  const file = path.join(UPLOAD_DIR, b.avatar_path);
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  const ext = path.extname(b.avatar_path).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': map[ext] || 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
  });
}
