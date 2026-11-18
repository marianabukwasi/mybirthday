import Link from 'next/link';
import { currentUser } from '../../lib/auth';
import { dealsUnlocked, daysUntilBirthday } from '../../lib/phase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Birthday Deals · mybirthday.life' };

const OFFERS = [
  { cat: 'Hotels & Spas', partner: 'Nordic Thermal Spa', title: 'Complimentary Birthday Day-Pass + Guest Entry', desc: 'Unlocks 30 days before your locked birth date and closes 7 days after.', code: 'BDAY-SPA-37' },
  { cat: 'Restaurants', partner: 'Partner Birthday Bistro', title: 'Complimentary Birthday Dessert & Toast', desc: 'Valid anywhere in our local dining network during your 37-day window.', code: 'BDAY-DINE-37' },
  { cat: 'Airlines & Travel', partner: 'European & Global Travel Partners', title: 'Birthday Escape Flight & Rail Discount', desc: 'Book travel departing inside your 30-days-before to 7-days-after window.', code: 'FLY-MYBDAY' },
];

export default async function DealsPage() {
  const u = await currentUser();
  const open = u ? dealsUnlocked(u.birth_date, u.time_zone) : false;
  const days = u ? daysUntilBirthday(u.birth_date, u.time_zone) : null;

  return (
    <>
      <h1>✨ Birthday Deals</h1>
      <div className="card">
        <p className="muted">
          Local and travel offers unlock <strong>30 days before</strong> your birthday and close <strong>7 days after</strong>.
          Your birth date is locked at signup to protect these offers.
        </p>
        {!u ? (
          <p><Link className="btn" href="/login">Log in</Link> or <Link className="btn ghost" href="/signup">Create your board</Link> to check your 37-day window.</p>
        ) : open ? (
          <div className="ok">🔓 Your Birthday Deals window is UNLOCKED! ({days === 0 ? 'Today is your birthday!' : `${days} days until your birthday`})</div>
        ) : (
          <div className="sealed">🔒 Your deals window is locked ({days} days until your birthday — unlocks at 30 days).</div>
        )}
      </div>

      <div className="grid">
        {OFFERS.map(o => (
          <div key={o.code} className="card" style={{ opacity: open ? 1 : 0.65 }}>
            <span className="pill">{o.cat}</span>
            <h3 style={{ marginTop: 8 }}>{o.title}</h3>
            <div className="note" style={{ color: 'var(--purple)', fontWeight: 700 }}>{o.partner}</div>
            <p className="muted">{o.desc}</p>
            <div style={{ marginTop: 10, fontWeight: 700, fontSize: '.85rem' }}>
              {open ? `Code: ${o.code}` : '🔒 Unlocks 30 days before your birthday'}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
