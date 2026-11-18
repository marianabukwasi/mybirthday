import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { daysUntilBirthday } from '../../lib/phase';
import { markNotificationsRead } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications · mybirthday.life' };

export default async function NotificationsPage() {
  const u = await currentUser();
  if (!u) redirect('/login');

  const days = daysUntilBirthday(u.birth_date, u.time_zone);
  const alerts = db.prepare(
    'SELECT id, kind, message, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50'
  ).all(u.id);

  // §7 Preparation milestones (30, 20, 10 days before birthday)
  const milestones = [];
  if (days === 0) {
    milestones.push('🎉 Today is your birthday! Your Birthday Surprise Box is unlocked.');
  } else {
    if (days <= 30) milestones.push('📅 30-day milestone: Your birthday is within a month. Start preparing your board!');
    if (days <= 20) milestones.push('🎁 20-day milestone: Your birthday is getting closer. Update your wishlist and requests!');
    if (days <= 10) milestones.push('💌 10-day milestone: Your birthday is almost here! Invite your friends and get your board ready.');
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1>🔔 Notifications</h1>
        {alerts.some(a => !a.is_read) && (
          <form action={markNotificationsRead}>
            <button className="btn ghost" type="submit">Mark all as read</button>
          </form>
        )}
      </div>

      {milestones.length > 0 && (
        <div className="card">
          <h3>Birthday Preparation Reminders</h3>
          <ul>{milestones.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h3>Board Activity (Anonymous Until Your Birthday)</h3>
        <p className="note">Every contribution creates excitement without revealing who sent it or what's inside.</p>
        {alerts.length === 0 ? (
          <p className="muted">No activity notifications yet. Share your board link to start collecting surprises!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(a => (
              <div
                key={a.id}
                style={{
                  padding: '.65rem .85rem',
                  borderRadius: 10,
                  background: a.is_read ? '#f8faff' : '#fdf2f8',
                  border: `1px solid ${a.is_read ? '#e2e8f0' : '#fbcfe8'}`,
                }}
              >
                <strong>{a.message}</strong>
                <div className="note">{a.created_at}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
