import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, FullLogo } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';

const SplashScreen = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  useEffect(() => {
    const t = setTimeout(() => {
      navigate(profile?.name ? '/home' : '/welcome', { replace: true });
    }, 1400);
    return () => clearTimeout(t);
  }, [navigate, profile]);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 28, background: '#07050E',
    }}>
      <AmbientBackdrop hue={320}/>
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        animation: 'fp-entrance 0.8s ease-out both',
      }}>
        <div style={{ animation: 'fp-pulse 2.4s ease-in-out infinite' }}>
          <FullLogo size={240} animated/>
        </div>
        <div style={{
          fontSize: 13, color: FP.textDim, letterSpacing: 4,
          textTransform: 'uppercase', marginTop: -6,
          animation: 'fp-entrance 0.8s 0.3s ease-out both',
        }}>
          Swipe. Match. Watch.
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
