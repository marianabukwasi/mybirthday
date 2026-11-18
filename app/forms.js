'use client';
import { useActionState, useState } from 'react';
import { signup, login, sendWish, sendCashGift } from './actions';

const ZONES = [
  'Europe/Stockholm', 'Europe/London', 'Europe/Lisbon', 'Europe/Berlin', 'Europe/Luxembourg',
  'America/New_York', 'America/Los_Angeles', 'America/Toronto',
  'Africa/Nairobi', 'Africa/Kampala', 'Africa/Lagos',
  'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney',
];

export function SignupForm() {
  const [s, act, pending] = useActionState(signup, null);
  return (
    <form action={act}>
      {s?.error && <div className="err">{s.error}</div>}
      <div className="row">
        <div><label>Display name *</label><input name="name" required placeholder="e.g. Amara Lindqvist" /></div>
        <div><label>Email *</label><input name="email" type="email" required placeholder="you@example.com" /></div>
      </div>
      <div className="row">
        <div><label>Password (8+ characters) *</label><input name="password" type="password" minLength={8} required /></div>
        <div><label>Country *</label><input name="country" required placeholder="e.g. Sweden, Uganda, Luxembourg" /></div>
      </div>
      <div className="row">
        <div><label>Birth date (18+ · protected after setup) *</label><input name="birth_date" type="date" required /></div>
        <div><label>Home time zone *</label>
          <select name="time_zone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}>
            {ZONES.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <div><label>Your personal colour 1</label><input name="color1" type="color" defaultValue="#e11d48" /></div>
        <div><label>Your personal colour 2</label><input name="color2" type="color" defaultValue="#f59e0b" /></div>
      </div>
      <label style={{ marginTop: 12 }}>
        <input type="checkbox" name="confirm" /> I am 18 or older and understand my birth date is protected after setup to safeguard the birthday cycle and offers.
      </label>
      <p><button className="btn" disabled={pending}>{pending ? 'Creating profile…' : '🎂 Create my profile & board'}</button></p>
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
      <p><button className="btn" disabled={pending}>{pending ? 'Signing in…' : 'Log in'}</button></p>
    </form>
  );
}

export function WishForm({ slug, requests, ownerName }) {
  const [s, act, pending] = useActionState(sendWish, null);
  const [anon, setAnon] = useState(false);

  if (s?.ok) {
    return (
      <div className="ok">
        🎁 Your wish has been added to {ownerName}&apos;s Open Vault! They&apos;ve received an anonymous alert that a celebration arrived, and we&apos;ll remind you when your own birthday cycle opens.
      </div>
    );
  }

  return (
    <form action={act} encType="multipart/form-data">
      <input type="hidden" name="slug" value={slug} />
      {s?.error && <div className="err">{s.error}</div>}

      {requests.length > 0 && (
        <>
          <label>Fulfil one of {ownerName}&apos;s birthday requests (optional)</label>
          <select name="request_title">
            <option value="">— Write an open wish —</option>
            {requests.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}
          </select>
        </>
      )}

      <label>How would you like to celebrate {ownerName}?</label>
      <select name="kind">
        <option value="text">💌 Written birthday message</option>
        <option value="photo">📸 Photograph</option>
        <option value="postcard">🖼️ Digital postcard</option>
        <option value="voice">🎙️ Voice recording</option>
        <option value="video">🎬 Short video (up to 60s)</option>
        <option value="giftcard">🎟️ Gift card</option>
      </select>

      <label>Attach photo, voice note, or video (if selected)</label>
      <input name="media" type="file" accept="image/*,audio/*,video/*" />

      <label>Your message (written by you — zero AI)</label>
      <textarea name="message" rows={3} placeholder={`Write something genuine for ${ownerName}…`} />

      <label style={{ marginTop: 10 }}>
        <input type="checkbox" name="is_anonymous" checked={anon} onChange={e => setAnon(e.target.checked)} />
        Send anonymously (hide my name from {ownerName})
      </label>

      <div className="row">
        {!anon && <div><label>Your name *</label><input name="guest_name" required={!anon} placeholder="Your name" /></div>}
        <div><label>Your email (for your birthday reminder) *</label><input name="guest_email" type="email" required placeholder="you@example.com" /></div>
      </div>

      <div className="row">
        <div><label>Your birth date (18+) *</label><input name="guest_birth_date" type="date" required /></div>
        <div><label>Your country (shown anonymously)</label><input name="guest_country" placeholder="e.g. Uganda, UK, USA" /></div>
      </div>

      <label>Your city (optional)</label>
      <input name="guest_city" placeholder="e.g. Kampala, London, Stockholm" />

      <label style={{ marginTop: 10 }}>
        <input type="checkbox" name="license" /> I keep ownership of what I upload and allow mybirthday.life to compile it and {ownerName} to keep and share it.
      </label>

      <p><button className="btn" disabled={pending}>{pending ? 'Wrapping & sending…' : '🎁 Add to Birthday Vault'}</button></p>
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
    return (
      <div className="ok">
        💳 Thank you! Your ${s.amount} birthday gift for {ownerName} is scheduled through the payment provider for release at 00:00 on their birthday.
      </div>
    );
  }

  return (
    <form action={act}>
      <input type="hidden" name="slug" value={slug} />
      {s?.error && <div className="err">{s.error}</div>}
      <div style={{ display: 'flex', gap: 6, margin: '.5rem 0', flexWrap: 'wrap' }}>
        {[25, 50, 100, 200].map(v => (
          <button
            key={v}
            type="button"
            className={amount === v ? 'btn btn-sm' : 'btn ghost btn-sm'}
            onClick={() => setAmount(v)}
          >
            ${v}
          </button>
        ))}
      </div>
      <input type="hidden" name="amount" value={amount} />
      <div style={{ background: '#fffcf7', border: '1px solid var(--line)', borderRadius: 12, padding: '.75rem', fontSize: '.82rem', marginBottom: '.75rem' }}>
        <div>{ownerName} receives: <strong>${amount.toFixed(2)}</strong></div>
        <div>Proposed platform fee (5% · sender-covered): ${fee5}</div>
        <div>Processing fee (sender-covered): ${proc}</div>
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 4 }}><strong>Total: ${total}</strong></div>
      </div>
      <div className="row">
        <div><label>Your name *</label><input name="sender_name" required /></div>
        <div><label>Your email *</label><input name="sender_email" type="email" required /></div>
      </div>
      <p><button className="btn gold" disabled={pending}>{pending ? 'Processing…' : `💳 Send $${amount} Birthday Gift`}</button></p>
    </form>
  );
}
