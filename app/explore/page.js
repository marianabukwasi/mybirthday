import Link from 'next/link';
import { db } from '../../lib/db';
import { getPhase, getZodiac, daysUntilBirthday, formatBirthdayLabel } from '../../lib/phase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore · mybirthday.life' };

const ALL_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export default function ExplorePage() {
  const users = db.prepare(
    `SELECT u.name, u.birth_date, u.time_zone, u.country, b.slug, b.bio, b.color1, b.is_public, b.vis_country, b.vis_birthday
     FROM users u JOIN boards b ON b.user_id=u.id`
  ).all();

  const countryCounts = {};
  const zodiacCounts = Object.fromEntries(ALL_SIGNS.map(s => [s, 0]));

  for (const u of users) {
    const c = u.country.trim();
    if (c) countryCounts[c] = (countryCounts[c] || 0) + 1;
    const z = getZodiac(u.birth_date);
    if (zodiacCounts[z] !== undefined) zodiacCounts[z] += 1;
  }

  const publicBoards = users
    .filter(u => u.is_public)
    .map(u => ({
      ...u,
      phase: getPhase(u.birth_date, u.time_zone),
      days: daysUntilBirthday(u.birth_date, u.time_zone),
      zodiac: getZodiac(u.birth_date),
    }))
    .sort((a, b) => a.days - b.days);

  return (
    <>
      <h1>🌍 Explore Celebrations Around the World</h1>
      <p className="muted">Discover countries, zodiac communities, and upcoming public birthday boards.</p>

      <div className="card">
        <h3>Members by Country</h3>
        <p className="note">Aggregate counts only — private profiles stay completely private.</p>
        {Object.keys(countryCounts).length === 0 ? (
          <p className="muted">No countries represented yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).map(([country, n]) => (
              <span key={country} className="pill">{country} — {n}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Zodiac Communities</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 8 }}>
          {ALL_SIGNS.map(sign => (
            <div key={sign} style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '.55rem .75rem', display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
              <strong>{sign}</strong>
              <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{zodiacCounts[sign]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Public Profiles &amp; Upcoming Birthdays</h3>
        {publicBoards.length === 0 ? (
          <p className="muted">No public profiles yet.</p>
        ) : (
          <div className="grid">
            {publicBoards.map(b => (
              <Link key={b.slug} href={`/b/${b.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ borderTop: `4px solid ${b.color1}`, marginBottom: 0 }}>
                  <strong>{b.name}</strong>
                  <div className="note">
                    {b.vis_country !== 'private' ? b.country : 'Global'} · {b.zodiac}
                    {b.vis_birthday !== 'private' ? ` · ${formatBirthdayLabel(b.birth_date)}` : ''}
                  </div>
                  <p className="muted" style={{ fontSize: '.82rem', margin: '.4rem 0' }}>{b.bio}</p>
                  <span className="pill pink">{b.days === 0 ? '🎉 Today!' : `${b.days} days until birthday`}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
