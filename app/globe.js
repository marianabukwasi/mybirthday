'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';

const COUNTRIES = feature(worldData, worldData.objects.countries).features;
const GRATICULE = geoGraticule10();

// Find [lng, lat] for a country name using the real Natural Earth dataset
function coordsForCountry(countryName) {
  const q = String(countryName || '').trim().toLowerCase();
  const aliases = { usa: 'united states of america', uk: 'united kingdom' };
  const target = aliases[q] || q;
  const match = COUNTRIES.find(c => String(c.properties?.name || '').toLowerCase() === target)
    || COUNTRIES.find(c => String(c.properties?.name || '').toLowerCase().includes(target));
  if (match) return geoCentroid(match);
  return [18.0, 59.3];
}

export function CelebrationGlobe({ boards }) {
  const canvasRef = useRef(null);
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [tip, setTip] = useState(
    boards[0] ? `🎂 ${boards[0].name} (${boards[0].country}) — Click pin to open` : 'Drag to rotate · Scroll or +/− to zoom · Hover any country'
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const baseRadius = 152;

    let rot = [-15, -22, 0];
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let hoveredCountryId = null;
    let renderedPins = [];

    const pins = boards.map((b, i) => {
      const [lng, lat] = coordsForCountry(b.country);
      return {
        ...b,
        lng: lng + ((i % 3) - 1) * 1.2,
        lat: lat + ((i % 2) - 0.5) * 1.2,
        color: b.phase === 'reveal' ? '#38bdf8' : '#a78bfa',
      };
    });

    const activeCountryNames = new Set(boards.map(b => String(b.country || '').trim().toLowerCase()));

    const projection = geoOrthographic().translate([w / 2, h / 2]).clipAngle(90);
    const path = geoPath(projection, ctx);

    let raf;
    function draw() {
      const r = baseRadius * zoomRef.current;
      projection.scale(r).rotate(rot);

      ctx.clearRect(0, 0, w, h);

      // Ocean sphere
      ctx.beginPath();
      path({ type: 'Sphere' });
      const oceanGrad = ctx.createRadialGradient(w / 2 - r * 0.28, h / 2 - r * 0.28, r * 0.1, w / 2, h / 2, r);
      oceanGrad.addColorStop(0, '#1e3a5f');
      oceanGrad.addColorStop(0.75, '#0f2744');
      oceanGrad.addColorStop(1, '#081526');
      ctx.fillStyle = oceanGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Latitude / longitude grid
      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Real Natural Earth countries
      COUNTRIES.forEach(c => {
        const cName = String(c.properties?.name || '').toLowerCase();
        const hasCelebrant = activeCountryNames.has(cName);
        const isHovered = hoveredCountryId === c.id;

        ctx.beginPath();
        path(c);
        ctx.fillStyle = isHovered
          ? 'rgba(56, 189, 248, 0.55)'
          : hasCelebrant
          ? 'rgba(99, 102, 241, 0.72)'
          : 'rgba(79, 70, 229, 0.34)';
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#bae6fd' : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = isHovered ? 1.2 : 0.6;
        ctx.stroke();
      });

      // Celebrant pins
      renderedPins = [];
      pins.forEach(pin => {
        // Check if pin is on visible front hemisphere
        const center = [-rot[0], -rot[1]];
        const dist = Math.acos(
          Math.max(-1, Math.min(1,
            Math.sin((center[1] * Math.PI) / 180) * Math.sin((pin.lat * Math.PI) / 180) +
            Math.cos((center[1] * Math.PI) / 180) * Math.cos((pin.lat * Math.PI) / 180) *
            Math.cos(((pin.lng - center[0]) * Math.PI) / 180)
          ))
        );
        if (dist < Math.PI / 2) {
          const pt = projection([pin.lng, pin.lat]);
          if (pt) {
            renderedPins.push({ ...pin, x: pt[0], y: pt[1] });
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 10, 0, Math.PI * 2);
            ctx.fillStyle = pin.color + '44';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2);
            ctx.fillStyle = pin.color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
        }
      });

      if (!dragging) rot[0] += 0.16;
      raf = requestAnimationFrame(draw);
    }

    const onDown = e => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = e => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        rot = [rot[0] + dx * 0.35 / zoomRef.current, Math.max(-80, Math.min(80, rot[1] - dy * 0.35 / zoomRef.current)), 0];
        lastX = e.clientX;
        lastY = e.clientY;
      }

      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (w / rect.width);
      const my = (e.clientY - rect.top) * (h / rect.height);

      // 1. Check celebrant pin hit
      const hitPin = renderedPins.find(p => Math.hypot(p.x - mx, p.y - my) < 15);
      if (hitPin) {
        canvas.style.cursor = 'pointer';
        hoveredCountryId = null;
        setTip(`🎂 ${hitPin.name} (${hitPin.country}) — Click to open board`);
        return;
      }

      // 2. Check real country under cursor
      const lonLat = projection.invert([mx, my]);
      if (lonLat && !Number.isNaN(lonLat[0])) {
        const hitCountry = COUNTRIES.find(c => geoContains(c, lonLat));
        if (hitCountry) {
          hoveredCountryId = hitCountry.id;
          const name = hitCountry.properties?.name || 'Country';
          const count = boards.filter(b => String(b.country || '').toLowerCase() === name.toLowerCase()).length;
          canvas.style.cursor = dragging ? 'grabbing' : 'grab';
          setTip(count > 0 ? `${name} · ${count} celebrating` : name);
          return;
        }
      }
      hoveredCountryId = null;
      canvas.style.cursor = dragging ? 'grabbing' : 'grab';
    };

    const onClick = e => {
      if (moved) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (w / rect.width);
      const my = (e.clientY - rect.top) * (h / rect.height);
      const hitPin = renderedPins.find(p => Math.hypot(p.x - mx, p.y - my) < 17);
      if (hitPin) {
        router.push(`/b/${hitPin.slug}`);
      }
    };

    const onWheel = e => {
      e.preventDefault();
      setZoom(z => Math.max(0.75, Math.min(2.6, +(z + (e.deltaY < 0 ? 0.18 : -0.18)).toFixed(2))));
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
          <button type="button" onClick={() => setZoom(z => Math.max(0.75, +(z - 0.25).toFixed(2)))} style={zoomBtnStyle} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setZoom(1)} style={zoomBtnStyle} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(z => Math.min(2.6, +(z + 0.25).toFixed(2)))} style={zoomBtnStyle} aria-label="Zoom in">+</button>
        </div>
      </div>

      <canvas ref={canvasRef} width={860} height={360} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'grab' }} />

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
