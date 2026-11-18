import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from '../../../lib/db';
import { getPhase, vaultUnlocked } from '../../../lib/phase';
import { currentUser } from '../../../lib/auth';

// Media is served ONLY after the reveal, and only the board owner can see it.
// Before 00:00 on the birthday this returns 404 even for the owner.
export async function GET(req, { params }) {
  const { id } = await params;
  const w = db.prepare(
    `SELECT w.*, b.user_id, u.birth_date, u.time_zone FROM wishes w
     JOIN boards b ON b.id=w.board_id JOIN users u ON u.id=b.user_id WHERE w.id=?`
  ).get(Number(id));
  if (!w || !w.media_path || w.status === 'removed') return new Response('Not found', { status: 404 });
  const me = await currentUser();
  const phase = getPhase(w.birth_date, w.time_zone);
  if (!me || me.id !== w.user_id || !vaultUnlocked(phase)) return new Response('Not found', { status: 404 });
  const file = path.join(UPLOAD_DIR, w.media_path);
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  const type = { photo: 'image/*', voice: 'audio/*', video: 'video/*' }[w.kind];
  const ext = path.extname(w.media_path).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webm': w.kind === 'video' ? 'video/webm' : 'audio/webm',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': map[ext] || type, 'Cache-Control': 'private, no-store' },
  });
}
