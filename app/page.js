import Link from 'next/link';
import { db } from '../lib/db';
import { getPhase, getZodiac } from '../lib/phase';
import { CelebrationGlobe } from './globe';

export const dynamic = 'force-dynamic';

export default function Home() {
  const users = db.prepare(
    'SELECT u.name, u.birth_date, u.time_zone, u.country, b.slug, b.is_public FROM users u JOIN boards b ON b.user_id=u.id'
  ).all();

  const enriched = users.map(u => ({
    name: u.name,
    country: u.country,
    slug: u.slug,
    is_public: u.is_public,
    phase: getPhase(u.birth_date, u.time_zone),
    zodiac: getZodiac(u.birth_date),
  }));

  const celebrating = enriched.filter(p => p.phase === 'reveal').length;
  const openBoards = enriched.filter(p => p.phase === 'vault' || p.phase === 'reveal');
  const publicOpen = openBoards.filter(p => p.is_public);
  const privateCount = enriched.filter(p => !p.is_public).length;
  const countries = new Set(users.map(u => u.country.toLowerCase())).size;

  const zodiacCounts = {};
  for (const u of enriched) {
    zodiacCounts[u.zodiac] = (zodiacCounts[u.zodiac] || 0) + 1;
  }

  return (
    <>
      <div className="hero" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'center' }}>
        <div>
          <span className="pill pink">No endless feed · No bad news · Only celebrations</span>
          <h1 style={{ fontSize: '2.2rem' }}>Someone you love has a birthday coming up.</h1>
          <p className="muted">
            Every profile runs on a yearly cycle. For about 4 months a year your board is open for wishes, photos,
            voice notes and videos—wrapped up as a surprise until the stroke of midnight on your birthday.
          </p>
          <p><Link className="btn" href="/signup">Create my board</Link>{' '}<Link className="btn ghost" href="/boards">Boards open now</Link></p>
        </div>
        <CelebrationGlobe boards={publicOpen} />
      </div>

      <div className="grid">
        <div className="card"><div className="muted">Celebrating today</div><div className="stat">{celebrating}</div></div>
        <div className="card"><div className="muted">Open boards</div><div className="stat">{openBoards.length}</div><div className="note">{publicOpen.length} public · {privateCount} private</div></div>
        <div className="card"><div className="muted">Countries</div><div className="stat">{countries}</div></div>
      </div>

      <div className="card">
        <h3>Live Zodiac Count</h3>
        {Object.keys(zodiacCounts).length === 0 ? (
          <p className="muted">No profiles registered yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(zodiacCounts).map(([sign, n]) => (
              <span key={sign} className="pill">{sign}: {n}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
