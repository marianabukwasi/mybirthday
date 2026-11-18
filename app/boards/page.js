import Link from 'next/link';
import { db } from '../../lib/db';
import { getPhase, daysUntilBirthday } from '../../lib/phase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Boards open now · mybirthday.life' };

export default function Boards() {
  const rows = db.prepare(
    `SELECT b.slug, b.bio, b.color1, b.color2, u.name, u.birth_date, u.time_zone, u.country
     FROM boards b JOIN users u ON u.id=b.user_id WHERE b.is_public=1`).all()
    .map(r => ({ ...r, phase: getPhase(r.birth_date, r.time_zone), days: daysUntilBirthday(r.birth_date, r.time_zone) }))
    .filter(r => r.phase === 'vault' || r.phase === 'reveal')
    .sort((a, b) => a.days - b.days);
  return (
    <>
      <h1>Boards you can contribute to</h1>
      {rows.length === 0 && <div className="card muted">No public boards are open right now.</div>}
      <div className="grid">
        {rows.map(r => (
          <Link key={r.slug} href={`/b/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ borderTop: `5px solid ${r.color1}` }}>
              <h3>{r.name}</h3>
              <div className="muted">{r.country}</div>
              <p className="muted">{r.bio}</p>
              <span className="pill">{r.phase === 'reveal' ? '🎉 Celebrating today' : `🔒 Opens in ${r.days} days`}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
