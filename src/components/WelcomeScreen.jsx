import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, FullLogo, GradientButton, GoogleGlyph } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getTrending } from '@/lib/tmdb';
import { processGoogleUserInfo } from '@/lib/auth';
import { consumePendingJoin } from '@/lib/pendingJoin';

function postAuthDestination() {
  const code = consumePendingJoin();
  return code ? `/g/${code}` : '/home';
}

const GOOGLE_CLIENT_ID = '480695177694-uip9jvgsh4gf7rhg03q2omskad5j1ai8.apps.googleusercontent.com';
// iOS necesita su propio "ID de cliente OAuth (iOS)" creado en Google Cloud
// con bundle id mov.flickpick.app. Pegar aquí el client id de iOS cuando exista
// (formato: XXXX-XXXX.apps.googleusercontent.com). Vacío = Google solo va en Android.
const GOOGLE_IOS_CLIENT_ID = '480695177694-c4kckc94arhgedel7mt1kndrnl11j2lj.apps.googleusercontent.com';

// True when running inside the Capacitor native shell (the store app).
// We soften GPU-heavy infinite animations there to avoid WebView flicker;
// the web keeps the full animation.
const IS_NATIVE = typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { setProfileFields } = useProfile();
  const [posters, setPosters] = useState([]);
  const [gError, setGError] = useState('');
  const [gLoading, setGLoading] = useState(false);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    getTrending({ page: 1 })
      .then(list => setPosters(list.slice(0, 7)))
      .catch(() => setPosters([]));
  }, []);

  useEffect(() => {
    const init = () => {
      if (!window.google?.accounts?.oauth2) return;
      try {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (response) => {
            if (!response?.access_token) return;
            setGError('');
            setGLoading(true);
            try {
              const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              const userInfo = await r.json();
              const { profile } = await processGoogleUserInfo(userInfo);
              if (profile) {
                setProfileFields(profile);
                navigate(postAuthDestination(), { replace: true });
              }
            } catch (e) {
              setGError(e.message || 'Error al iniciar sesion con Google.');
            } finally {
              setGLoading(false);
            }
          },
        });
      } catch {}
    };
    const timer = setTimeout(init, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleClick = async () => {
    // Native (in-app): GIS popup is blocked by Google in WebViews, so use the
    // native Google sign-in plugin instead. Web keeps the GIS token client.
    if (IS_NATIVE) {
      setGError('');
      setGLoading(true);
      try {
        const { SocialLogin } = await import('@capgo/capacitor-social-login');
        const platform = window.Capacitor?.getPlatform?.();
        const googleCfg = { webClientId: GOOGLE_CLIENT_ID };
        if (platform === 'ios' && GOOGLE_IOS_CLIENT_ID) googleCfg.iOSClientId = GOOGLE_IOS_CLIENT_ID;
        await SocialLogin.initialize({ google: googleCfg });
        // No `scopes`: basic Google sign-in via Credential Manager returns
        // name/email/photo and needs no MainActivity changes. Requesting
        // scopes would require extra native wiring we don't need.
        const res = await SocialLogin.login({ provider: 'google', options: {} });
        const r = (res && res.result) || {};
        const pr = r.profile || {};
        const userInfo = {
          sub: pr.id,
          email: pr.email,
          name: pr.name || [pr.givenName, pr.familyName].filter(Boolean).join(' '),
          picture: pr.imageUrl || pr.picture || null,
        };
        const { profile } = await processGoogleUserInfo(userInfo);
        if (profile) {
          setProfileFields(profile);
          navigate(postAuthDestination(), { replace: true });
        }
      } catch (e) {
        setGError(e?.message || 'No se pudo iniciar sesion con Google.');
      } finally {
        setGLoading(false);
      }
      return;
    }
    if (!tokenClientRef.current) return;
    setGError('');
    tokenClientRef.current.requestAccessToken();
  };

  const positions = [
    { top: '-2%',  left: '-14%', rot: -14, scale: 0.95, dur: 7.5, delay: 0 },
    { top: '-6%',  right: '-12%', rot: 10, scale: 1.0,  dur: 8.0, delay: 0.3 },
    { top: '18%',  left: '38%',   rot:  -6, scale: 0.8,  dur: 9.0, delay: 0.6 },
    { top: '28%',  left: '-8%',   rot:   8, scale: 0.9,  dur: 7.2, delay: 0.9 },
    { top: '32%',  right: '-10%', rot:  16, scale: 0.95, dur: 8.4, delay: 1.2 },
    { top: '52%',  left: '14%',   rot:  -10, scale: 0.78, dur: 9.6, delay: 1.5 },
    { top: '48%',  right: '8%',   rot:   4, scale: 0.72, dur: 7.8, delay: 1.8 },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <AmbientBackdrop hue={300}/>

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {positions.map((p, i) => {
          const movie = posters[i];
          return (
            <div key={i} style={{
              position: 'absolute', ...p,
              width: 240, height: 340,
              transform: `rotate(${p.rot}deg) scale(${p.scale}) translateZ(0)`,
              borderRadius: 26, overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
              opacity: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform, opacity',
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

      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        background: `
          linear-gradient(180deg, rgba(7,5,14,0.10) 0%, rgba(7,5,14,0.55) 42%, rgba(7,5,14,0.96) 72%, #07050E 92%),
          radial-gradient(70% 50% at 50% 30%, rgba(155,59,255,0.15), transparent 60%)
        `,
      }}/>

      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', flexDirection: 'column',
        padding: '36px 24px 32px', justifyContent: 'space-between',
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fp-entrance 0.8s ease-out both' }}>
          <FullLogo size={108} animated/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ animation: 'fp-entrance 0.8s 0.15s ease-out both' }}>
            <h1 style={{
              fontFamily: '"Inter", "Space Grotesk", system-ui',
              fontSize: 48, fontWeight: 800, letterSpacing: -2,
              color: FP.text, margin: 0, lineHeight: 1.0,
            }}>
              Acaba con<br/>
              <span style={{
                backgroundImage: 'linear-gradient(135deg,#FFB547,#FF6B4A,#FF3B6B,#9B3BFF,#FF3B6B,#FF6B4A,#FFB547)',
                backgroundSize: '200% 100%',
                backgroundRepeat: 'repeat',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
                willChange: 'background-position',
                animation: 'fp-flame-flow 3.5s linear infinite',
              }}>la guerra del scroll.</span>
            </h1>
            <p style={{ fontSize: 16, color: FP.textDim, margin: '14px 0 0', lineHeight: 1.5, maxWidth: 340 }}>
              Desliza juntos. Haced match al instante. Ved la que os apetece a ambos.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fp-entrance 0.8s 0.28s ease-out both' }}>
            <GradientButton variant="flame" onClick={() => navigate('/signup')}>
              Empieza — es gratis
            </GradientButton>

            <button
              onClick={handleGoogleClick}
              disabled={gLoading}
              style={{
                width: '100%',
                height: 56,
                borderRadius: 999,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 0.2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: gLoading ? 'not-allowed' : 'pointer',
                boxShadow: 'none',
                transition: 'transform 0.12s, box-shadow 0.2s',
                opacity: gLoading ? 0.6 : 1,
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <GoogleGlyph size={20} />
              {gLoading ? 'Conectando...' : 'Continuar con Google'}
            </button>

            {gError && (
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,59,107,0.12)',
                border: '1px solid rgba(255,59,107,0.35)',
                color: '#FFB0C2', fontSize: 13, fontWeight: 600, textAlign: 'center',
              }}>
                {gError}
              </div>
            )}

            <button onClick={() => navigate('/signin')} style={{
              background: 'transparent', border: 'none', color: FP.textDim,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 0',
              fontFamily: '"Inter", system-ui',
            }}>
              Ya tienes cuenta? <span style={{ color: FP.flameSolid }}>Inicia sesion</span>
            </button>
          </div>

          <div style={{
            fontSize: 11, color: FP.textMuted, textAlign: 'center',
            maxWidth: 300, margin: '0 auto', lineHeight: 1.5,
            animation: 'fp-entrance 0.8s 0.36s ease-out both',
          }}>
            Al continuar aceptas los{' '}
            <a href="/terminos" style={{ color: FP.flameSolid, textDecoration: 'none' }}>Términos</a>{' '}
            y la{' '}
            <a href="/privacidad" style={{ color: FP.flameSolid, textDecoration: 'none' }}>Política de Privacidad</a>.
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
