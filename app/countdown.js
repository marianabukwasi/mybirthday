'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function msUntilBirthdayMidnight(birthDate, timeZone) {
  const now = new Date();
  const [, bm, bd] = birthDate.split('-').map(Number);

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const curY = Number(parts.year);
  const curM = Number(parts.month);
  const curD = Number(parts.day);
  const curH = Number(parts.hour === '24' ? 0 : parts.hour);
  const curMin = Number(parts.minute);
  const curS = Number(parts.second);

  if (curM === bm && curD === bd) return 0;

  let targetY = curY;
  if (curM > bm || (curM === bm && curD > bd)) targetY += 1;

  const todayUTC = Date.UTC(curY, curM - 1, curD, curH, curMin, curS);
  const targetUTC = Date.UTC(targetY, bm - 1, bd, 0, 0, 0);
  return Math.max(0, targetUTC - todayUTC);
}

// Speak 10..1 with a crowd of voices counting down together
function speakCount(num) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const allVoices = window.speechSynthesis.getVoices();
    const enVoices = allVoices.filter(v => /en/i.test(v.lang));
    const pool = enVoices.length ? enVoices : allVoices;

    // Layer 3 slightly staggered voices with different pitches so it sounds like a crowd
    const crowdSpecs = [
      { pitch: 0.92, rate: 1.05, delay: 0 },
      { pitch: 1.15, rate: 1.08, delay: 55 },
      { pitch: 1.28, rate: 1.02, delay: 110 },
    ];

    crowdSpecs.forEach((spec, idx) => {
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(String(num));
        if (pool.length) utter.voice = pool[idx % pool.length];
        utter.pitch = spec.pitch;
        utter.rate = spec.rate;
        utter.volume = idx === 0 ? 0.9 : 0.65;
        window.speechSynthesis.speak(utter);
      }, spec.delay);
    });
  } catch {
    // Ignore if speech synthesis is unavailable
  }
}

// Celebratory party-popper / cork-pop sound
function playPopSound(ctx, master) {
  const now = ctx.currentTime;

  // Crisp pop transient
  const bufSize = Math.floor(ctx.sampleRate * 0.14);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.Q.setValueAtTime(1.2, now);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.75, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(master);
  noise.start(now);

  // Warm low thump
  const thump = ctx.createOscillator();
  const tGain = ctx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(170, now);
  thump.frequency.exponentialRampToValueAtTime(48, now + 0.16);
  tGain.gain.setValueAtTime(0.55, now);
  tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  thump.connect(tGain);
  tGain.connect(master);
  thump.start(now);
  thump.stop(now + 0.19);
}

// Warm, expressive, natural-sounding "Happy Birthday" with chords, vibrato & room warmth
function playNaturalBirthdayCelebration(onEnded) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.85, ctx.currentTime);
    master.connect(ctx.destination);

    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.16, ctx.currentTime);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(0.22, ctx.currentTime);
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.setValueAtTime(1800, ctx.currentTime);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(master);

    // 1. Pop! right at 00:00
    playPopSound(ctx, master);

    // Warm piano-like chord pad
    function playChord(freqs, start, dur) {
      freqs.forEach(f => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(0.065, start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(lp);
        lp.connect(g);
        g.connect(master);
        g.connect(delay);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      });
    }

    // Expressive warm melody note with gentle vibrato & harmonic warmth
    function playMelodyNote(freq, start, dur) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, start);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, start);

      lfo.frequency.setValueAtTime(5.2, start);
      lfoGain.gain.setValueAtTime(0.0, start);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.006, start + 0.18);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.18, start);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, start);

      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.14, start + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.96);

      osc1.connect(lp);
      osc2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(master);
      g.connect(delay);

      osc1.start(start);
      osc2.start(start);
      lfo.start(start);
      osc1.stop(start + dur);
      osc2.stop(start + dur);
      lfo.stop(start + dur);
    }

    const notes = [
      [261.63, 0.36], [261.63, 0.24], [293.66, 0.56], [261.63, 0.56], [349.23, 0.56], [329.63, 1.15],
      [261.63, 0.36], [261.63, 0.24], [293.66, 0.56], [261.63, 0.56], [392.00, 0.56], [349.23, 1.15],
      [261.63, 0.36], [261.63, 0.24], [523.25, 0.58], [440.00, 0.56], [349.23, 0.56], [329.63, 0.56], [293.66, 1.05],
      [466.16, 0.36], [466.16, 0.24], [440.00, 0.56], [349.23, 0.56], [392.00, 0.58], [349.23, 1.65],
    ];

    let t = ctx.currentTime + 0.35;
    playChord([174.61, 220.00, 261.63], t, 2.2);
    playChord([196.00, 261.63, 329.63], t + 2.2, 2.4);
    playChord([174.61, 220.00, 261.63], t + 4.6, 2.2);
    playChord([174.61, 233.08, 293.66], t + 6.8, 2.8);
    playChord([174.61, 220.00, 261.63], t + 9.6, 1.4);
    playChord([196.00, 261.63, 349.23], t + 11.0, 2.5);

    notes.forEach(([freq, dur]) => {
      playMelodyNote(freq, t, dur);
      t += dur;
    });

    const totalMs = (t - ctx.currentTime) * 1000 + 400;
    setTimeout(() => {
      ctx.close().catch(() => {});
      if (onEnded) onEnded();
    }, totalMs);
  } catch {
    if (onEnded) onEnded();
  }
}

