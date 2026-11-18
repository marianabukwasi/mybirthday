'use client';
import { useState } from 'react';
import { purchaseKeepsake } from './actions';

export function KeepsakeClient({ slug, ownerName, wishes, fullVideoPaid, cardPaid, color1, color2 }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const playTeaser = () => {
    if (!wishes.length) return;
    setPlaying(true);
    let step = 0;
    const maxSteps = fullVideoPaid ? wishes.length : Math.min(4, wishes.length);
    const id = setInterval(() => {
      setIdx(step % wishes.length);
      step++;
      if (step >= maxSteps) {
        clearInterval(id);
        setPlaying(false);
      }
    }, 1800);
  };

  const active = wishes[idx];

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card">
        <span className="pill">{fullVideoPaid ? '✓ Full Compilation Unlocked' : 'Free 15s Teaser Ready'}</span>
        <h3 style={{ marginTop: 8 }}>Compiled Birthday Film</h3>
        <p className="note">Stitched strictly from real human wishes (zero generative AI).</p>

        <div
          style={{
            background: `linear-gradient(135deg, #1e1b4b, ${color1}, ${color2})`,
            color: '#fff',
            borderRadius: 16,
            padding: '1.5rem',
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            margin: '1rem 0',
          }}
        >
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#fbcfe8' }}>
            {fullVideoPaid ? '🎞️ FULL COMPILATION' : '🎞️ 15-SECOND FREE TEASER'}
          </div>
          <div style={{ textAlign: 'center', margin: '1rem 0' }}>
            {active ? (
              <>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>“{active.message || `Sent a ${active.kind}`}”</div>
                <div style={{ fontSize: '.85rem', color: '#e2e8f0', marginTop: 6 }}>
                  — {active.guest_name}{active.guest_city ? ` · ${active.guest_city}` : ''}
                </div>
              </>
            ) : (
              <div>Wishes will appear here once unwrapped on {ownerName}'s birthday!</div>
            )}
          </div>
          <div style={{ fontSize: '.75rem', color: '#cbd5e1' }}>
            {playing ? '▶ Playing stitched reel…' : `${wishes.length} wish(es) in reel`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={playTeaser} disabled={!wishes.length || playing}>
            {playing ? 'Playing…' : '▶ Play 15s Free Teaser'}
          </button>
          {!fullVideoPaid && (
            <form action={purchaseKeepsake}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="kind" value="video_full" />
              <button className="btn pink" type="submit">✨ Unlock Full Compilation ($19)</button>
            </form>
          )}
        </div>
      </div>

      <div className="card">
        <span className="pill pink">Printable Keepsake Card</span>
        <h3 style={{ marginTop: 8 }}>Birthday Keepsake Edition</h3>
        <p className="note">Print or save as PDF to keep every wish forever.</p>

        <div id="printable-card" style={{ border: `2px solid ${color1}`, borderRadius: 14, padding: '1.1rem', margin: '1rem 0', background: '#fff' }}>
          <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '.7rem', marginBottom: '.8rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: color1 }}>MYBIRTHDAY.LIFE KEEPSAKE</div>
            <h4 style={{ margin: '4px 0', fontSize: '1.3rem' }}>Happy Birthday, {ownerName}!</h4>
            <div className="note">{wishes.length} friend(s) celebrating you</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
            {wishes.map(w => (
              <div key={w.id} style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '.55rem', fontSize: '.78rem' }}>
                <div>“{w.message || `Sent a ${w.kind}`}”</div>
                <strong style={{ color: color1 }}>— {w.guest_name}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            🖨️ Print / Save PDF
          </button>
          {!cardPaid && (
            <form action={purchaseKeepsake}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="kind" value="keepsake_card" />
              <button className="btn pink" type="submit">Order Keepsake Edition ($12)</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
