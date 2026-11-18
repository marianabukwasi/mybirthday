import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { getPhase, daysUntilBirthday, canSendWishes, cashEnabledFor, getAge, formatBirthdayLabel } from '../../../lib/phase';
import { WishForm, CashGiftForm } from '../../forms';
import { BirthdayCountdown } from '../../countdown';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = db.prepare('SELECT u.name FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?').get(slug);
  return { title: r ? `Celebrate ${r.name} · mybirthday.life` : 'Board not found' };
}

export default async function BoardPage({ params }) {
  const { slug } = await params;
  const b = db.prepare(
    `SELECT b.*, u.name, u.birth_date, u.time_zone, u.country, u.id AS uid FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?`
  ).get(slug);
  if (!b) notFound();
  const me = await currentUser();
  const isOwner = me?.id === b.uid;
  if (!b.is_public && !isOwner) {
    return <div className="card"><h1>Private board</h1><p className="muted">This board is private.</p></div>;
  }
  const phase = getPhase(b.birth_date, b.time_zone);
  const days = daysUntilBirthday(b.birth_date, b.time_zone);
  const first = b.name.split(' ')[0];
  const age = getAge(b.birth_date);
  const bdayLabel = formatBirthdayLabel(b.birth_date);
  const canSee = (vis) => isOwner || vis === 'public' || (vis === 'friends' && !!me);
  const showAge = canSee(b.vis_age || 'private') && age !== null;
  const showBirthday = canSee(b.vis_birthday || 'public');
  const showCountry = canSee(b.vis_country || 'public');
  const showBio = canSee(b.vis_bio || 'public');
  const showLikes = canSee(b.vis_likes || 'public');
  const showWishlist = canSee(b.vis_wishlist || 'public');

  const requests = db.prepare('SELECT id, title FROM requests WHERE board_id=?').all(b.id).map(r => ({ id: r.id, title: r.title }));
  const wishlist = showWishlist ? db.prepare('SELECT * FROM wishlist WHERE board_id=?').all(b.id) : [];
  const count = db.prepare("SELECT COUNT(*) c FROM wishes WHERE board_id=? AND status!='removed'").get(b.id).c;
  const open = canSendWishes(phase, b.allow_late);
  // Contents are never sent to the page before the reveal. Only a count.
  const revealed = phase === 'reveal' || phase === 'afterglow';
  const wishes = revealed
    ? db.prepare("SELECT id, guest_name, guest_city, kind, message, request_title, reply FROM wishes WHERE board_id=? AND status='ok' ORDER BY id DESC").all(b.id)
    : [];

  return (
    <>
      <div className="hero" style={{ borderColor: b.color1 }}>
        <span className="pill">{{ supporter: 'Archived', countdown: `Countdown · ${days} days`, vault: `🎁 Collecting Birthday Surprises · ${days} days to go`, reveal: '🎉 It\'s the birthday!', afterglow: 'Afterglow' }[phase]}</span>
        <h1 style={{ fontSize: '2.2rem', background: `linear-gradient(135deg,${b.color1},${b.color2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{b.name}</h1>
        <p className="muted">
          {showCountry ? b.country : 'Global Celebrant'}
          {showBirthday ? ` · 🎂 ${bdayLabel}` : ''}
          {showAge ? ` · Turning ${age + (days === 0 ? 0 : 1)}` : ''}
          {showBio && b.bio ? ` · ${b.bio}` : ''}
        </p>
        {showLikes && b.likes && <p>{b.likes.split(',').map(l => <span key={l} className="pill" style={{ marginRight: 6 }}>{l.trim()}</span>)}</p>}
        {showLikes && b.favorites && <p className="note"><strong>Favourite things:</strong> {b.favorites}</p>}
        <BirthdayCountdown birthDate={b.birth_date} timeZone={b.time_zone} ownerName={first} phase={phase} wishCount={count} color1={b.color1} color2={b.color2} />
        <p style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn pink" href={`/b/${b.slug}/live`}>🕯️ Join Live Celebration Room</Link>
          <Link className="btn ghost" href={`/b/${b.slug}/keepsake`}>🎞️ Compiled Video &amp; Keepsake Card</Link>
        </p>
      </div>

      {requests.length > 0 && (
        <div className="card"><h3>What {first} would love</h3><ul>{requests.map(r => <li key={r.id}>{r.title}</li>)}</ul></div>
      )}

      {open ? (
        <div className="card"><h3>Send {first} a wish</h3>
          <p className="muted">Wrapped up as a surprise until 00:00 on the birthday ({b.time_zone}).</p>
          <WishForm slug={b.slug} requests={requests} ownerName={first} />
        </div>
      ) : (
        <div className="card muted">{phase === 'afterglow' ? 'New wishes are closed.' : phase === 'countdown' ? `The Birthday Surprise Box opens in ${days - 90} day(s).` : 'This board is not open right now.'}</div>
      )}

      <div className="card" id="wishes-section">
        <h3>{revealed ? `${count} wishes` : `${count} birthday wishes wrapped & waiting`}</h3>
        {!revealed && <div className="sealed">🎁 Every wish is wrapped up as a birthday surprise until midnight!</div>}
        {revealed && wishes.map(w => (
          <div key={w.id} style={{ borderTop: '1px solid #e2e8f0', padding: '.8rem 0' }}>
            <strong>{w.guest_name}</strong> <span className="note">{w.guest_city}</span>
            {w.request_title && <div className="note">For: {w.request_title}</div>}
            {w.message && <p>“{w.message}”</p>}
            {w.reply && <p className="ok"><strong>{first}:</strong> {w.reply}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Wishlist &amp; Monetary Contributions</h3>
        {!showWishlist ? (
          <p className="muted">Wishlist is private.</p>
        ) : wishlist.length === 0 ? (
          <p className="muted">No wishlist items yet.</p>
        ) : (
          <ul>{wishlist.map(w => <li key={w.id}>{w.url ? <a href={w.url} target="_blank" rel="noopener noreferrer nofollow">{w.title}</a> : w.title}</li>)}</ul>
        )}
        {!cashEnabledFor(b.country) ? (
          <p className="note">Cash gifts are not available for boards in {b.country} yet. Wishes, photos, voice notes and videos work in full.</p>
        ) : (
          <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '.85rem' }}>
            <h4 style={{ margin: '0 0 .25rem' }}>Send a Cash Gift (Direct Payout at 00:00)</h4>
            <p className="note">The company never holds funds. Sender covers fees so {first} receives 100%.</p>
            <CashGiftForm slug={b.slug} ownerName={first} />
          </div>
        )}
      </div>
    </>
  );
}
