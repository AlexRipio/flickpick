import React from 'react';
import { posterUrl } from '@/lib/tmdb';

// hash movie id/title to a stable hue + seed for generative fallback
function hueFor(m) {
  const s = String(m?.id ?? m?.title ?? 'x');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Poster({ movie, showBadge = true, size = 'w780', style = {} }) {
  const real = posterUrl(movie?.poster_path, size);
  const hue = hueFor(movie) % 360;
  const seed = (hueFor(movie) % 10000) + 1;
  const title = movie?.title || movie?.name || '';
  const year = movie?.release_date ? movie.release_date.slice(0, 4) : '';
  const rating = movie?.vote_average || 0;
  const type = movie?.type || 'MOVIE';

  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden',
      background: real ? '#1a0f2e' : undefined,
      ...style,
    }}>
      {real ? (
        // key={real} forces React to mount a fresh <img> when the URL
        // changes — without it the browser briefly shows the previous
        // poster while the new bytes download (bug: "wrong cover that
        // changes after a moment"). Combined with the fade-in onLoad,
        // every poster appears only once it's actually decoded.
        <img
          key={real}
          src={real}
          alt={title}
          loading="eager"
          decoding="async"
          onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            opacity: 0, transition: 'opacity 0.18s ease-out',
          }}
          draggable={false}
        />
      ) : (
        <GenerativeBackdrop hue={hue} seed={seed}/>
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)',
      }}/>
      {showBadge && (
        <>
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '4px 9px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            backdropFilter: 'blur(8px)',
            border: '0.5px solid rgba(255,255,255,0.25)',
          }}>{type}</div>
          {rating > 0 && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              padding: '4px 9px', borderRadius: 999,
              fontSize: 11, fontWeight: 700,
              background: 'rgba(0,0,0,0.55)', color: '#FFD166',
              backdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFD166">
                <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.5l7.1-.6z"/>
              </svg>
              {rating.toFixed(1)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GenerativeBackdrop({ hue, seed }) {
  const bg = `
    radial-gradient(120% 80% at 20% 10%, oklch(0.42 0.22 ${hue}) 0%, transparent 60%),
    radial-gradient(100% 70% at 85% 90%, oklch(0.32 0.20 ${(hue + 40) % 360}) 0%, transparent 55%),
    linear-gradient(180deg, oklch(0.18 0.10 ${hue}) 0%, oklch(0.08 0.05 ${hue}) 100%)
  `;
  const rng = (n) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg }}>
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`g-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={`oklch(0.75 0.18 ${hue})`} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={`oklch(0.35 0.22 ${(hue + 60) % 360})`} stopOpacity="0.4"/>
          </linearGradient>
        </defs>
        <ellipse cx={200 + (rng(1) - 0.5) * 80} cy={240} rx={120} ry={170}
          fill={`url(#g-${seed})`} opacity="0.75"/>
        {Array.from({ length: 8 }).map((_, i) => (
          <circle key={i}
            cx={rng(i + 10) * 400} cy={rng(i + 30) * 300}
            r={rng(i + 50) * 1.4 + 0.4}
            fill="#fff" opacity={0.6 + rng(i + 70) * 0.4}/>
        ))}
      </svg>
    </div>
  );
}

export default Poster;
