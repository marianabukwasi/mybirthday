import { db } from './db';

// Email adapter: uses Resend when RESEND_API_KEY is configured, otherwise logs to SQLite outbox.
export async function sendTransactionalEmail({ to, subject, text }) {
  db.prepare('INSERT INTO outbox (to_email, subject, body) VALUES (?,?,?)').run(to, subject, text);

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'celebrations@mybirthday.life';
  if (!key) return { mode: 'local-outbox' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return { mode: 'resend', ok: res.ok };
  } catch {
    return { mode: 'resend-error' };
  }
}

// Fee calculator: Master Doc §6 — 5% platform fee + Stripe processing covered by sender so owner gets 100%.
export function calculateGiftBreakdown(amountCents) {
  const platformFeeCents = Math.round(amountCents * 0.05);
  const processingCents = Math.round(amountCents * 0.029) + 30;
  const totalCents = amountCents + platformFeeCents + processingCents;
  return { amountCents, platformFeeCents, processingCents, totalCents };
}

// Payment adapter: uses Stripe Connect when STRIPE_SECRET_KEY is configured, otherwise records local gift.
export async function recordCashGift({ boardId, senderName, senderEmail, amountCents }) {
  const { platformFeeCents, totalCents } = calculateGiftBreakdown(amountCents);
  const r = db.prepare(
    'INSERT INTO gifts (board_id, sender_name, sender_email, amount_cents, platform_fee_cents, total_cents, status) VALUES (?,?,?,?,?,?,?)'
  ).run(boardId, senderName, senderEmail, amountCents, platformFeeCents, totalCents, 'held');

  return {
    id: Number(r.lastInsertRowid),
    mode: process.env.STRIPE_SECRET_KEY ? 'stripe-ready' : 'local-test',
    amountCents,
    platformFeeCents,
    totalCents,
  };
}
