import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop } from '@/components/fp/primitives';
import { useProfile } from '@/contexts/ProfileContext';

const SPLASH_DURATION = 1500; // ms · entry (700) + hold (200) + launch (600)

const SplashScreen = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  useEffect(() => {
    const t = setTimeout(() => {
      navigate(profile?.name ? '/home' : '/welcome', { replace: true });
    }, SPLASH_DURATION);
    return () => clearTimeout(t);
  }, [navigate, profile]);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#07050E', overflow: 'hidden',
    }}>
      <AmbientBackdrop hue={320}/>
      {/* Outer: launch (transform) — kicks in after entry/hold */}
      <div className="fp-splash-launch" style={{ position: 'relative', zIndex: 2, willChange: 'transform, opacity' }}>
        {/* Inner: fade-in entry (opacity) */}
        <div className="fp-splash-entry" style={{ willChange: 'opacity, transform' }}>
          <img
            src="/imagotipo-hd.png"
            alt="FlickPick"
            draggable={false}
            style={{
              width: 220, height: 220,
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes fp-splash-entry {
          0%   { opacity: 0; transform: scale(0.82); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fp-splash-launch {
          0%,55%  { transform: scale(1);    opacity: 1; }
          65%     { transform: scale(0.94); opacity: 1; }
          100%    { transform: scale(26);   opacity: 0; }
        }
        .fp-splash-entry  { animation: fp-splash-entry 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .fp-splash-launch { animation: fp-splash-launch 1.5s ease-in forwards; }
      `}</style>
    </div>
  );
};

export default SplashScreen;
