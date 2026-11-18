'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const COUNTRY_COORDS = {
  sweden: [59.3, 18.0],
  portugal: [38.7, -9.1],
  kenya: [-1.3, 36.8],
  uganda: [0.3, 32.6],
  japan: [35.0, 135.7],
  'united states': [40.7, -74.0],
  usa: [40.7, -74.0],
  'united kingdom': [51.5, -0.1],
  uk: [51.5, -0.1],
  canada: [45.5, -73.5],
  germany: [52.5, 13.4],
  france: [48.8, 2.3],
  brazil: [-22.9, -43.2],
};

export function CelebrationGlobe({ boards }) {
  const canvasRef = useRef(null);
  const router = useRouter();
  const [tip, setTip] = useState(boards[0] ? `${boards[0].name} · ${boards[0].country}` : 'Drag to rotate the celebration globe');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rot = 0.35;
    let dragging = false;
    let lastX = 0;
    let rendered = [];

    const pins = boards.map((b, i) => {
      const c = COUNTRY_COORDS[String(b.country || '').toLowerCase()] || [20 + (i * 17) % 45, -60 + (i * 47) % 140];
      return { ...b, lat: c[0], lng: c[1], color: b.phase === 'reveal' ? '#fbbf24' : '#fb7185' };
    });

    let raf;
    function draw() {
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = 135;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx - 35, cy - 35, 16, cx, cy, r);
      grad.addColorStop(0, '#44403c');
      grad.addColorStop(0.7, '#292524');
      grad.addColorStop(1, '#1c1917');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      [-45, 0, 45].forEach(deg => {
        const rad = (deg * Math.PI) / 180;
        const y = cy - Math.sin(rad) * r;
        const rx = Math.cos(rad) * r;
        ctx.beginPath();
        ctx.ellipse(cx, y, rx, rx * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let i = 0; i < 6; i++) {
        const ang = rot + (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(Math.sin(ang)) * r, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      rendered = [];
      pins.forEach(p => {
        const latR = (p.lat * Math.PI) / 180;
        const lngR = (p.lng * Math.PI) / 180 + rot;
        if (Math.cos(latR) * Math.cos(lngR) > -0.15) {
          const x = cx + Math.cos(latR) * Math.sin(lngR) * r;
          const y = cy - Math.sin(latR) * r;
          rendered.push({ ...p, x, y });
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = p.color + '44';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      if (!dragging) rot += 0.004;
      raf = requestAnimationFrame(draw);
    }

    const onDown = e => { dragging = true; lastX = e.clientX; };
    const onUp = () => { dragging = false; };
    const onMove = e => {
      if (dragging) { rot += (e.clientX - lastX) * 0.008; lastX = e.clientX; }
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const hit = rendered.find(p => Math.hypot(p.x - mx, p.y - my) < 14);
      if (hit) setTip(`${hit.name} · ${hit.country}`);
    };
    const onClick = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const hit = rendered.find(p => Math.hypot(p.x - mx, p.y - my) < 16);
      if (hit) router.push(`/b/${hit.slug}`);
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [boards, router]);

  return (
    <div style={{ background: '#1c1917', borderRadius: 18, padding: '1rem', color: '#fff', textAlign: 'center' }}>
      <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#fbbf24' }}>🌍 Live Celebration Globe</div>
      <canvas ref={canvasRef} width={310} height={310} style={{ maxWidth: '100%', cursor: 'grab' }} />
      <div style={{ fontSize: '.78rem', color: '#d6d3d1' }}>{tip}</div>
    </div>
  );
}
