import React, { useEffect, useState } from 'react';
import { FP } from '@/lib/fp';

export function GradientButton({ children, onClick, style = {}, variant = 'flame', disabled, type = 'button' }) {
  const grads = {
    flame:  FP.flame,
    violet: FP.violet,
    ghost:  'transparent',
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      width: '100%', height: 56, borderRadius: 999,
      background: grads[variant],
      border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.18)' : 'none',
      color: '#fff',
      fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
      fontSize: 16, fontWeight: 700, letterSpacing: 0.2,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      boxShadow: variant === 'flame'
        ? '0 8px 24px rgba(255,59,107,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
        : variant === 'violet'
          ? '0 8px 24px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
          : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'transform 0.12s, box-shadow 0.2s',
      ...style,
    }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >{children}</button>
  );
}

export function IconButton({ children, onClick, style = {}, size = 48, ariaLabel }) {
  return (
    <button aria-label={ariaLabel} onClick={onClick} style={{
      width: size, height: size, borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: '#fff', cursor: 'pointer', padding: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      ...style,
    }}>{children}</button>
  );
}

export function Chip({ active, onClick, children, size = 'md' }) {
  const pad = size === 'sm' ? '6px 12px' : '10px 16px';
  const fs = size === 'sm' ? 12 : 14;
  return (
    <button onClick={onClick} style={{
      padding: pad, borderRadius: 999,
      background: active ? FP.flame : 'rgba(255,255,255,0.06)',
      color: active ? '#fff' : FP.textDim,
      border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
      fontFamily: '"Inter", system-ui',
      fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
      cursor: 'pointer',
      boxShadow: active ? '0 4px 14px rgba(255,59,107,0.3)' : 'none',
      transition: 'all 0.18s',
      whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

export function TextField({ label, value, onChange, type = 'text', placeholder, icon, autoFocus }) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: FP.textDim,
          letterSpacing: 1, textTransform: 'uppercase',
          marginBottom: 8, paddingLeft: 4,
        }}>{label}</div>
      )}
      <div style={{
        height: 56, borderRadius: 16,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
      }}>
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: FP.text, fontSize: 16,
            fontFamily: '"Inter", system-ui',
          }}
        />
      </div>
    </div>
  );
}

export function AmbientBackdrop({ hue = 280 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0,
      background: `
        radial-gradient(80% 50% at 15% 0%, oklch(0.35 0.18 ${hue}) 0%, transparent 50%),
        radial-gradient(80% 50% at 100% 100%, oklch(0.30 0.18 ${(hue + 50) % 360}) 0%, transparent 55%),
        linear-gradient(180deg, #07050E 0%, #12091F 100%)
      `,
    }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,107,74,0.25), transparent 60%)',
        filter: 'blur(40px)',
      }}/>
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-15%',
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,59,255,0.28), transparent 60%)',
        filter: 'blur(40px)',
      }}/>
    </div>
  );
}

/**
 * FlameMark — the real logo image, mark only (no text).
 * Uses public/logo.png cropped via object-position to hide the "FlickPick" text beneath it.
 */
