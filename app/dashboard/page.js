import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { getPhase, daysUntilBirthday } from '../../lib/phase';
import { saveProfile, addRequest, addWishlist, replyToWish, reportWish, deleteAccount } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My board · mybirthday.life' };

export default async function Dashboard() {
  const u = await currentUser();
  if (!u) redirect('/login');
  const b = db.prepare('SELECT * FROM boards WHERE user_id=?').get(u.id);
  const phase = getPhase(u.birth_date, u.time_zone);
  const days = daysUntilBirthday(u.birth_date, u.time_zone);
  const revealed = phase === 'reveal' || phase === 'afterglow';
  const requests = db.prepare('SELECT * FROM requests WHERE board_id=?').all(b.id);
  const wishlist = db.prepare('SELECT * FROM wishlist WHERE board_id=?').all(b.id);
  const count = db.prepare("SELECT COUNT(*) c FROM wishes WHERE board_id=? AND status!='removed'").get(b.id).c;
  // Before the reveal the owner sees ONLY counts and anonymous locations.
  const pings = db.prepare("SELECT guest_city c, COUNT(*) n FROM wishes WHERE board_id=? AND guest_city!='' GROUP BY guest_city").all(b.id);
  const wishes = revealed ? db.prepare("SELECT * FROM wishes WHERE board_id=? AND status!='removed' ORDER BY id DESC").all(b.id) : [];

  const phaseLabels = { supporter: 'Supporter Mode', countdown: 'Countdown', vault: 'Collecting Surprises', reveal: 'Birthday Reveal!', afterglow: 'Afterglow' };

  return (
    <>
      <h1>Hi {u.name.split(' ')[0]} 👋</h1>
      <div className="grid">
        <div className="card"><div className="muted">Phase</div><div className="stat">{phaseLabels[phase]}</div><div className="note">{days === 0 ? 'Happy birthday!' : `${days} days to your birthday`}</div></div>
        <div className="card"><div className="muted">Wishes</div><div className="stat">{count}</div><div className="note">{revealed ? 'Unwrapped!' : 'Wrapped up until your birthday'}</div></div>
        <div className="card"><div className="muted">Your link</div><a href={`/b/${b.slug}`}>/b/{b.slug}</a><div className="note">Share this with the people who love you</div></div>
      </div>

      {!revealed && (
        <div className="card"><h3>Celebration Pings Around the World</h3>
          {pings.length === 0 ? <p className="muted">No wishes yet.</p> : pings.map(p => <span key={p.c} className="pill" style={{ marginRight: 6 }}>📍 {p.c} ({p.n})</span>)}
          <p className="note">You see counts and places only. Names and messages stay wrapped up as a surprise until 00:00 on your birthday.</p>
        </div>
      )}

      <div className="card"><h3>Your board</h3>
        <form action={saveProfile}>
          <label>Bio</label><textarea name="bio" rows={2} defaultValue={b.bio} />
          <label>Likes (comma separated)</label><input name="likes" defaultValue={b.likes} />
          <div className="row"><div><label>Colour 1</label><input type="color" name="color1" defaultValue={b.color1} /></div><div><label>Colour 2</label><input type="color" name="color2" defaultValue={b.color2} /></div></div>
          <label><input type="checkbox" name="is_public" defaultChecked={!!b.is_public} /> Public board (untick for private)</label>
          <label><input type="checkbox" name="allow_late" defaultChecked={!!b.allow_late} /> Allow late wishes during the 30 days after my birthday</label>
          <p><button className="btn">Save</button></p>
        </form>
        <p className="note">Birth date: {u.birth_date} (locked) · {u.time_zone}</p>
      </div>

      <div className="grid">
        <div className="card"><h3>Requests</h3>
          <ul>{requests.map(r => <li key={r.id}>{r.title}</li>)}</ul>
          <form action={addRequest}><input name="title" placeholder="e.g. A photo of autumn where you are" required /><p><button className="btn ghost">Add request</button></p></form>
        </div>
        <div className="card"><h3>Wishlist</h3>
          <ul>{wishlist.map(r => <li key={r.id}>{r.title}</li>)}</ul>
          <form action={addWishlist}><input name="title" placeholder="Item" required /><input name="url" placeholder="https://… (optional)" style={{ marginTop: 6 }} /><p><button className="btn ghost">Add item</button></p></form>
        </div>
      </div>

      {revealed && (
        <div className="card"><h3>🎉 Your wishes</h3>
          {wishes.length === 0 && <p className="muted">No wishes.</p>}
          {wishes.map(w => (
            <div key={w.id} style={{ borderTop: '1px solid #e2e8f0', padding: '.8rem 0' }}>
              <strong>{w.guest_name}</strong> <span className="note">{w.guest_city} · {w.kind}</span>
              {w.message && <p>“{w.message}”</p>}
              {w.media_path && (w.kind === 'photo' ? <img src={`/media/${w.id}`} alt="" style={{ maxWidth: 320, borderRadius: 8 }} />
                : w.kind === 'voice' ? <audio controls src={`/media/${w.id}`} />
                : <video controls src={`/media/${w.id}`} style={{ maxWidth: 360 }} />)}
              <form action={replyToWish} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input type="hidden" name="id" value={w.id} />
                <input name="reply" placeholder="Say thank you…" defaultValue={w.reply} />
                <button className="btn ghost">Reply</button>
              </form>
              <form action={reportWish}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="reason" value="Reported by owner" /><button className="btn ghost" style={{ marginTop: 6 }}>⚑ Report</button></form>
            </div>
          ))}
        </div>
      )}

      <div className="card"><h3>Delete my account</h3>
        <p className="muted">Permanently deletes your board, wishes and uploads.</p>
        <form action={deleteAccount}><button className="btn ghost">Delete everything</button></form>
      </div>
    </>
  );
}
