import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { slug } = await params;
  const b = db.prepare('SELECT id FROM boards WHERE slug=?').get(slug);
  if (!b) return Response.json({ events: [] }, { status: 404 });
  const events = db.prepare(
    'SELECT id, kind, sender_name, sender_city, gift_type, amount_cents, message, created_at FROM live_events WHERE board_id=? ORDER BY id DESC LIMIT 40'
  ).all(b.id).map(e => ({ ...e }));
  return Response.json({ events });
}
