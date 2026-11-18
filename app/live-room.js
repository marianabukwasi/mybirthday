'use client';
import { useEffect, useState } from 'react';
import { sendLiveEvent } from './actions';

export function LiveRoomClient({ slug, ownerName, liveTitle = 'Cut the Cake With Me', initialEvents, color1, color2 }) {
  const [events, setEvents] = useState(initialEvents);
  const [candlesOut, setCandlesOut] = useState(() => initialEvents.some(e => e.kind === 'candles'));
  const [cakeCut, setCakeCut] = useState(() => initialEvents.some(e => e.kind === 'cake'));
  const [senderName, setSenderName] = useState('');
  const [senderCity, setSenderCity] = useState('');
  const [cheerText, setCheerText] = useState('');
  const [copied, setCopied] = useState(false);
  const [roomSecs, setRoomSecs] = useState(60 * 60); // §11: Up to 60-minute live session
  const [floating, setFloating] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setRoomSecs(s => (s > 0 ? s - 1 : 0)), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
          if ((data.events || []).some(e => e.kind === 'candles')) setCandlesOut(true);
          if ((data.events || []).some(e => e.kind === 'cake')) setCakeCut(true);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2500);
    return () => { clearInterval(timer); clearInterval(poll); };
  }, [slug]);

  const spawnFloat = (emoji) => {
    const id = Date.now() + Math.random();
    setFloating(f => [...f, { id, emoji, left: 15 + Math.random() * 70 }]);
    setTimeout(() => setFloating(f => f.filter(x => x.id !== id)), 2000);
  };

  async function postEvent(payload) {
    const fd = new FormData();
    fd.set('slug', slug);
    fd.set('kind', payload.kind);
    fd.set('sender_name', senderName.trim() || 'Birthday Friend');
    fd.set('sender_city', senderCity.trim());
    fd.set('gift_type', payload.gift_type || '');
    fd.set('amount_cents', String(payload.amount_cents || 0));
    fd.set('message', payload.message || '');
    await sendLiveEvent(fd);
    const res = await fetch(`/api/live/${slug}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events || []);
    }
  }

  const mins = String(Math.floor(roomSecs / 60)).padStart(2, '0');
  const secs = String(roomSecs % 60).padStart(2, '0');

  return (
    <div className="live-grid">
      <div className="card" style={{ background: `linear-gradient(155deg, #1e1b4b 0%, ${color1}dd 100%)`, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {floating.map(f => (
          <span key={f.id} style={{ position: 'absolute', bottom: 30, left: `${f.left}%`, fontSize: '2rem', animation: 'floatUp 2s ease-out forwards', pointerEvents: 'none' }}>
            {f.emoji}
          </span>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span className="pill pink">● LIVE · UP TO 60 MIN</span>
            <h2 style={{ color: '#fff', marginTop: 6 }}>{liveTitle} · with {ownerName}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: '.4rem .8rem', fontSize: '.78rem' }}
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? '✓ Link Copied!' : '🔗 Share Live Link'}
            </button>
            <div style={{ background: 'rgba(0,0,0,0.35)', padding: '.45rem .9rem', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: '#cbd5e1' }}>Session Time</div>
              <strong style={{ fontSize: '1.3rem', color: '#f472b6' }}>{mins}:{secs}</strong>
            </div>
          </div>
        </div>

        {/* Interactive SVG Birthday Cake */}
        <div style={{ textAlign: 'center', margin: '1.25rem 0' }}>
          <svg viewBox="0 0 360 250" style={{ width: 280, maxWidth: '100%' }} aria-label="Interactive Birthday Cake">
            <ellipse cx="180" cy="225" rx="135" ry="16" fill="#e2e8f0" />
            <rect x="75" y="145" width="210" height="72" rx="14" fill={color1} />
            <path d="M75 160 Q95 178 115 160 T155 160 T195 160 T235 160 T275 160 L285 160 L285 145 L75 145 Z" fill="#ffffff" />
            <rect x="105" y="90" width="150" height="58" rx="12" fill={color2} />
            <path d="M105 104 Q125 120 145 104 T185 104 T225 104 T255 104 L255 90 L105 90 Z" fill="#ffffff" />
            {cakeCut && <path d="M180 90 L180 218 M180 90 L220 218" stroke="#ffffff" strokeWidth="3" strokeDasharray="6,4" />}
            {[135, 175, 215].map((x, idx) => (
              <g key={x} transform={`translate(${x}, ${idx === 1 ? 42 : 48})`}>
                <rect x="0" y="15" width="10" height={idx === 1 ? 36 : 30} rx="3" fill="#38bdf8" />
                {!candlesOut && <path d="M5 0 C1 7 1 13 5 15 C9 13 9 7 5 0 Z" fill="#fde047" />}
              </g>
            ))}
          </svg>
          <div style={{ fontSize: '.9rem', color: '#fbcfe8', marginBottom: '.85rem' }}>
            {cakeCut ? '🍰 First slice served! Happy Birthday!' : candlesOut ? '✨ Candles blown out! Now cut the cake!' : '🕯️ Candles are lit! Blow them out and make a wish!'}
          </div>
          <div style={{ display: 'flex', gap: '.55rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn pink"
              onClick={() => {
                setCandlesOut(true);
                spawnFloat('💨');
                postEvent({ kind: 'candles', message: '💨 Blew out the birthday candles!' });
              }}
            >
              💨 Blow Out Candles
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCakeCut(true);
                spawnFloat('🍰');
                postEvent({ kind: 'cake', message: '🍰 Cut the first slice of birthday cake!' });
              }}
            >
              🍰 Cut the Cake
            </button>
          </div>
        </div>

        {/* Celebration Reactions (No credit wallets or paid live-gifting at launch per §11) */}
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '.45rem' }}>Send a Live Celebration Reaction</strong>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {[['🥳', 'Cheer'], ['🥂', 'Raise a Toast'], ['🎶', 'Sing Along'], ['💖', 'Send Love']].map(([emoji, label]) => (
              <button
                key={label}
                type="button"
                className="btn ghost"
                style={{ padding: '.45rem .85rem', fontSize: '.82rem' }}
                onClick={() => {
                  spawnFloat(emoji);
                  postEvent({ kind: 'cheer', message: `${emoji} ${label}!` });
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Stream & Cheer Box */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3>Live Celebration Stream</h3>
          <p className="note">Pure positivity only. Updates live for everyone in the room.</p>
          <div style={{ maxHeight: 360, overflowY: 'auto', margin: '.75rem 0', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {events.length === 0 && <p className="muted">Be the first to send a live birthday cheer!</p>}
            {events.map(ev => (
              <div key={ev.id} style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '.55rem .75rem', fontSize: '.85rem' }}>
                <strong>{ev.sender_name}</strong>{ev.sender_city ? ` (${ev.sender_city})` : ''}: {ev.message}
              </div>
            ))}
          </div>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!cheerText.trim()) return;
            const msg = cheerText.trim();
            setCheerText('');
            spawnFloat('🎉');
            postEvent({ kind: 'cheer', message: msg });
          }}
        >
          <div className="row" style={{ marginBottom: 6 }}>
            <input placeholder="Your name" value={senderName} onChange={e => setSenderName(e.target.value)} />
            <input placeholder="City (optional)" value={senderCity} onChange={e => setSenderCity(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input placeholder="Send a birthday cheer…" value={cheerText} onChange={e => setCheerText(e.target.value)} required />
            <button className="btn pink" type="submit">Cheer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
