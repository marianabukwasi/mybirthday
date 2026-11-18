import Link from 'next/link';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { getPhase, daysUntilBirthday } from '../../lib/phase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Celebrations · mybirthday.life' };

export default async function CelebrationsPage() {
  const me = await currentUser();
  const rows = db.prepare(
    `SELECT u.id, u.name, u.birth_date, u.time_zone, u.country, b.slug, b.bio, b.avatar_path, b.color1, b.color2, b.is_public, b.vis_country
     FROM boards b JOIN users u ON u.id=b.user_id`
  ).all();

  const myFollows = me
    ? new Set(db.prepare('SELECT target_id FROM connections WHERE follower_id=?').all(me.id).map(r => r.target_id))
    : new Set();

  const openBoards = rows
    .filter(r => r.is_public || myFollows.has(r.id) || (me && me.id === r.id))
    .map(r => ({ ...r, phase: getPhase(r.birth_date, r.time_zone), days: daysUntilBirthday(r.birth_date, r.time_zone) }))
    .filter(r => r.phase === 'vault' || r.phase === 'reveal')
    .sort((a, b) => a.days - b.days);

  return (
    <>
      <h1>🎉 Celebrations Open Now</h1>
      <p className="muted">Boards in Open Vault or Birthday Reveal right now — send a message, photo, voice note, or memory.</p>

      {openBoards.length === 0 ? (
        <div className="card muted">No celebration boards are open right now. Check <Link href="/explore">Explore</Link> for upcoming birthdays!</div>
      ) : (
        <div className="grid">
          {openBoards.map(r => (
            <Link key={r.slug} href={`/b/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ borderTop: `5px solid ${r.color1}`, marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  {r.avatar_path ? (
                    <img src={`/api/avatar/${r.id}`} alt={r.name} className="avatar" style={{ width: 48, height: 48, fontSize: '1rem' }} />
                  ) : (
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: '1rem', background: `linear-gradient(135deg, ${r.color1}, ${r.color2})` }}>
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong>{r.name}</strong>
                    <div className="note">{r.vis_country !== 'private' ? r.country : 'Celebrating globally'}</div>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: '.85rem' }}>{r.bio || 'Open for birthday wishes!'}</p>
                <span className="pill rose">{r.phase === 'reveal' ? '🎉 Birthday Today!' : `🎁 Open Vault · ${r.days}d to go`}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
