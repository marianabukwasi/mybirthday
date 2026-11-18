import './globals.css';
import Link from 'next/link';
import { currentUser } from '../lib/auth';
import { db } from '../lib/db';
import { logout } from './actions';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mybirthday.life'),
  title: 'mybirthday.life — a social platform made only for celebrations',
  description: 'Your birthday, celebrated by the people who love you. No feed. No bad news.',
  openGraph: {
    title: 'mybirthday.life',
    description: 'A social platform made only for celebrations.',
    url: 'https://mybirthday.life',
    siteName: 'mybirthday.life',
    type: 'website',
  },
};

export default async function RootLayout({ children }) {
  const user = await currentUser();
  const unread = user
    ? db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(user.id).c
    : 0;
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="side">
            <Link className="brand" href="/">mybirthday<span>.life</span></Link>
            <Link className="nav" href="/">Home</Link>
            <Link className="nav" href="/explore">Explore</Link>
            <Link className="nav" href="/boards">Celebrations</Link>
            <Link className="nav" href="/deals">Birthday deals</Link>
            {user ? (
              <>
                <Link className="nav" href="/notifications">Notifications {unread > 0 ? `(${unread})` : ''}</Link>
                <Link className="nav" href="/dashboard">My profile &amp; board</Link>
                <form action={logout}><button className="nav" type="submit">Log out</button></form>
              </>
            ) : (
              <>
                <Link className="nav" href="/signup">Create my board</Link>
                <Link className="nav" href="/login">Log in</Link>
              </>
            )}
            <div style={{ marginTop: 'auto' }} className="note">
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
