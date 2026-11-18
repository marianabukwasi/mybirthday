import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { saveProfile, deleteAccount } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings & Privacy · mybirthday.life' };

export default async function SettingsPage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  const b = db.prepare('SELECT * FROM boards WHERE user_id=?').get(u.id);

  return (
    <>
      <h1>⚙️ Settings &amp; Privacy</h1>
      <p className="muted">Control what others see on your profile and birthday board at any time.</p>

      <div className="card">
        <h3>Field-Level Visibility &amp; Board Access</h3>
        <form action={saveProfile}>
          <input type="hidden" name="bio" value={b.bio} />
          <input type="hidden" name="likes" value={b.likes} />
          <input type="hidden" name="favorites" value={b.favorites || ''} />
          <input type="hidden" name="color1" value={b.color1} />
          <input type="hidden" name="color2" value={b.color2} />
          <input type="hidden" name="live_title" value={b.live_title || 'Cut the Cake With Me'} />

          <div className="row">
            <div><label>Age visibility</label><select name="vis_age" defaultValue={b.vis_age || 'private'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
            <div><label>Birthday date visibility</label><select name="vis_birthday" defaultValue={b.vis_birthday || 'public'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
            <div><label>Country visibility</label><select name="vis_country" defaultValue={b.vis_country || 'public'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
            <div><label>Biography visibility</label><select name="vis_bio" defaultValue={b.vis_bio || 'public'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
            <div><label>Interests &amp; favourites visibility</label><select name="vis_likes" defaultValue={b.vis_likes || 'public'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
            <div><label>Wishlist visibility</label><select name="vis_wishlist" defaultValue={b.vis_wishlist || 'public'}><option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private (Hidden)</option></select></div>
          </div>

          <label>Who can contribute to your birthday board?</label>
          <select name="who_can_contribute" defaultValue={b.who_can_contribute || 'anyone'}>
            <option value="anyone">Anyone with the link</option>
            <option value="friends">Connected friends only</option>
          </select>

          <label style={{ marginTop: 12 }}>
            <input type="checkbox" name="is_public" defaultChecked={!!b.is_public} /> Public birthday board (untick to keep private &amp; excluded from discovery)
          </label>
          <label>
            <input type="checkbox" name="allow_late" defaultChecked={!!b.allow_late} /> Allow late wishes during the 30-day Afterglow
          </label>

          <p><button className="btn">Save Privacy Settings</button></p>
        </form>
        <p className="note">Protected birth date (locked after setup): {u.birth_date} · Home time zone: {u.time_zone}</p>
      </div>

      <div className="card">
        <h3>Delete Account</h3>
        <p className="muted">Permanently delete your profile, birthday board, wishes, connections, and uploaded media.</p>
        <form action={deleteAccount}>
          <button className="btn ghost" type="submit">Delete my account permanently</button>
        </form>
      </div>
    </>
  );
}
