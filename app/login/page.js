import { LoginForm } from '../forms';
export const metadata = { title: 'Log in · mybirthday.life' };
export default function Page() {
  return <div className="card"><h1>Log in</h1><LoginForm /></div>;
}
