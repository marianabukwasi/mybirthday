import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { cashEnabledFor } from '../../../../lib/phase';
import { LiveRoomClient } from '../../../live-room';

export const dynamic = 'force-dynamic';

export default async function LiveRoomPage({ params }) {
  const { slug } = await params;
  const b = db.prepare(
    'SELECT b.*, u.name, u.country FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?'
  ).get(slug);
  if (!b) notFound();

  const initialEvents = db.prepare(
    'SELECT id, kind, sender_name, sender_city, gift_type, amount_cents, message, created_at FROM live_events WHERE board_id=? ORDER BY id DESC LIMIT 40'
  ).all(b.id).map(e => ({ ...e }));

  return (
    <>
      <p><Link href={`/b/${slug}`}>← Back to {b.name}'s board</Link></p>
      <LiveRoomClient
        slug={b.slug}
        ownerName={b.name.split(' ')[0]}
        liveTitle={b.live_title || 'Cut the Cake With Me'}
        initialEvents={initialEvents}
        color1={b.color1}
        color2={b.color2}
      />
    </>
  );
}
