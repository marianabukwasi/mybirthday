import './globals.css';
import Link from 'next/link';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { currentUser } from '../lib/auth';
import { db } from '../lib/db';
import { logout } from './actions';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mybirthday.life'),
  title: 'mybirthday.life — Everyone deserves to be celebrated',
  description: 'A positive social platform dedicated entirely to birthdays, celebrations, and making people feel special.',
  openGraph: {
    title: 'mybirthday.life',
    description: 'Everyone deserves to be celebrated.',
    url: 'https://mybirthday.life',
    siteName: 'mybirthday.life',
    type: 'website',
  },
};

export default async function RootLayout({ children }) {
  const user = await currentUser();
  const board = user ? db.prepare('SELECT slug FROM boards WHERE user_id=?').get(user.id) : null;
  const unread = user
    ? db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(user.id).c
    : 0;

  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body>
        <div className="shell">
          <aside className="side" aria-label="Primary Navigation">
            <Link className="brand" href="/">
              <span className="brand-dot" />
              <span>mybirthday<span className="brand-rose">.life</span></span>
            </Link>

            <div className="nav-group">
              <div className="nav-label">Discover</div>
              <Link className="nav" href="/">🌍 Home</Link>
              <Link className="nav" href="/explore">✨ Explore</Link>
              <Link className="nav" href="/celebrations">🎉 Celebrations</Link>
              <Link className="nav" href="/live">🕯️ Live</Link>
              <Link className="nav" href="/deals">🎁 Birthday Deals</Link>
            </div>

            {user ? (
              <div className="nav-group">
                <div className="nav-label">My Space</div>
                <Link className="nav" href="/profile">👤 My Profile</Link>
                {board && <Link className="nav" href={`/b/${board.slug}`}>🎂 My Birthday Board</Link>}
                <Link className="nav" href="/notifications">
                  🔔 Notifications {unread > 0 && <span className="badge-count">{unread}</span>}
                </Link>
                <Link className="nav" href="/wishlist">🎀 Wishlist</Link>
                <Link className="nav" href="/memories">🎞️ Memories</Link>
                <Link className="nav" href="/settings">⚙️ Settings</Link>
                <form action={logout}>
                  <button className="nav" type="submit">↩ Log out</button>
                </form>
              </div>
            ) : (
              <div className="nav-group">
                <div className="nav-label">Join</div>
                <Link className="nav cta-nav" href="/signup">🎂 Create my profile</Link>
                <Link className="nav" href="/login">Log in</Link>
              </div>
            )}

            <div className="side-foot">
              <div>Pure positivity · 18+</div>
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
            </div>
          </aside>

          <div className="content-wrap">
            <header className="mobile-header">
              <Link className="brand" href="/">
                <span className="brand-dot" />
                <span>mybirthday<span className="brand-rose">.life</span></span>
              </Link>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {user ? (
                  <>
                    <Link className="icon-btn" href="/notifications" aria-label="Notifications">
                      🔔{unread > 0 ? <span className="badge-count">{unread}</span> : null}
                    </Link>
                    <Link className="icon-btn" href="/settings" aria-label="Settings">⚙️</Link>
                  </>
                ) : (
                  <Link className="btn btn-sm" href="/signup">Join</Link>
                )}
              </div>
            </header>

            <main className="main">{children}</main>
          </div>

          <nav className="mobile-tabbar" aria-label="Mobile Navigation">
            <Link href="/">🌍<small>Home</small></Link>
            <Link href="/explore">✨<small>Explore</small></Link>
            <Link href="/celebrations">🎉<small>Celebrate</small></Link>
            <Link href="/live">🕯️<small>Live</small></Link>
            <Link href={user ? '/profile' : '/signup'}>👤<small>{user ? 'Profile' : 'Join'}</small></Link>
          </nav>
        </div>
      </body>
    </html>
  );
}
