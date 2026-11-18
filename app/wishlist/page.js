import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { addWishlist } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Wishlist · mybirthday.life' };

export default async function WishlistPage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  const b = db.prepare('SELECT * FROM boards WHERE user_id=?').get(u.id);
  const items = db.prepare('SELECT * FROM wishlist WHERE board_id=? ORDER BY id DESC').all(b.id);

  return (
    <>
      <h1>🎀 My Birthday Wishlist</h1>
      <p className="muted">Add items, experiences, and links you&apos;d love to receive. Visible on <Link href={`/b/${b.slug}`}>your birthday board</Link> based on your privacy settings.</p>

      <div className="card">
        <h3>Add a Wishlist Item</h3>
        <form action={addWishlist}>
          <label>Item name *</label>
          <input name="title" required placeholder="e.g. Japanese Brass Sketching Pen" />
          <label>Description or note (optional)</label>
          <input name="description" placeholder="Colour, size, or why you love it" />
          <label>Product link (optional)</label>
          <input name="url" placeholder="https://…" />
          <p><button className="btn">Add to Wishlist</button></p>
        </form>
      </div>

      <div className="card">
        <h3>Saved Items ({items.length})</h3>
        {items.length === 0 ? <p className="muted">No items saved yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => (
              <div key={item.id} style={{ padding: '.8rem', borderRadius: 12, background: '#fffcf7', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{item.title}</strong>
                  {item.description && <div className="note">{item.description}</div>}
                  {item.url && <div className="note"><a href={item.url} target="_blank" rel="noopener noreferrer nofollow">{item.url}</a></div>}
                </div>
                {item.claimed_by ? <span className="pill">🎁 Gifted</span> : <span className="pill rose">Available</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
