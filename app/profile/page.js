import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { getPhase, daysUntilBirthday, getZodiac } from '../../lib/phase';
import { saveProfile, addRequest, deleteRequest, replyToWish, reportWish } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Profile · mybirthday.life' };

export default async function ProfilePage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  const b = db.prepare('SELECT * FROM boards WHERE user_id=?').get(u.id);
  const phase = getPhase(u.birth_date, u.time_zone);
  const days = daysUntilBirthday(u.birth_date, u.time_zone);
  const zodiac = getZodiac(u.birth_date);
  const revealed = phase === 'reveal' || phase === 'afterglow';

  const requests = db.prepare('SELECT * FROM requests WHERE board_id=?').all(b.id);
  const count = db.prepare("SELECT COUNT(*) c FROM wishes WHERE board_id=? AND status!='removed'").get(b.id).c;
  const followers = db.prepare('SELECT COUNT(*) c FROM connections WHERE target_id=?').get(u.id).c;
  const following = db.prepare('SELECT COUNT(*) c FROM connections WHERE follower_id=?').get(u.id).c;
  const pings = db.prepare("SELECT COALESCE(NULLIF(guest_country,''), guest_city) c, COUNT(*) n FROM wishes WHERE board_id=? AND (guest_country!='' OR guest_city!='') GROUP BY c").all(b.id);
  const wishes = revealed ? db.prepare("SELECT * FROM wishes WHERE board_id=? AND status!='removed' ORDER BY id DESC").all(b.id) : [];

  const phaseLabel = {
    supporter: 'Supporter Mode',
    countdown: 'Countdown Preparation',
    vault: 'Open Vault',
    reveal: 'Birthday Reveal!',
    afterglow: 'Afterglow',
  }[phase];

  return (
    <>
      <div className="hero" style={{ borderTop: `6px solid ${b.color1}` }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {b.avatar_path ? (
            <img src={`/api/avatar/${u.id}`} alt={u.name} className="avatar avatar-lg" />
          ) : (
            <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${b.color1}, ${b.color2})` }}>
              {u.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span className="pill rose">{phaseLabel}</span>
            <h1 style={{ marginTop: 6 }}>{u.name}</h1>
            <div className="muted">{u.country} · {zodiac} · {followers} followers · {following} following</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/b/${b.slug}`}>View My Board</Link>
            <Link className="btn ghost" href="/settings">⚙️ Privacy &amp; Settings</Link>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card"><div className="note">Birthday Countdown</div><div className="stat">{days === 0 ? 'Today!' : `${days} days`}</div><div className="note">{u.time_zone}</div></div>
        <div className="card"><div className="note">Open Vault Wishes</div><div className="stat">{count}</div><div className="note">{revealed ? 'Unlocked!' : 'Hidden until midnight'}</div></div>
        <div className="card"><div className="note">Shareable Board Link</div><Link href={`/b/${b.slug}`}>/b/{b.slug}</Link><div className="note">Invite friends &amp; family</div></div>
      </div>

      {!revealed && (
        <div className="card">
          <h3>🌍 Anonymous Celebration Pings</h3>
          <p className="note">During Open Vault you see counts and countries only—names and messages stay hidden until 00:00 on your birthday.</p>
          {pings.length === 0 ? <p className="muted">No contributions yet.</p> : pings.map(p => <span key={p.c} className="pill" style={{ marginRight: 6 }}>📍 {p.c} ({p.n})</span>)}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Personalise Profile &amp; Appearance</h3>
          <form action={saveProfile} encType="multipart/form-data">
            <input type="hidden" name="vis_age" value={b.vis_age || 'private'} />
            <input type="hidden" name="vis_birthday" value={b.vis_birthday || 'public'} />
            <input type="hidden" name="vis_country" value={b.vis_country || 'public'} />
            <input type="hidden" name="vis_bio" value={b.vis_bio || 'public'} />
            <input type="hidden" name="vis_likes" value={b.vis_likes || 'public'} />
            <input type="hidden" name="vis_wishlist" value={b.vis_wishlist || 'public'} />
            <input type="hidden" name="who_can_contribute" value={b.who_can_contribute || 'anyone'} />
            {b.is_public ? <input type="hidden" name="is_public" value="1" /> : null}
            {b.allow_late ? <input type="hidden" name="allow_late" value="1" /> : null}

            <label>Profile photograph</label>
            <input name="avatar" type="file" accept="image/*" />
            <label>Biography / About</label>
            <textarea name="bio" rows={3} defaultValue={b.bio} placeholder="Tell friends what makes you light up…" />
            <label>Interests &amp; hobbies (comma separated)</label>
            <input name="likes" defaultValue={b.likes} placeholder="Photography, Hiking, Jazz" />
            <label>Favourite things (comma separated)</label>
            <input name="favorites" defaultValue={b.favorites || ''} placeholder="Cinnamon buns, Vinyl records, Ocean swims" />
            <div className="row">
              <div><label>Personal colour 1</label><input type="color" name="color1" defaultValue={b.color1} /></div>
              <div><label>Personal colour 2</label><input type="color" name="color2" defaultValue={b.color2} /></div>
            </div>
            <label>Live session title</label>
            <select name="live_title" defaultValue={b.live_title || 'Cut the Cake With Me'}>
              <option>Cut the Cake With Me</option>
              <option>Birthday Dinner</option>
              <option>Birthday Party</option>
              <option>Celebrate With Me</option>
              <option>Birthday Countdown</option>
            </select>
            <p><button className="btn">Save Profile</button></p>
          </form>
        </div>

        <div className="card">
          <h3>Birthday Requests</h3>
          <p className="note">Ask friends for meaningful contributions—visitors can tap a request directly on your board.</p>
          {requests.length === 0 ? <p className="muted">No requests added yet.</p> : (
            <ul style={{ paddingLeft: 18 }}>
              {requests.map(r => (
                <li key={r.id} style={{ marginBottom: 6 }}>
                  {r.title}{' '}
                  <form action={deleteRequest} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" style={{ background: 'none', border: 0, color: 'var(--rose)', cursor: 'pointer', fontSize: '.78rem' }}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addRequest}>
            <input name="title" placeholder="e.g. Send me a photo of autumn where you live" required />
            <p><button className="btn ghost btn-sm">Add request</button></p>
          </form>
        </div>
      </div>

      {revealed && (
        <div className="card">
          <h3>🎉 Your Unlocked Birthday Wishes</h3>
          {wishes.length === 0 && <p className="muted">No wishes yet.</p>}
          {wishes.map(w => (
            <div key={w.id} style={{ borderTop: '1px solid var(--line)', padding: '.9rem 0' }}>
              <strong>{w.guest_name}</strong> <span className="note">{w.guest_country || w.guest_city} · {w.kind}</span>
              {w.message && <p>“{w.message}”</p>}
              {w.media_path && (
                w.kind === 'photo' || w.kind === 'postcard' ? <img src={`/media/${w.id}`} alt="" style={{ maxWidth: 320, borderRadius: 10 }} />
                : w.kind === 'voice' ? <audio controls src={`/media/${w.id}`} />
                : <video controls src={`/media/${w.id}`} style={{ maxWidth: 360, borderRadius: 10 }} />
              )}
              <form action={replyToWish} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="hidden" name="id" value={w.id} />
                <input name="reply" placeholder="Reply and say thank you…" defaultValue={w.reply} />
                <button className="btn ghost btn-sm">Reply</button>
              </form>
              <form action={reportWish} style={{ marginTop: 6 }}>
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="reason" value="Reported by owner" />
                <button className="btn ghost btn-sm" type="submit">⚑ Report</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
