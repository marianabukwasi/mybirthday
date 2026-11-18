import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Memories & Keepsakes · mybirthday.life' };

export default async function MemoriesPage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  const b = db.prepare('SELECT slug FROM boards WHERE user_id=?').get(u.id);
  const orders = db.prepare('SELECT kind, amount_cents, created_at FROM orders WHERE board_id=? ORDER BY id DESC').all(b.id);

  return (
    <>
      <h1>🎞️ Memories &amp; Keepsakes</h1>
      <p className="muted">Turn your birthday wishes, photographs, voice notes, and videos into lasting keepsakes.</p>

      <div className="grid-2">
        <div className="card">
          <span className="pill">Compiled Video</span>
          <h3 style={{ marginTop: 8 }}>Your Birthday Film</h3>
          <p className="muted">Free 15-second preview + paid full-length compilation stitched from your friends&apos; authentic uploads.</p>
          <Link className="btn" href={`/b/${b.slug}/keepsake`}>Open Video &amp; Keepsake Studio →</Link>
        </div>

        <div className="card">
          <span className="pill rose">Printable Card</span>
          <h3 style={{ marginTop: 8 }}>Birthday Keepsake Card</h3>
          <p className="muted">A printable keepsake edition featuring your favourite birthday messages and signatures.</p>
          <Link className="btn gold" href={`/b/${b.slug}/keepsake`}>Preview Printable Card →</Link>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3>Your Keepsake Purchases</h3>
          <ul>
            {orders.map((o, i) => (
              <li key={i}>{o.kind === 'keepsake_card' ? 'Printable Keepsake Card' : 'Full Birthday Video Compilation'} — ${(o.amount_cents / 100).toFixed(2)} ({o.created_at})</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
