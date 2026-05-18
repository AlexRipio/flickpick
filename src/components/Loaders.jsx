import React from 'react';

/**
 * Familia de loaders consistentes con la marca FlickPick.
 *
 *   <FlameSpinner size={32} />        spinner radial gradient flame
 *   <SkeletonPoster aspect="2/3" />   placeholder de poster con shimmer
 *   <SkeletonText  width="60%" />     línea de texto placeholder
 *   <LoadingHero />                   skeleton compuesto para tendencias
 *   <LoadingGrid count={6} />         grilla de skeleton posters
 *   <LoadingMessage>...</LoadingMessage> spinner + texto suave
 */

const SHIMMER = 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%)';

export const FlameSpinner = ({ size = 28, label = 'Cargando' }) => (
  <div role="status" aria-label={label} style={{
    width: size, height: size, position: 'relative', display: 'inline-block',
  }}>
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ animation: 'fp-spin 0.95s linear infinite' }}>
      <defs>
        <linearGradient id="fp-flame-spin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor="#FFB547"/>
          <stop offset="35%" stopColor="#FF6B4A"/>
          <stop offset="65%" stopColor="#FF3B6B"/>
          <stop offset="100%" stopColor="#9B3BFF"/>
        </linearGradient>
      </defs>
      <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
      <circle cx="25" cy="25" r="20" fill="none"
        stroke="url(#fp-flame-spin)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray="90 200"/>
    </svg>
    <style>{`@keyframes fp-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const SkeletonPoster = ({ aspect = '2/3', radius = 14 }) => (
  <div style={{
    aspectRatio: aspect, borderRadius: radius, overflow: 'hidden',
    background: SHIMMER, backgroundSize: '200% 100%',
    animation: 'fp-shimmer 1.4s linear infinite',
  }}/>
);

export const SkeletonText = ({ width = '100%', height = 12, radius = 6, marginTop = 0 }) => (
  <div style={{
    width, height, borderRadius: radius, marginTop,
    background: SHIMMER, backgroundSize: '200% 100%',
    animation: 'fp-shimmer 1.4s linear infinite',
  }}/>
);

export const LoadingHero = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{
      width: '100%', height: 240, borderRadius: 24,
      background: SHIMMER, backgroundSize: '200% 100%',
      animation: 'fp-shimmer 1.4s linear infinite',
    }}/>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <SkeletonPoster/>
      <SkeletonPoster/>
    </div>
  </div>
);

export const LoadingGrid = ({ count = 6, columns = 'repeat(auto-fill, minmax(105px, 1fr))', gap = 10 }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: columns, gap,
  }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonPoster key={i}/>
    ))}
  </div>
);

export const LoadingMessage = ({ children = 'Cargando…', size = 28 }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    padding: '40px 20px', color: 'rgba(255,255,255,0.65)',
    fontFamily: '"Space Grotesk", system-ui',
    fontSize: 14, fontWeight: 600,
  }}>
    <FlameSpinner size={size}/>
    <span>{children}</span>
  </div>
);

// Global keyframes — declared once and reused by every loader.
export const LoadersGlobalCSS = () => (
  <style>{`
    @keyframes fp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `}</style>
);
