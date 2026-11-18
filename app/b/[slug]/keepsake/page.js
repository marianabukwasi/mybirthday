import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/auth';
import { getPhase, vaultUnlocked } from '../../../../lib/phase';
import { KeepsakeClient } from '../../../keepsake-client';

export const dynamic = 'force-dynamic';

export default async function KeepsakePage({ params }) {
  const { slug } = await params;
  const b = db.prepare(
    'SELECT b.*, u.name, u.birth_date, u.time_zone FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?'
  ).get(slug);
  if (!b) notFound();

  const me = await currentUser();
  const isOwner = me?.id === b.user_id;
  const phase = getPhase(b.birth_date, b.time_zone);
  const unlocked = vaultUnlocked(phase);

  const wishes = unlocked && isOwner
    ? db.prepare("SELECT id, guest_name, guest_city, kind, message FROM wishes WHERE board_id=? AND status='ok' ORDER BY id DESC").all(b.id).map(w => ({ ...w }))
    : [];

  const orders = db.prepare('SELECT kind FROM orders WHERE board_id=?').all(b.id).map(o => o.kind);

  return (
    <>
      <p><Link href={`/b/${slug}`}>← Back to {b.name}'s board</Link></p>
      <h1>🎞️ Compiled Video &amp; Keepsake Card</h1>
      {!unlocked && (
        <div className="sealed" style={{ marginBottom: '1rem' }}>
          🎁 Wishes unwrap at 00:00 on {b.name}'s birthday. Your teaser reel and keepsake card will automatically fill with every wish on the birthday!
        </div>
      )}
      <KeepsakeClient
        slug={b.slug}
        ownerName={b.name.split(' ')[0]}
        wishes={wishes}
        fullVideoPaid={orders.includes('video_full')}
        cardPaid={orders.includes('keepsake_card')}
        color1={b.color1}
        color2={b.color2}
      />
    </>
  );
}
