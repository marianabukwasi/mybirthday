'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const COUNTRY_COORDS = {
  sweden: [59.3, 18.0],
  portugal: [38.7, -9.1],
  kenya: [-1.3, 36.8],
  uganda: [0.3, 32.6],
  japan: [35.0, 135.7],
  luxembourg: [49.6, 6.1],
  'united states': [39.8, -98.5],
  usa: [39.8, -98.5],
  'united kingdom': [54.0, -2.0],
  uk: [54.0, -2.0],
  canada: [56.1, -106.3],
  germany: [51.2, 10.4],
  france: [46.2, 2.2],
  brazil: [-14.2, -51.9],
  nigeria: [9.1, 8.7],
  india: [20.6, 78.9],
  australia: [-25.3, 133.8],
  'south africa': [-30.6, 22.9],
};

// Simplified continent/region polygons [lat, lng] so Earth landmasses render clearly on the 3D sphere
const CONTINENTS = [
  // North America
  [[70,-165],[70,-95],[60,-65],[45,-65],[25,-80],[15,-85],[20,-105],[32,-117],[50,-128],[60,-145]],
  // South America
  [[11,-75],[5,-52],[-5,-35],[-22,-41],[-38,-58],[-54,-68],[-40,-73],[-18,-71],[0,-80]],
  // Europe
  [[36,-9],[43,-9],[48,-4],[58,5],[70,22],[68,40],[55,38],[45,28],[40,22],[38,12]],
  // Africa
  [[35,-6],[37,10],[31,32],[12,44],[2,45],[-12,40],[-26,33],[-34,20],[-22,14],[-5,9],[5,-8],[15,-17]],
  // Asia
  [[42,28],[55,40],[68,70],[72,115],[65,165],[50,142],[35,130],[22,114],[10,105],[8,77],[22,68],[28,48],[35,36]],
  // Australia
  [[-12,130],[-18,146],[-32,152],[-38,145],[-34,115],[-21,114]],
];

const COUNTRY_LABELS = [
  { name: 'USA', lat: 39, lng: -98 },
  { name: 'Canada', lat: 56, lng: -106 },
  { name: 'Brazil', lat: -14, lng: -52 },
  { name: 'UK', lat: 54, lng: -2 },
  { name: 'Sweden', lat: 60, lng: 16 },
  { name: 'Luxembourg', lat: 49.6, lng: 6.1 },
  { name: 'Uganda', lat: 1.4, lng: 32.3 },
  { name: 'Kenya', lat: -0.5, lng: 37.9 },
  { name: 'Nigeria', lat: 9.1, lng: 8.7 },
  { name: 'India', lat: 21, lng: 78 },
  { name: 'Japan', lat: 36, lng: 138 },
  { name: 'Australia', lat: -25, lng: 134 },
];

