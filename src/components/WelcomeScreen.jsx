import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, FullLogo, GoogleGlyph, GradientButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getTrending } from '@/lib/tmdb';
import { signInWithGoogle } from '@/lib/auth';

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { setProfileFields } = useProfile();
  const [posters, setPosters] = useState([]);
  const [gLoading, setGLoading] = useState(false);

  useEffect(() => {
    getTrending({ page: 1 })
      .then(list => setPosters(list.slice(0, 7)))
      .catch(() => setPosters([]));
  }, []);

  // Bigger posters, more dispersed, more dynamic motion.
  const positions = [
    { top: '-2%',  left: '-14%', rot: -14, scale: 0.95, dur: 7.5, delay: 0 },
    { top: '-6%',  right: '-12%', rot: 10, scale: 1.0,  dur: 8.0, delay: 0.3 },
    { top: '18%',  left: '38%',   rot:  -6, scale: 0.8,  dur: 9.0, delay: 0.6 },
    { top: '28%',  left: '-8%',   rot:   8, scale: 0.9,  dur: 7.2, delay: 0.9 },
    { top: '32%',  right: '-10%', rot:  16, scale: 0.95, dur: 8.4, delay: 1.2 },
    { top: '52%',  left: '14%',   rot:  -10, scale: 0.78, dur: 9.6, delay: 1.5 },
    { top: '48%',  right: '8%',   rot:   4, scale: 0.72, dur: 7.8, delay: 1.8 },
  ];

  const onGoogle = async () => {
    setGLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res?.profile) {
        setProfileFields(res.profile);
        navigate('/home', { replace: true });
      }
    } catch (e) {
      alert(e.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setGLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <AmbientBackdrop hue={300}/>

      {/* Floating poster collage — bigger, richer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {positions.map((p, i) => {
          const movie = posters[i];
          return (
            <div key={i} style={{
              position: 'absolute', ...p,
              width: 240, height: 340,
              transform: `rotate(${p.rot}deg) scale(${p.scale})`,
              borderRadius: 26, overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
              opacity: 0,
              animation: `fp-poster-enter-${i} 0.9s ${0.05 + i * 0.08}s cubic-bezier(.2,.8,.3,1.1) both,
                          fp-float-${i} ${p.dur}s ${p.delay}s ease-in-out infinite`,
            }}>
              {movie ? <Poster movie={movie} showBadge={false}/> : (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(135deg, hsl(${i*50}, 65%, 32%), hsl(${i*50+60}, 70%, 18%))`,
                }}/>
              )}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(80% 60% at 50% 30%, transparent 40%, rgba(7,5,14,0.6) 100%)',
              }}/>
            </div>
          );
        })}
      </div>

      {/* Strong fade overlay so posters feel like they live in the scene */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        background: `
          linear-gradient(180deg, rgba(7,5,14,0.10) 0%, rgba(7,5,14,0.55) 42%, rgba(7,5,14,0.96) 72%, #07050E 92%),
          radial-gradient(70% 50% at 50% 30%, rgba(155,59,255,0.15), transparent 60%)
        `,
      }}/>

      {/* Content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', flexDirection: 'column',
        padding: '36px 24px 32px', justifyContent: 'space-between',
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fp-entrance 0.8s ease-out both',
        }}>
          <FullLogo size={108} animated/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ animation: 'fp-entrance 0.8s 0.15s ease-out both' }}>
            <h1 style={{
              fontFamily: '"Syne", "Space Grotesk", system-ui',
              fontSize: 48, fontWeight: 800, letterSpacing: -2,
              color: FP.text, margin: 0, lineHeight: 1.0,
            }}>
              Acaba con<br/>
              <span style={{
                background: FP.flame,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '220% 100%',
                animation: 'fp-shimmer 3.5s linear infinite',
              }}>la guerra del scroll.</span>
            </h1>
            <p style={{
              fontSize: 16, color: FP.textDim, margin: '14px 0 0',
              lineHeight: 1.5, maxWidth: 340,
            }}>
              Desliza juntos. Haced match al instante. Ved la que os apetece a ambos.
            </p>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 12,
            animation: 'fp-entrance 0.8s 0.28s ease-out both',
          }}>
            <GradientButton variant="flame" onClick={() => navigate('/signup')}>
              Empieza — es gratis
            </GradientButton>
            <GradientButton variant="ghost" onClick={onGoogle} disabled={gLoading}>
              <GoogleGlyph size={18}/>
              {gLoading ? 'Conectando…' : 'Continuar con Google'}
            </GradientButton>
            <button onClick={() => navigate('/signin')} style={{
              background: 'transparent', border: 'none', color: FP.textDim,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 0',
              fontFamily: '"Inter", system-ui',
            }}>
              ¿Ya tienes cuenta? <span style={{ color: FP.flameSolid }}>Inicia sesión</span>
            </button>
          </div>

          <div style={{
            fontSize: 11, color: FP.textMuted, textAlign: 'center',
            maxWidth: 300, margin: '0 auto', lineHeight: 1.5,
            animation: 'fp-entrance 0.8s 0.36s ease-out both',
          }}>
            Al continuar aceptas los Términos y la Política de Privacidad.
          </div>
        </div>
      </div>

      <style>{`
        ${positions.map((p, i) => {
          const fx = (Math.sin(i) * 12).toFixed(1);
          const fy = (-10 - (i % 3) * 4).toFixed(1);
          const fr = (p.rot + (i % 2 === 0 ? 3 : -3)).toFixed(1);
          return `
            @keyframes fp-float-${i} {
              0%, 100% { transform: rotate(${p.rot}deg) scale(${p.scale}) translate(0, 0); }
              50%      { transform: rotate(${fr}deg) scale(${(p.scale * 1.02).toFixed(3)}) translate(${fx}px, ${fy}px); }
            }
            @keyframes fp-poster-enter-${i} {
              0%   { opacity: 0; transform: rotate(${p.rot - 8}deg) scale(${(p.scale * 0.6).toFixed(3)}) translateY(40px); }
              100% { opacity: 0.88; transform: rotate(${p.rot}deg) scale(${p.scale}) translateY(0); }
            }
          `;
        }).join('\n')}
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
