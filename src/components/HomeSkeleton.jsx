import React from 'react';
import { AmbientBackdrop } from '@/components/fp/primitives';

const SHIMMER = 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%)';
const shimmerStyle = {
  background: SHIMMER,
  backgroundSize: '200% 100%',
  animation: 'fp-shimmer 1.4s linear infinite',
};

const Bar = ({ w = '100%', h = 14, r = 8, mt = 0 }) => (
  <div style={{ width: w, height: h, borderRadius: r, marginTop: mt, ...shimmerStyle }} />
);

const PosterCard = ({ w = 120 }) => (
  <div style={{
    flex: '0 0 auto', width: w, aspectRatio: '2 / 3', borderRadius: 14, ...shimmerStyle,
  }}/>
);

export default function HomeSkeleton() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#07050E' }}>
      <AmbientBackdrop hue={290}/>
      <div
        className="no-scrollbar"
        style={{
          position: 'relative', zIndex: 2,
          padding: '24px 24px var(--fp-content-bottom)', flex: 1, overflow: 'hidden',
          maxWidth: 520, width: '100%', margin: '0 auto',
          animation: 'fp-fade-in 0.35s ease-out both',
        }}
      >
        {/* Header — imagotipo real (instantáneo) + skeleton avatar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <img
            src="/imagotipo.webp"
            alt="FlickPick"
            style={{ height: 42, width: 'auto', display: 'block', opacity: 0.92 }}
            onError={(e) => { if (e.currentTarget.src.indexOf('logo.png') === -1) e.currentTarget.src = '/logo.png'; }}
          />
          <div style={{ width: 40, height: 40, borderRadius: 999, ...shimmerStyle }} />
        </div>

        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <Bar w={110} h={10} r={5} />
          <Bar w={'85%'} h={30} r={10} mt={14} />
          <Bar w={'65%'} h={30} r={10} mt={8} />
        </div>

        {/* Active-room card placeholder */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: 18, borderRadius: 22, marginBottom: 28,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, ...shimmerStyle }} />
          <div style={{ flex: 1 }}>
            <Bar w={'60%'} h={12} r={6} />
            <Bar w={'40%'} h={10} r={5} mt={8} />
          </div>
        </div>

        {/* Trending row title */}
        <Bar w={140} h={14} r={6} />
        {/* Trending row posters */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14, marginBottom: 28, overflow: 'hidden' }}>
          <PosterCard /><PosterCard /><PosterCard /><PosterCard />
        </div>

        {/* Watchlist row title */}
        <Bar w={120} h={14} r={6} />
        <div style={{ display: 'flex', gap: 12, marginTop: 14, overflow: 'hidden' }}>
          <PosterCard /><PosterCard /><PosterCard /><PosterCard />
        </div>
      </div>
    </div>
  );
}
