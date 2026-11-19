import Link from 'next/link';
import { db } from '../lib/db';
import { currentUser } from '../lib/auth';
import { getPhase, getZodiac, daysUntilBirthday, formatBirthdayLabel } from '../lib/phase';
import { CelebrationGlobe } from './globe';

export const dynamic = 'force-dynamic';

const ALL_SIGNS = [
  ['Aries', '♈'], ['Taurus', '♉'], ['Gemini', '♊'], ['Cancer', '♋'],
  ['Leo', '♌'], ['Virgo', '♍'], ['Libra', '♎'], ['Scorpio', '♏'],
  ['Sagittarius', '♐'], ['Capricorn', '♑'], ['Aquarius', '♒'], ['Pisces', '♓'],
];

export default async function Home() {
  const me = await currentUser();
  const users = db.prepare(
    `SELECT u.id, u.name, u.birth_date, u.time_zone, u.country,
            b.slug, b.bio, b.avatar_path, b.color1, b.color2, b.is_public, b.vis_country, b.vis_birthday
     FROM users u JOIN boards b ON b.user_id=u.id`
  ).all();

  const enriched = users.map(u => ({
    ...u,
    phase: getPhase(u.birth_date, u.time_zone),
    days: daysUntilBirthday(u.birth_date, u.time_zone),
    zodiac: getZodiac(u.birth_date),
  }));

  const celebratingToday = enriched.filter(p => p.phase === 'reveal');
  const publicCelebrating = celebratingToday.filter(p => p.is_public);
  const publicOpen = enriched.filter(p => p.is_public && (p.phase === 'vault' || p.phase === 'reveal'));
  const privateTotal = enriched.filter(p => !p.is_public).length;
  const countries = new Set(users.map(u => u.country.trim().toLowerCase()).filter(Boolean)).size;

  const zodiacCounts = Object.fromEntries(ALL_SIGNS.map(([s]) => [s, 0]));
  for (const u of enriched) {
    if (zodiacCounts[u.zodiac] !== undefined) zodiacCounts[u.zodiac] += 1;
  }

  const upcomingPublic = enriched
    .filter(p => p.is_public && p.days > 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  const following = me
    ? db.prepare(
        `SELECT u.id, u.name, u.birth_date, u.time_zone, u.country, b.slug, b.avatar_path, b.color1, b.color2
         FROM connections c JOIN users u ON u.id=c.target_id JOIN boards b ON b.user_id=u.id
         WHERE c.follower_id=?`
      ).all(me.id).map(f => ({ ...f, days: daysUntilBirthday(f.birth_date, f.time_zone) }))
    : [];

  return (
    <>
      <section className="hero" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', lineHeight: 1.1, maxWidth: '18ch', margin: 0 }}>
          Everyone deserves to be celebrated.
        </h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn" href={me ? '/profile' : '/signup'}>
            {me ? 'Go to My Profile' : '🎂 Create my profile'}
          </Link>
          <Link className="btn ghost" href="/explore">✨ Explore the world</Link>
        </div>
        <div style={{ width: '100%' }}>
          <CelebrationGlobe boards={publicOpen} />
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="grid">
        <div className="card">
          <div className="note">Celebrating Today</div>
          <div className="stat">{celebratingToday.length}</div>
          <div className="note">Across all time zones</div>
        </div>
        <div className="card">
          <div className="note">Public Birthday Boards</div>
          <div className="stat">{publicOpen.length}</div>
          <div className="note">Open for wishes right now</div>
        </div>
        <div className="card">
          <div className="note">Private Boards (Aggregate)</div>
          <div className="stat">{privateTotal}</div>
          <div className="note">Private identities always protected</div>
        </div>
        <div className="card">
          <div className="note">Countries Represented</div>
          <div className="stat">{countries}</div>
          <div className="note"><Link href="/explore">See country breakdown →</Link></div>
        </div>
      </section>

      {/* Celebrating Today */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem' }}>
          <div>
            <h2>🎉 Celebrating Today</h2>
            <p className="note">Public members whose birthday is right now in their home time zone.</p>
          </div>
          <Link className="btn ghost btn-sm" href="/celebrations">See all open boards</Link>
        </div>
        {publicCelebrating.length === 0 ? (
          <p className="muted">No public birthdays today yet — check upcoming celebrations below or <Link href="/explore">explore all members</Link>.</p>
        ) : (
          <div className="grid">
            {publicCelebrating.map(p => (
              <Link key={p.slug} href={`/b/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ marginBottom: 0, borderTop: `4px solid ${p.color1}` }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {p.avatar_path ? (
                      <img src={`/api/avatar/${p.id}`} alt={p.name} className="avatar" />
                    ) : (
                      <div className="avatar" style={{ background: `linear-gradient(135deg, ${p.color1}, ${p.color2})` }}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <strong>{p.name}</strong>
                      <div className="note">{p.vis_country !== 'private' ? p.country : 'Celebrating globally'} · {p.zodiac}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Following + Upcoming Birthdays */}
      <section className="grid-2">
        <div className="card">
          <h3>🎂 Upcoming Public Birthdays</h3>
          {upcomingPublic.length === 0 ? (
            <p className="muted">No upcoming public birthdays yet. <Link href="/signup">Create the first profile!</Link></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingPublic.map(p => (
                <Link key={p.slug} href={`/b/${p.slug}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem .8rem', borderRadius: 12, background: '#fffcf7', border: '1px solid var(--line)', color: 'inherit', textDecoration: 'none' }}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="note">
                      {p.vis_country !== 'private' ? p.country : 'Global'}
                      {p.vis_birthday !== 'private' ? ` · ${formatBirthdayLabel(p.birth_date)}` : ''}
                    </div>
                  </div>
                  <span className="pill">{p.days}d</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>💛 People You Follow</h3>
          {!me ? (
            <p className="muted"><Link href="/login">Log in</Link> or <Link href="/signup">create a profile</Link> to follow friends and see their upcoming birthdays here.</p>
          ) : following.length === 0 ? (
            <p className="muted">You aren&apos;t following anyone yet. Visit <Link href="/explore">Explore</Link> to connect with people!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {following.map(f => (
                <Link key={f.slug} href={`/b/${f.slug}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem .8rem', borderRadius: 12, background: '#fffcf7', border: '1px solid var(--line)', color: 'inherit', textDecoration: 'none' }}>
                  <div><strong>{f.name}</strong><div className="note">{f.country}</div></div>
                  <span className="pill rose">{f.days === 0 ? 'Today!' : `${f.days}d`}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Zodiac Communities */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: '.85rem' }}>
          <div>
            <h3>✨ Zodiac Communities</h3>
            <p className="note">Explore all twelve signs across the platform.</p>
          </div>
          <Link className="btn ghost btn-sm" href="/explore">Explore by sign →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {ALL_SIGNS.map(([sign, symbol]) => (
            <Link key={sign} href={`/explore?sign=${sign}`} style={{ background: '#fffcf7', border: '1px solid var(--line)', borderRadius: 14, padding: '.7rem .85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none' }}>
              <span><span style={{ marginRight: 6 }}>{symbol}</span><strong>{sign}</strong></span>
              <span className="pill">{zodiacCounts[sign]}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