// Fireworks + Confetti Canvas Engine
function launchFireworksAndConfetti(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#ec4899', '#fde047'];

  const confetti = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 140,
    w: 7 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: -2.5 + Math.random() * 5,
    vy: 2.2 + Math.random() * 4.5,
    a: Math.random() * Math.PI * 2,
    spin: -0.1 + Math.random() * 0.2,
  }));

  const sparks = [];
  function burst(bx, by) {
    const c = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < 65; i++) {
      const ang = (Math.PI * 2 * i) / 65 + (Math.random() - 0.5) * 0.2;
      const spd = 2 + Math.random() * 6.5;
      sparks.push({
        x: bx,
        y: by,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        color: Math.random() > 0.3 ? c : '#ffffff',
      });
    }
  }

  [0, 350, 750, 1200, 1700, 2300, 3000].forEach(ms => {
    setTimeout(() => {
      burst(canvas.width * (0.18 + Math.random() * 0.64), canvas.height * (0.16 + Math.random() * 0.42));
    }, ms);
  });

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confetti.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08;
      s.vx *= 0.985;
      s.life -= 0.015;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (++frame < 340) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

export function BirthdayCountdown({ birthDate, timeZone, ownerName, phase, wishCount = 0, color1 = '#7c3aed', color2 = '#ec4899' }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [msLeft, setMsLeft] = useState(() => msUntilBirthdayMidnight(birthDate, timeZone));
  const [demoSecs, setDemoSecs] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const triggeredRef = useRef(false);
  const lastSpokenRef = useRef(null);

  const triggerFinale = () => {
    setCelebrating(true);
    setDismissed(false);
    launchFireworksAndConfetti(canvasRef.current);
    playNaturalBirthdayCelebration(() => {});
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (demoSecs !== null) {
        if (demoSecs > 1) {
          const next = demoSecs - 1;
          setDemoSecs(next);
          if (next <= 10 && next >= 1 && lastSpokenRef.current !== next) {
            lastSpokenRef.current = next;
            speakCount(next);
          }
        } else if (demoSecs === 1) {
          setDemoSecs(0);
          if (!triggeredRef.current) {
            triggeredRef.current = true;
            triggerFinale();
          }
        }
        return;
      }

      const nextMs = msUntilBirthdayMidnight(birthDate, timeZone);
      setMsLeft(nextMs);
      const totalSec = Math.ceil(nextMs / 1000);
      if (totalSec <= 10 && totalSec >= 1 && lastSpokenRef.current !== totalSec) {
        lastSpokenRef.current = totalSec;
        speakCount(totalSec);
      }
      if (nextMs === 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        triggerFinale();
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [birthDate, timeZone, demoSecs, router]);

  const totalSec = demoSecs !== null ? demoSecs : Math.floor(msLeft / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');

  const showTakeover = !dismissed && (
    celebrating ||
    (demoSecs !== null && demoSecs <= 60) ||
    (demoSecs === null && totalSec > 0 && totalSec <= 60)
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }}
      />

      {/* Full-screen 60-second Countdown & 00:00 Fireworks Takeover */}
      {showTakeover && (
        <div
          className="takeover-overlay"
          role="dialog"
          aria-modal="true"
          style={{ background: `radial-gradient(circle at center, ${color1}cc 0%, #1e1b4b 55%, #0f172a 100%)` }}
        >
          {!celebrating ? (
            <div className="takeover-inner">
              <div className="takeover-kicker">✨ {ownerName.toUpperCase()}’S BIRTHDAY COUNTDOWN ✨</div>
              <div
                className={`takeover-number ${totalSec <= 10 ? 'pulse-ten' : ''}`}
                style={{ background: `linear-gradient(135deg, #ffffff, ${color2}, ${color1})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                {totalSec}
              </div>
              <div className="takeover-sub">
                {totalSec <= 10 ? '🗣️ Everyone around the world is counting down together…' : 'Seconds until midnight!'}
              </div>
              {totalSec <= 10 && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap', opacity: 0.9 }}>
                  <span className="pill pink">🗣️ Stockholm: {totalSec}!</span>
                  <span className="pill pink">🗣️ London: {totalSec}!</span>
                  <span className="pill pink">🗣️ Nairobi: {totalSec}!</span>
                  <span className="pill pink">🗣️ Montreal: {totalSec}!</span>
                  <span className="pill pink">🗣️ Tokyo: {totalSec}!</span>
                </div>
              )}
            </div>
          ) : (
            <div className="takeover-inner">
              <div className="takeover-kicker">🎆 POP! FIREWORKS &amp; BIRTHDAY SONG 🎆</div>
              <h1 className="takeover-happy">HAPPY BIRTHDAY,<br />{ownerName.toUpperCase()}!</h1>
              <p className="takeover-sub">🎶 Singing Happy Birthday to you…</p>
              <div
                style={{
                  marginTop: '1.25rem',
                  background: 'rgba(255,255,255,0.12)',
                  border: `1px solid ${color2}`,
                  borderRadius: '16px',
                  padding: '1rem 1.4rem',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                }}
              >
                🌍 {wishCount} {wishCount === 1 ? 'person has' : 'people have'} wished you a Happy Birthday from around the world — see them now!
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn pink"
                  style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
                  onClick={() => {
                    setDismissed(true);
                    setCelebrating(false);
                    setDemoSecs(null);
                    document.getElementById('wishes-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  🎁 See Your Birthday Wishes Now →
                </button>
                <button type="button" className="btn ghost" onClick={triggerFinale}>
                  🎆 Replay Fireworks &amp; Song
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Standard Board Countdown Box */}
      <div className="cd-box" style={{ border: `2px solid ${color2}` }}>
        <div className="cd-label">
          {phase === 'reveal'
            ? `🎉 It's 00:00! Happy Birthday, ${ownerName}!`
            : `🎂 Countdown to ${ownerName}'s Birthday (00:00 ${timeZone})`}
        </div>
        <div className="cd-grid">
          <div className="cd-unit"><span>{pad(d)}</span><small>Days</small></div>
          <div className="cd-sep">:</div>
          <div className="cd-unit"><span>{pad(h)}</span><small>Hours</small></div>
          <div className="cd-sep">:</div>
          <div className="cd-unit"><span>{pad(m)}</span><small>Mins</small></div>
          <div className="cd-sep">:</div>
          <div className="cd-unit"><span>{pad(s)}</span><small>Secs</small></div>
        </div>
        <div className="cd-actions">
          <button
            type="button"
            className="btn pink"
            style={{ padding: '.4rem .9rem', fontSize: '.78rem' }}
            onClick={() => {
              triggeredRef.current = false;
              lastSpokenRef.current = null;
              setCelebrating(false);
              setDismissed(false);
              setDemoSecs(60);
            }}
          >
            ⏱️ Preview Final 60s
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ padding: '.4rem .9rem', fontSize: '.78rem' }}
            onClick={() => {
              triggeredRef.current = false;
              lastSpokenRef.current = null;
              setCelebrating(false);
              setDismissed(false);
              setDemoSecs(12);
              speakCount(12);
            }}
          >
            🎆 Preview Final 12s (Voice + Pop + Fireworks)
          </button>
        </div>
      </div>
    </>
  );
}
