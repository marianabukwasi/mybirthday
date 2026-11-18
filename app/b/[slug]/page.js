import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { getPhase, daysUntilBirthday, canSendWishes, cashEnabledFor, getAge, formatBirthdayLabel, getZodiac } from '../../../lib/phase';
import { WishForm, CashGiftForm } from '../../forms';
import { BirthdayCountdown } from '../../countdown';
import { toggleConnection, claimWishlist } from '../../actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = db.prepare('SELECT u.name FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?').get(slug);
  return { title: r ? `Celebrate ${r.name} · mybirthday.life` : 'Board not found' };
}

export default async function BoardPage({ params }) {
  const { slug } = await params;
  const b = db.prepare(
    `SELECT b.*, u.name, u.birth_date, u.time_zone, u.country, u.id AS uid
     FROM boards b JOIN users u ON u.id=b.user_id WHERE b.slug=?`
  ).get(slug);
  if (!b) notFound();

  const me = await currentUser();
  const isOwner = me?.id === b.uid;
  const isConnected = !!(me && db.prepare('SELECT 1 FROM connections WHERE follower_id=? AND target_id=?').get(me.id, b.uid));

  if (!b.is_public && !isOwner && !isConnected) {
    return (
      <div className="card">
        <h1>🔒 Private Birthday Board</h1>
        <p className="muted">This board is private. Only invited or connected friends can view it.</p>
      </div>
    );
  }

  const phase = getPhase(b.birth_date, b.time_zone);
  const days = daysUntilBirthday(b.birth_date, b.time_zone);
  const first = b.name.split(' ')[0];
  const age = getAge(b.birth_date);
  const bdayLabel = formatBirthdayLabel(b.birth_date);
  const zodiac = getZodiac(b.birth_date);

  const canSee = (vis) => isOwner || vis === 'public' || (vis === 'friends' && isConnected);
  const showAge = canSee(b.vis_age || 'private') && age !== null;
  const showBirthday = canSee(b.vis_birthday || 'public');
  const showCountry = canSee(b.vis_country || 'public');
  const showBio = canSee(b.vis_bio || 'public');
  const showLikes = canSee(b.vis_likes || 'public');
  const showWishlist = canSee(b.vis_wishlist || 'public');

  const requests = db.prepare('SELECT id, title FROM requests WHERE board_id=?').all(b.id).map(r => ({ id: r.id, title: r.title }));
  const wishlist = showWishlist ? db.prepare('SELECT * FROM wishlist WHERE board_id=?').all(b.id) : [];
  const count = db.prepare("SELECT COUNT(*) c FROM wishes WHERE board_id=? AND status!='removed'").get(b.id).c;

  const canContribute = canSendWishes(phase, b.allow_late) && (b.who_can_contribute !== 'friends' || isOwner || isConnected);
  const revealed = phase === 'reveal' || phase === 'afterglow';
  const wishes = revealed
    ? db.prepare("SELECT id, guest_name, guest_city, guest_country, kind, message, request_title, reply FROM wishes WHERE board_id=? AND status='ok' ORDER BY id DESC").all(b.id)
    : [];

  const phasePill = {
    supporter: 'Supporter Mode · Archived',
    countdown: `Countdown · ${days} days to go`,
    vault: `🎁 Open Vault · ${days} days to go`,
    reveal: '🎉 Happy Birthday Today!',
    afterglow: '✨ Birthday Afterglow',
  }[phase];

  return (
    <>
      <div className="hero" style={{ borderTop: `6px solid ${b.color1}` }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {b.avatar_path ? (
            <img src={`/api/avatar/${b.uid}`} alt={b.name} className="avatar avatar-lg" />
          ) : (
            <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${b.color1}, ${b.color2})` }}>
              {b.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span className="pill rose">{phasePill}</span>
            <h1 style={{ fontSize: '2.2rem', marginTop: 6 }}>{b.name}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {showCountry ? b.country : 'Global Celebrant'}
              {' · '}{zodiac}
              {showBirthday ? ` · 🎂 ${bdayLabel}` : ''}
              {showAge ? ` · Turning ${age + (days === 0 ? 0 : 1)}` : ''}
            </p>
          </div>
          {me && !isOwner && (
            <form action={toggleConnection}>
              <input type="hidden" name="target_id" value={b.uid} />
              <button className="btn ghost btn-sm" type="submit">
                {isConnected ? '✓ Following' : '+ Follow'}
              </button>
            </form>
          )}
        </div>

        {showBio && b.bio && <p className="muted">{b.bio}</p>}
        {showLikes && b.likes && (
          <p>{b.likes.split(',').map(l => <span key={l} className="pill" style={{ marginRight: 6 }}>{l.trim()}</span>)}</p>
        )}
        {showLikes && b.favorites && <p className="note"><strong>Favourite things:</strong> {b.favorites}</p>}

        <BirthdayCountdown
          birthDate={b.birth_date}
          timeZone={b.time_zone}
          ownerName={first}
          phase={phase}
          wishCount={count}
          color1={b.color1}
          color2={b.color2}
        />

        <div style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href={`/b/${b.slug}/live`}>🕯️ {b.live_title || 'Cut the Cake With Me'}</Link>
          <Link className="btn ghost" href={`/b/${b.slug}/keepsake`}>🎞️ Video &amp; Keepsake Card</Link>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="card">
          <h3>✨ What {first} Would Love</h3>
          <ul>{requests.map(r => <li key={r.id}>{r.title}</li>)}</ul>
        </div>
      )}

      {canContribute ? (
        <div className="card">
          <h3>💌 Celebrate {first}</h3>
          <p className="muted">Contributions stay hidden in the Open Vault until 00:00 on {first}&apos;s birthday ({b.time_zone}).</p>
          <WishForm slug={b.slug} requests={requests} ownerName={first} />
        </div>
      ) : (
        <div className="card muted">
          {b.who_can_contribute === 'friends' && !isOwner && !isConnected
            ? 'Only connected friends can contribute to this board.'
            : phase === 'afterglow'
            ? 'New birthday wishes are closed for this cycle.'
            : phase === 'countdown'
            ? `The Open Vault opens in ${days - 90} day(s).`
            : 'This board is in Supporter Mode right now.'}
        </div>
      )}

      <div className="card" id="wishes-section">
        <h3>{revealed ? `🎉 ${count} Birthday Wishes` : `🎁 ${count} Birthday Wishes in the Open Vault`}</h3>
        {!revealed && <div className="sealed">🎁 Every message, photograph, postcard, voice note, and video stays hidden until midnight on {first}&apos;s birthday!</div>}
        {revealed && wishes.length === 0 && <p className="muted">No wishes yet.</p>}
        {revealed && wishes.map(w => (
          <div key={w.id} style={{ borderTop: '1px solid var(--line)', padding: '.9rem 0' }}>
            <strong>{w.guest_name}</strong> <span className="note">{w.guest_country || w.guest_city} · {w.kind}</span>
            {w.request_title && <div className="note">For request: {w.request_title}</div>}
            {w.message && <p>“{w.message}”</p>}
            {w.reply && <p className="ok"><strong>{first}:</strong> {w.reply}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>🎀 Wishlist &amp; Monetary Gifts</h3>
        {!showWishlist ? (
          <p className="muted">This wishlist is private.</p>
        ) : wishlist.length === 0 ? (
          <p className="muted">No wishlist items added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1rem' }}>
            {wishlist.map(w => (
              <div key={w.id} style={{ padding: '.75rem', borderRadius: 12, background: '#fffcf7', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{w.url ? <a href={w.url} target="_blank" rel="noopener noreferrer nofollow">{w.title}</a> : w.title}</strong>
                  {w.description && <div className="note">{w.description}</div>}
                </div>
                {w.claimed_by ? (
                  <span className="pill">🎁 Gifted</span>
                ) : (
                  <form action={claimWishlist}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="slug" value={b.slug} />
                    <button className="btn ghost btn-sm" type="submit">Mark as Gifted</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {!cashEnabledFor(b.country) ? (
          <p className="note">
            Integrated monetary gifts are not available in {b.country} yet. You can celebrate {first} with wishes, photographs, postcards, voice notes, videos, and live celebrations in full!
          </p>
        ) : (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '.9rem' }}>
            <h4 style={{ margin: '0 0 .25rem' }}>Send a Monetary Birthday Gift</h4>
            <p className="note">Processed through our payment provider (mybirthday.life never holds customer funds). Sender covers processing fees.</p>
            <CashGiftForm slug={b.slug} ownerName={first} />
          </div>
        )}
      </div>
    </>
  );
}
