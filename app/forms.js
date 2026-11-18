'use client';
import { useActionState, useState } from 'react';
import { signup, login, sendWish, sendCashGift } from './actions';

const ZONES = ['Europe/Stockholm','Europe/London','Europe/Lisbon','Europe/Berlin','America/New_York','America/Los_Angeles','America/Toronto','Africa/Nairobi','Africa/Kampala','Africa/Lagos','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'];

export function SignupForm() {
  const [s, act, pending] = useActionState(signup, null);
  return (
    <form action={act}>
      {s?.error && <div className="err">{s.error}</div>}
      <div className="row">
        <div><label>Full name</label><input name="name" required /></div>
        <div><label>Email</label><input name="email" type="email" required /></div>
      </div>
      <div className="row">
        <div><label>Password (8+ characters)</label><input name="password" type="password" minLength={8} required /></div>
        <div><label>Country</label><input name="country" required placeholder="e.g. Sweden" /></div>
      </div>
      <div className="row">
        <div><label>Birth date (18+, locked after signup)</label><input name="birth_date" type="date" required /></div>
        <div><label>Home time zone</label>
          <select name="time_zone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}>
            {ZONES.map(z => <option key={z}>{z}</option>)}
          </select></div>
      </div>
      <div className="row">
        <div><label>Choose your board colour 1</label><input name="color1" type="color" defaultValue="#7c3aed" /></div>
        <div><label>Choose your board colour 2</label><input name="color2" type="color" defaultValue="#ec4899" /></div>
      </div>
      <label><input type="checkbox" name="confirm" /> I am 18 or older and understand my birth date is locked and cannot be changed.</label>
      <p><button className="btn" disabled={pending}>{pending ? 'Creating…' : 'Create my board'}</button></p>
    </form>
  );
}

export function LoginForm() {
  const [s, act, pending] = useActionState(login, null);
  return (
    <form action={act}>
      {s?.error && <div className="err">{s.error}</div>}
      <label>Email</label><input name="email" type="email" required />
      <label>Password</label><input name="password" type="password" required />
      <p><button className="btn" disabled={pending}>Log in</button></p>
    </form>
  );
}

export function WishForm({ slug, requests, ownerName }) {
  const [s, act, pending] = useActionState(sendWish, null);
  if (s?.ok) return <div className="ok">🎁 Your wish is wrapped and tucked into {ownerName}'s Birthday Surprise Box! Check your email, and we'll remind you when your own birthday celebration opens.</div>;
  return (
    <form action={act} encType="multipart/form-data">
      <input type="hidden" name="slug" value={slug} />
      {s?.error && <div className="err">{s.error}</div>}
      {requests.length > 0 && (
        <>
          <label>Fulfil a request (optional)</label>
          <select name="request_title"><option value="">— none —</option>{requests.map(r => <option key={r.id}>{r.title}</option>)}</select>
        </>
      )}
      <label>Type of wish</label>
      <select name="kind"><option value="text">Text note</option><option value="photo">Photo / postcard</option><option value="voice">Voice note (up to 60s)</option><option value="video">Video (up to 60s)</option></select>
      <label>Attach file (for photo, voice or video)</label>
      <input name="media" type="file" accept="image/*,audio/*,video/*" />
      <label>Your message (written by you, no AI)</label>
      <textarea name="message" rows={3} />
      <div className="row">
        <div><label>Your name</label><input name="guest_name" required /></div>
        <div><label>Your email</label><input name="guest_email" type="email" required /></div>
      </div>
      <div className="row">
        <div><label>Your birth date (18+)</label><input name="guest_birth_date" type="date" required /></div>
        <div><label>Your city (anonymous geo-ping)</label><input name="guest_city" /></div>
      </div>
      <label><input type="checkbox" name="license" /> I keep ownership of what I upload and allow mybirthday.life to compile it and {ownerName} to keep and share it.</label>
      <p><button className="btn pink" disabled={pending}>{pending ? 'Wrapping…' : '🎁 Wrap & Send My Wish'}</button></p>
    </form>
  );
}

export function CashGiftForm({ slug, ownerName }) {
  const [s, act, pending] = useActionState(sendCashGift, null);
  const [amount, setAmount] = useState(50);
  const fee5 = (amount * 0.05).toFixed(2);
  const proc = (amount * 0.029 + 0.30).toFixed(2);
  const total = (amount + Number(fee5) + Number(proc)).toFixed(2);

  if (s?.ok) {
    return <div className="ok">💳 Thank you! Your ${s.amount} gift for {ownerName} is scheduled for automatic release at 00:00 on their birthday.</div>;
  }

  return (
    <form action={act}>
      <input type="hidden" name="slug" value={slug} />
      {s?.error && <div className="err">{s.error}</div>}
      <div style={{ display: 'flex', gap: 6, margin: '.5rem 0' }}>
        {[25, 50, 100, 200].map(v => (
          <button
            key={v}
            type="button"
            className={amount === v ? 'btn' : 'btn ghost'}
            style={{ padding: '.4rem .8rem', fontSize: '.82rem' }}
            onClick={() => setAmount(v)}
          >
            ${v}
          </button>
        ))}
      </div>
      <input type="hidden" name="amount" value={amount} />
      <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '.7rem', fontSize: '.8rem', marginBottom: '.65rem' }}>
        <div>{ownerName} receives (100%): <strong>${amount.toFixed(2)}</strong></div>
        <div>Platform fee (5% · sender-covered): ${fee5}</div>
        <div>Processing fee (sender-covered): ${proc}</div>
        <div style={{ borderTop: '1px solid #cbd5e1', marginTop: 4, paddingTop: 4 }}><strong>Total: ${total}</strong></div>
      </div>
      <div className="row">
        <div><label>Your name</label><input name="sender_name" required /></div>
        <div><label>Your email</label><input name="sender_email" type="email" required /></div>
      </div>
      <p><button className="btn" disabled={pending}>{pending ? 'Processing…' : `💳 Send $${amount} Birthday Gift`}</button></p>
    </form>
  );
}