export function FlameMark({ size = 28, animated = false }) {
  return (
    <div style={{
      width: size, height: size,
      position: 'relative', display: 'block', flexShrink: 0,
      filter: animated ? 'drop-shadow(0 4px 12px rgba(255,107,74,0.35))' : 'none',
    }}>
      {animated && (
        <div style={{
          position: 'absolute', inset: '-20%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.35), transparent 60%)',
          filter: 'blur(8px)',
          animation: 'fp-glow 2.6s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>
      )}
      <img
        src="/logo.png"
        alt="FlickPick"
        className={animated ? 'fp-flame-flicker' : undefined}
        style={{
          width: '100%', height: '100%',
          // Crop out the "FlickPick" text at the bottom by scaling the image taller and showing the top.
          objectFit: 'cover',
          objectPosition: 'center top',
          // The mark occupies the top ~64% of the image; scale so that portion fills the circle.
          transform: 'scale(1.55) translateY(-14%)',
          transformOrigin: 'center top',
          pointerEvents: 'none',
          userSelect: 'none',
          position: 'relative',
          zIndex: 1,
        }}
        draggable={false}
      />
    </div>
  );
}

export function FlickPickWordmark({ height = 24, color }) {
  return (
    <div style={{
      fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
      fontSize: height,
      fontWeight: 800,
      letterSpacing: -0.5,
      lineHeight: 1,
      background: color || FP.flame,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      display: 'inline-block',
    }}>FlickPick</div>
  );
}

/** Full FlickPick logo — mark + wordmark baked in. Uses the real PNG. */
export function FullLogo({ size = 240, animated = false }) {
  return (
    <div style={{
      width: size, height: size,
      position: 'relative',
      filter: 'drop-shadow(0 14px 40px rgba(255,90,120,0.35))',
    }}>
      {animated && (
        <div style={{
          position: 'absolute', inset: '-10%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.30), transparent 60%)',
          filter: 'blur(20px)',
          animation: 'fp-glow 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>
      )}
      <img
        src="/logo.png"
        alt="FlickPick"
        className={animated ? 'fp-flame-flicker' : undefined}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          position: 'relative', zIndex: 1,
          pointerEvents: 'none', userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  );
}

/** Official Google icon (multicolor G). */
export function GoogleGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block' }}>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.1 0-9.4-3.2-11.1-7.8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.6 1.8-1.8 3.3-3.3 4.4l6.2 5.2c.5-.4 6.4-4.6 6.4-13.6 0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

export function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = ['#FF6B4A', '#FF3B6B', '#9B3BFF', '#4EFFD6', '#FFB547', '#8B5CF6'];
    const color = colors[i % colors.length];
    const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 180 + Math.random() * 280;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    const delay = Math.random() * 0.25;
    const size = 6 + Math.random() * 10;
    const rot = Math.random() * 720 - 360;
    const shape = i % 3;
    return { dx, dy, delay, size, rot, color, shape, i };
  });
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
      overflow: 'hidden',
    }}>
      {pieces.map((p) => (
        <div key={p.i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: p.size, height: p.shape === 2 ? p.size * 0.4 : p.size,
          background: p.color,
          borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? '3px' : '1px',
          transform: 'translate(-50%, -50%)',
          animation: `confetti-${p.i} 1.4s cubic-bezier(.1,.6,.2,1) ${p.delay}s forwards`,
          opacity: 0,
        }}/>
      ))}
      <style>{pieces.map(p => `
        @keyframes confetti-${p.i} {
          0%   { transform: translate(-50%,-50%) scale(0.2) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(1) rotate(${p.rot}deg); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  );
}

export function Avatar({ name, color, size = 40, initial, avatarUrl, ring, style = {} }) {
  const ini = initial || (name || '?').trim().charAt(0).toUpperCase();
  const baseBorder = ring ? `2px solid ${ring}` : 'none';
  if (avatarUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 999,
        overflow: 'hidden', flexShrink: 0,
        background: '#1a0f2e',
        border: baseBorder,
        ...style,
      }}>
        <img
          src={avatarUrl}
          alt={name || 'avatar'}
          loading="lazy"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none' }}
        />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Space Grotesk", system-ui', fontWeight: 700, fontSize: size * 0.4,
      flexShrink: 0,
      border: baseBorder,
      ...style,
    }}>{ini}</div>
  );
}

export function BackButton({ onClick, size = 42 }) {
  return (
    <IconButton onClick={onClick} size={size} ariaLabel="Back">
      <svg width={Math.round(size * 0.33)} height={Math.round(size * 0.33)} viewBox="0 0 14 14" fill="none">
        <path d="M9 2L3 7l6 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconButton>
  );
}
