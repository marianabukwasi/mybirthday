import Link from 'next/link';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { getPhase } from '../../lib/phase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live Celebrations · mybirthday.life' };

export default async function LiveHubPage() {
  const me = await currentUser();
  const myBoard = me ? db.prepare('SELECT slug, live_title FROM boards WHERE user_id=?').get(me.id) : null;

  const publicBoards = db.prepare(
    `SELECT u.id, u.name, u.birth_date, u.time_zone, u.country, b.slug, b.live_title, b.color1, b.color2
     FROM boards b JOIN users u ON u.id=b.user_id WHERE b.is_public=1`
  ).all().map(r => ({ ...r, phase: getPhase(r.birth_date, r.time_zone) }));

  const activeLive = publicBoards.filter(r => r.phase === 'reveal' || r.phase === 'vault');

  return (
    <>
      <h1>🕯️ Live Birthday Celebrations</h1>
      <p className="muted">Host or join a live celebration room (up to 60 minutes) to cut the cake, sing along, and celebrate together.</p>

      {myBoard && (
        <div className="hero" style={{ padding: '1.5rem' }}>
          <span className="pill rose">Your Live Room</span>
          <h3 style={{ marginTop: 8 }}>{myBoard.live_title || 'Cut the Cake With Me'}</h3>
          <p className="muted">Start your 60-minute live celebration and share the link via WhatsApp, Instagram, or TikTok.</p>
          <Link className="btn" href={`/b/${myBoard.slug}/live`}>🕯️ Open My Live Room</Link>
        </div>
      )}

      <div className="card">
        <h3>Public Celebration Rooms</h3>
        {activeLive.length === 0 ? (
          <p className="muted">No public live sessions are active right now.</p>
        ) : (
          <div className="grid">
            {activeLive.map(b => (
              <div key={b.slug} className="card" style={{ borderTop: `4px solid ${b.color1}`, marginBottom: 0 }}>
                <span className="pill">{b.phase === 'reveal' ? '🎉 Birthday Today' : '🎂 Upcoming Celebration'}</span>
                <h4 style={{ marginTop: 8 }}>{b.live_title || 'Cut the Cake With Me'}</h4>
                <div className="note">Hosted by {b.name} · {b.country}</div>
                <p style={{ marginTop: 10 }}><Link className="btn btn-sm" href={`/b/${b.slug}/live`}>Join Live Room →</Link></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