export function CelebrationGlobe({ boards }) {
  const canvasRef = useRef(null);
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [tip, setTip] = useState(
    boards[0] ? `Click a pin to celebrate: ${boards[0].name} (${boards[0].country})` : 'Drag to rotate · Scroll or use +/− to zoom'
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rotY = 0.35;
    let rotX = 0.22;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = false;
    let rendered = [];

    const stars = Array.from({ length: 55 }, (_, i) => ({
      x: ((i * 173) % 860),
      y: ((i * 97) % 360),
      r: i % 3 === 0 ? 1.5 : 0.9,
    }));

    const pins = boards.map((b, i) => {
      const c = COUNTRY_COORDS[String(b.country || '').toLowerCase()] || [20 + (i * 17) % 45, -60 + (i * 47) % 140];
      return { ...b, lat: c[0] + ((i % 3) - 1) * 1.5, lng: c[1] + ((i % 2) - 0.5) * 1.5, color: b.phase === 'reveal' ? '#38bdf8' : '#a78bfa' };
    });

    function project(latDeg, lngDeg, cx, cy, r) {
      const lat = (latDeg * Math.PI) / 180;
      const lng = (lngDeg * Math.PI) / 180 + rotY;
      const x0 = Math.cos(lat) * Math.sin(lng);
      const y0 = Math.sin(lat);
      const z0 = Math.cos(lat) * Math.cos(lng);

      // Apply vertical tilt rotX
      const y1 = y0 * Math.cos(rotX) - z0 * Math.sin(rotX);
      const z1 = y0 * Math.sin(rotX) + z0 * Math.cos(rotX);

      return { x: cx + x0 * r, y: cy - y1 * r, z: z1 };
    }

    let raf;
    function draw() {
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      const r = 132 * zoomRef.current;
      ctx.clearRect(0, 0, w, h);

      // Subtle starlight
      ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ocean sphere
      const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#1e3a5f');
      grad.addColorStop(0.7, '#0f2744');
      grad.addColorStop(1, '#081526');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.stroke();

      // Clip landmasses & labels inside globe
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.clip();

      // Continents
      ctx.fillStyle = 'rgba(79, 70, 229, 0.38)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 1;
      CONTINENTS.forEach(poly => {
        const pts = poly.map(([la, ln]) => project(la, ln, cx, cy, r));
        if (pts.some(p => p.z > -0.1)) {
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });

      // Country labels
      ctx.font = `600 ${Math.max(9, Math.round(10 * zoomRef.current))}px sans-serif`;
      ctx.textAlign = 'center';
      COUNTRY_LABELS.forEach(cl => {
        const p = project(cl.lat, cl.lng, cx, cy, r);
        if (p.z > 0.25) {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
          ctx.fillText(cl.name, p.x, p.y);
        }
      });
      ctx.restore();

      // Clickable celebrant pins
      rendered = [];
      pins.forEach(pin => {
        const p = project(pin.lat, pin.lng, cx, cy, r);
        if (p.z > 0.05) {
          rendered.push({ ...pin, x: p.x, y: p.y });
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = pin.color + '44';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = pin.color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      });

      if (!dragging) rotY += 0.0025;
      raf = requestAnimationFrame(draw);
    }

    const onDown = e => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = e => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        rotY += dx * 0.007;
        rotX = Math.max(-0.9, Math.min(0.9, rotX + dy * 0.005));
        lastX = e.clientX;
        lastY = e.clientY;
      }
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const hit = rendered.find(p => Math.hypot(p.x - mx, p.y - my) < 16);
      if (hit) {
        canvas.style.cursor = 'pointer';
        setTip(`🎂 ${hit.name} (${hit.country}) — Click to open board`);
      } else {
        canvas.style.cursor = dragging ? 'grabbing' : 'grab';
      }
    };
    const onClick = e => {
      if (moved) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const hit = rendered.find(p => Math.hypot(p.x - mx, p.y - my) < 18);
      if (hit) router.push(`/b/${hit.slug}`);
    };
    const onWheel = e => {
      e.preventDefault();
      setZoom(z => Math.max(0.75, Math.min(2.2, +(z + (e.deltaY < 0 ? 0.15 : -0.15)).toFixed(2))));
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    draw();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [boards, router]);

  return (
    <div style={{ background: '#0f172a', borderRadius: 20, padding: '1rem 1.25rem', color: '#fff', textAlign: 'center', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#7dd3fc' }}>🌍 Live Celebration Globe</span>
        <span style={{ fontSize: '.78rem', color: '#cbd5e1' }}>{tip}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setZoom(z => Math.max(0.75, +(z - 0.2).toFixed(2)))} style={zoomBtnStyle} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setZoom(1)} style={zoomBtnStyle} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(z => Math.min(2.2, +(z + 0.2).toFixed(2)))} style={zoomBtnStyle} aria-label="Zoom in">+</button>
        </div>
      </div>

      <canvas ref={canvasRef} width={860} height={350} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'grab' }} />

      {boards.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {boards.slice(0, 8).map(b => (
            <button
              key={b.slug}
              type="button"
              onClick={() => router.push(`/b/${b.slug}`)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(125,211,252,0.35)',
                color: '#e0f2fe',
                borderRadius: 999,
                padding: '.25rem .65rem',
                fontSize: '.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🎂 {b.name} · {b.country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#ffffff',
  borderRadius: 8,
  padding: '0.2rem 0.55rem',
  fontSize: '0.76rem',
  fontWeight: 700,
  cursor: 'pointer',
};
