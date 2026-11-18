import Link from 'next/link';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { getPhase, getZodiac, daysUntilBirthday, formatBirthdayLabel } from '../../lib/phase';
import { toggleConnection } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore · mybirthday.life' };

const ALL_SIGNS = [
  ['Aries', '♈'], ['Taurus', '♉'], ['Gemini', '♊'], ['Cancer', '♋'],
  ['Leo', '♌'], ['Virgo', '♍'], ['Libra', '♎'], ['Scorpio', '♏'],
  ['Sagittarius', '♐'], ['Capricorn', '♑'], ['Aquarius', '♒'], ['Pisces', '♓'],
];

export default async function ExplorePage({ searchParams }) {
  const sp = await searchParams;
  const activeSign = sp?.sign || null;
  const me = await currentUser();

  const users = db.prepare(
    `SELECT u.id, u.name, u.birth_date, u.time_zone, u.country,
            b.slug, b.bio, b.avatar_path, b.color1, b.color2, b.is_public, b.vis_country, b.vis_birthday
     FROM users u JOIN boards b ON b.user_id=u.id`
  ).all();

  const myFollows = me
    ? new Set(db.prepare('SELECT target_id FROM connections WHERE follower_id=?').all(me.id).map(r => r.target_id))
    : new Set();

  const countryCounts = {};
  const zodiacCounts = Object.fromEntries(ALL_SIGNS.map(([s]) => [s, 0]));

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
    .filter(u => !activeSign || u.zodiac === activeSign)
    .sort((a, b) => a.days - b.days);

  return (
    <>
      <h1>✨ Explore Celebrations</h1>
      <p className="muted">Discover people celebrating today, countries represented, and zodiac communities.</p>

      <div className="card">
        <h3>Countries Represented</h3>
        <p className="note">Aggregate counts only — private members are never exposed.</p>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: '.75rem' }}>
          <h3>Zodiac Communities</h3>
          {activeSign && <Link className="btn ghost btn-sm" href="/explore">Show all signs</Link>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {ALL_SIGNS.map(([sign, symbol]) => (
            <Link
              key={sign}
              href={activeSign === sign ? '/explore' : `/explore?sign=${sign}`}
              style={{
                background: activeSign === sign ? 'var(--rose-soft)' : '#fffcf7',
                border: `1px solid ${activeSign === sign ? 'var(--rose)' : 'var(--line)'}`,
                borderRadius: 12,
                padding: '.6rem .8rem',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'inherit',
                textDecoration: 'none',
                fontSize: '.86rem',
              }}
            >
              <span>{symbol} <strong>{sign}</strong></span>
              <span className="pill">{zodiacCounts[sign]}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>{activeSign ? `${activeSign} Public Celebrations` : 'Public Profiles & Upcoming Birthdays'}</h3>
        {publicBoards.length === 0 ? (
          <p className="muted">No public profiles match right now.</p>
        ) : (
          <div className="grid">
            {publicBoards.map(b => {
              const isFollowing = myFollows.has(b.id);
              return (
                <div key={b.slug} className="card" style={{ borderTop: `4px solid ${b.color1}`, marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      {b.avatar_path ? (
                        <img src={`/api/avatar/${b.id}`} alt={b.name} className="avatar" style={{ width: 48, height: 48, fontSize: '1rem' }} />
                      ) : (
                        <div className="avatar" style={{ width: 48, height: 48, fontSize: '1rem', background: `linear-gradient(135deg, ${b.color1}, ${b.color2})` }}>
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <Link href={`/b/${b.slug}`} style={{ color: 'var(--ink)' }}><strong>{b.name}</strong></Link>
                        <div className="note">
                          {b.vis_country !== 'private' ? b.country : 'Global'} · {b.zodiac}
                          {b.vis_birthday !== 'private' ? ` · ${formatBirthdayLabel(b.birth_date)}` : ''}
                        </div>
                      </div>
                    </div>
                    <p className="muted" style={{ fontSize: '.84rem' }}>{b.bio || 'Preparing for the next celebration!'}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
                    <Link className="btn btn-sm" href={`/b/${b.slug}`}>
                      {b.days === 0 ? '🎉 Celebrate Today' : `${b.days}d · Visit`}
                    </Link>
                    {me && me.id !== b.id && (
                      <form action={toggleConnection}>
                        <input type="hidden" name="target_id" value={b.id} />
                        <button className="btn ghost btn-sm" type="submit">
                          {isFollowing ? '✓ Following' : '+ Follow'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
