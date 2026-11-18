import { SignupForm } from '../forms';
export const metadata = { title: 'Create your board · mybirthday.life' };
export default function Page() {
  return <div className="card"><h1>Create your board</h1><p className="muted">Free to start. You must be 18 or older.</p><SignupForm /></div>;
}
