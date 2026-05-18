import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';

const STORAGE_PREFIX = 'flickpick.onboarding.seen.';

/**
 * Per-user onboarding gate. Renders a full-screen, swipe-able tutorial
 * the very first time a user lands on /home after auth. Decision is
 * persisted in localStorage keyed by the profile id, so an account that
 * already saw it on this device never sees it again.
 *
 * Helpers exported alongside the component:
 *  - hasSeenOnboarding(profileId)  → bool
 *  - markOnboardingSeen(profileId) → void
 *  - resetOnboarding(profileId)    → void  (debug / "ver de nuevo")
 */
export function hasSeenOnboarding(profileId) {
  if (!profileId) return true; // no profile, don't bother showing
  try { return localStorage.getItem(STORAGE_PREFIX + profileId) === '1'; } catch { return true; }
}
export function markOnboardingSeen(profileId) {
  if (!profileId) return;
  try { localStorage.setItem(STORAGE_PREFIX + profileId, '1'); } catch {}
  // Cross-device sync
  try {
    // Lazy require to avoid circular deps if any
    import('@/lib/userSync').then(({ userSync }) => userSync.onboardingSeen(true)).catch(() => {});
  } catch {}
}
export function resetOnboarding(profileId) {
  if (!profileId) return;
  try { localStorage.removeItem(STORAGE_PREFIX + profileId); } catch {}
}

const STEPS = [
  {
    badge: 'Bienvenido',
    title: 'Acaba con la guerra del mando',
    body: 'FlickPick es la forma más rápida de elegir película o serie con tu pareja, amigos o familia. Sin discusiones.',
    accent: 'flame',
    art: 'logo',
  },
  {
    badge: 'Crea una sala',
    title: 'Empezar es fácil',
    body: 'Pulsa "Empezar partida" para crear una sala con tus plataformas y géneros favoritos, o únete con un código.',
    accent: 'orange',
    art: 'create',
  },
  {
    badge: 'Desliza',
    title: 'Tres gestos · Cero menús',
    body: 'Desliza a la derecha si te gusta, a la izquierda si pasas, y hacia arriba si ya la has visto.',
    accent: 'pink',
    art: 'swipe',
  },
  {
    badge: 'Match',
    title: 'Coincide al instante',
    body: 'Cuando todos los miembros le dais like a la misma peli, ¡aparece el match! La velada empieza.',
    accent: 'violet',
    art: 'match',
  },
  {
    badge: 'Dónde verla',
    title: 'Un clic y a verla',
    body: 'Te indicamos en qué plataforma está disponible. Pulsa el logo y te llevamos directo al título.',
    accent: 'cyan',
    art: 'platforms',
  },
  {
    badge: '¡Listo!',
    title: 'Llama a tu gente',
    body: 'Crea la primera sala y empieza a deslizar. Puedes volver a ver este tutorial desde tu perfil.',
    accent: 'flame',
    art: 'go',
  },
];

const OnboardingTutorial = ({ onClose }) => {
  const { profile } = useProfile();
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);
  const total = STEPS.length;
  const current = STEPS[step];

  useEffect(() => { const t = setTimeout(() => setShow(true), 20); return () => clearTimeout(t); }, []);

  const finish = () => {
    if (exiting) return;
    setExiting(true);
    if (profile?.id) markOnboardingSeen(profile.id);
    setShow(false);
    setTimeout(() => onClose?.(), 280);
  };
  const next = () => { if (step >= total - 1) finish(); else setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  // Touch swipe between steps
  const [touchStart, setTouchStart] = useState(null);
  const onTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (dx < -50) next();
    else if (dx > 50) prev();
    setTouchStart(null);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'radial-gradient(ellipse at top, rgba(155,59,255,0.30), transparent 60%), linear-gradient(180deg, #07050E 0%, #0E0719 100%)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.32s ease',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <BgOrbs/>

      {/* Header — skip button */}
      <div style={{
        position: 'relative', zIndex: 5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        // Outer wrapper already provides env(safe-area-inset-top) via the
        // global rule in index.css. Just add the visual gap here.
        padding: '14px 18px 0 18px',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STEPS.map((_, i) => (
            <span key={i} style={{
              width: i === step ? 22 : 8, height: 6, borderRadius: 99,
              background: i <= step
                ? 'linear-gradient(90deg, #FF6B4A, #FF3B6B)'
                : 'rgba(255,255,255,0.16)',
              transition: 'width 0.3s, background 0.3s',
            }}/>
          ))}
        </div>
        <button onClick={finish} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 999, padding: '8px 16px', color: 'rgba(255,255,255,0.70)',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: '"Space Grotesk", system-ui',
        }}>Omitir</button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 4,
        display: 'flex', flexDirection: 'column',
        padding: '24px 28px 24px',
        maxWidth: 560, width: '100%', margin: '0 auto',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 260,
        }}>
          <Art kind={current.art} accent={current.accent}/>
        </div>

        <div key={step} style={{
          animation: 'fp-onb-slide 0.42s cubic-bezier(.2,.8,.3,1) both',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999,
            background: ACCENT_BG[current.accent],
            border: `1px solid ${ACCENT_BORDER[current.accent]}`,
            color: ACCENT_TEXT[current.accent],
            fontSize: 12, fontWeight: 800,
            letterSpacing: 1.2, textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: ACCENT_TEXT[current.accent],
              boxShadow: `0 0 8px ${ACCENT_TEXT[current.accent]}`,
            }}/>
            {current.badge}
          </div>

          <h2 style={{
            fontFamily: '"Inter", "Space Grotesk", system-ui',
            fontWeight: 800, color: '#fff',
            fontSize: 'clamp(28px, 7.5vw, 38px)',
            letterSpacing: -0.8, lineHeight: 1.1, margin: 0,
          }}>{current.title}</h2>

          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.70)',
            lineHeight: 1.55, margin: '14px 0 0', maxWidth: 480,
          }}>{current.body}</p>
        </div>
      </div>

      {/* Footer — controls */}
      <div style={{
        position: 'relative', zIndex: 5,
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 26px)',
        maxWidth: 560, width: '100%', margin: '0 auto',
        display: 'flex', gap: 10,
      }}>
        {step > 0 && (
          <button onClick={prev} style={{
            height: 56, padding: '0 22px', borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Atrás
          </button>
        )}
        <button onClick={next} style={{
          flex: 1, height: 56, borderRadius: 999,
          background: 'linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%)',
          border: 'none', color: '#fff', fontWeight: 800, fontSize: 16,
          cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
          letterSpacing: 0.2,
          boxShadow: '0 12px 32px rgba(255,59,107,0.40)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {step === total - 1 ? 'Empezar' : 'Siguiente'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes fp-onb-slide {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fp-onb-float {
          0%, 100% { transform: translate(0,0); }
          50% { transform: translate(20px,-18px); }
        }
        @keyframes fp-onb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.92); }
        }
        @keyframes fp-onb-swipe-r {
          0%, 100% { transform: translateX(0) rotate(0); }
          40% { transform: translateX(36px) rotate(8deg); }
        }
        @keyframes fp-onb-swipe-l {
          0%, 100% { transform: translateX(0) rotate(0); }
          40% { transform: translateX(-36px) rotate(-8deg); }
        }
        @keyframes fp-onb-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        /* Cascading "tap me" lift used by the platform tiles. The hint
           glow and a slight scale up signal interactivity. */
        @keyframes fp-onb-lift {
          0%, 75%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 8px 22px rgba(0,0,0,0.40);
          }
          12% {
            transform: translateY(-14px) scale(1.06);
            box-shadow: 0 18px 32px rgba(255,107,74,0.40), 0 0 24px rgba(255,107,74,0.30);
          }
          24% {
            transform: translateY(0) scale(1);
            box-shadow: 0 8px 22px rgba(0,0,0,0.40);
          }
        }
        /* Subtle continuous tilt to invite touch on the swipe card. */
        @keyframes fp-onb-card-tilt {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(-2deg) translateY(-3px); }
          75% { transform: rotate(2deg) translateY(-3px); }
        }
        /* Match step animations — coordinated burst on every cycle. */
        @keyframes fp-onb-halo {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes fp-onb-confetti {
          0%   { transform: translate(0, 20px) scale(0.4); opacity: 0; }
          25%  { transform: translate(0, 0) scale(1); opacity: 1; }
          75%  { transform: translate(var(--cx, 0), -28px) scale(0.9); opacity: 1; }
          100% { transform: translate(var(--cx, 0), -50px) scale(0); opacity: 0; }
        }
        @keyframes fp-onb-match-pop {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.10); }
          30% { transform: scale(0.96); }
          45% { transform: scale(1.04); }
          60% { transform: scale(1); }
        }
        @keyframes fp-onb-bump-l {
          0%, 100% { transform: translateX(0) rotate(0); }
          40% { transform: translateX(-6px) rotate(-3deg); }
          60% { transform: translateX(2px) rotate(1deg); }
        }
        @keyframes fp-onb-bump-r {
          0%, 100% { transform: translateX(0) rotate(0); }
          40% { transform: translateX(6px) rotate(3deg); }
          60% { transform: translateX(-2px) rotate(-1deg); }
        }
        @keyframes fp-onb-heart {
          0%, 30% { transform: translateX(-50%) scale(0); opacity: 0; }
          50% { transform: translateX(-50%) scale(1.3); opacity: 1; }
          70% { transform: translateX(-50%) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};

// ── Visual styles per accent ─────────────────────────────────────────
const ACCENT_BG = {
  flame:  'rgba(255,107,74,0.16)',
  orange: 'rgba(255,107,74,0.16)',
  pink:   'rgba(255,59,107,0.16)',
  violet: 'rgba(139,92,246,0.18)',
  cyan:   'rgba(78,255,214,0.16)',
};
const ACCENT_BORDER = {
  flame:  'rgba(255,107,74,0.45)',
  orange: 'rgba(255,107,74,0.45)',
  pink:   'rgba(255,59,107,0.45)',
  violet: 'rgba(139,92,246,0.45)',
  cyan:   'rgba(78,255,214,0.45)',
};
const ACCENT_TEXT = {
  flame:  '#FFB199',
  orange: '#FFB199',
  pink:   '#FF87A8',
  violet: '#C4B5FD',
  cyan:   '#5BFFD6',
};

// ── Visual artwork per step ──────────────────────────────────────────
const Art = ({ kind, accent }) => {
  if (kind === 'logo') {
    return (
      <div style={{
        position: 'relative', width: 220, height: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.45), transparent 70%)',
          filter: 'blur(20px)',
          animation: 'fp-onb-pulse 3s ease-in-out infinite',
        }}/>
        <img src="/Favicon.webp" alt="" style={{ width: 160, height: 160, position: 'relative' }}/>
      </div>
    );
  }
  if (kind === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 280 }}>
        <FakeButton primary>🎬 Empezar partida</FakeButton>
        <FakeButton>🔗 Unirse con código</FakeButton>
      </div>
    );
  }
  if (kind === 'swipe') {
    return (
      <div style={{
        position: 'relative', width: 320, height: 340,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Glow halo behind the card */}
        <div style={{
          position: 'absolute', width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.30), transparent 65%)',
          filter: 'blur(30px)',
          animation: 'fp-onb-pulse 3s ease-in-out infinite',
        }}/>

        {/* Card stack — back card peeks behind to suggest "more cards".
            Both cards are absolute-centered so chip alignment is exact. */}
        <div style={{
          position: 'absolute', width: 160, height: 230,
          left: '50%', top: '50%', marginLeft: -80, marginTop: -115,
          borderRadius: 22,
          background: 'linear-gradient(160deg, #1A0F2E, #FF3B6B)',
          opacity: 0.45, transform: 'translate(8px, 12px) rotate(4deg)',
          boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
        }}/>

        {/* Front card — poster mockup with title + meta + rating */}
        <div style={{
          position: 'absolute', width: 168, height: 240,
          left: '50%', top: '50%', marginLeft: -84, marginTop: -120,
          borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(160deg, #1A0F2E 0%, #5B1DB5 35%, #FF3B6B 80%, #FF6B4A 100%)',
          }}/>
          {/* "title artwork" — big circular volcanic glow */}
          <div style={{
            position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 110, borderRadius: '50%',
            background: 'radial-gradient(circle, #FFB547 0%, #FF6B4A 40%, transparent 70%)',
            filter: 'blur(8px)',
          }}/>
          {/* Top-right rating chip */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            color: '#FFD166', fontSize: 10, fontWeight: 800,
          }}>★ 8.4</div>
          {/* Match badge top-left */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(78,255,214,0.20)', border: '1px solid rgba(78,255,214,0.45)',
            color: '#4EFFD6', fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
          }}>92% MATCH</div>
          {/* Scrim */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.20) 55%, transparent 85%)',
          }}/>
          {/* Title block */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, color: '#fff' }}>
            <div style={{
              fontFamily: '"Space Grotesk", system-ui',
              fontWeight: 800, fontSize: 18, letterSpacing: -0.5, lineHeight: 1.05,
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}>Volcán Azul</div>
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center', marginTop: 4,
              fontSize: 10, color: 'rgba(255,255,255,0.78)',
            }}>
              <span style={{
                padding: '2px 7px', borderRadius: 999,
                background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
                fontWeight: 700,
              }}>Thriller</span>
              <span>2024 · 2h 11m</span>
            </div>
          </div>
        </div>

        {/* Gesture chips OUTSIDE the card — never overlap */}
        <ArrowChip dir="up"    label="Visto" color="#9B6BFF" style={{ top: 0,     left: '50%', transform: 'translateX(-50%)' }}/>
        <ArrowChip dir="left"  label="Paso"  color="#FF3B6B" style={{ top: '50%', left: 0,    transform: 'translateY(-50%)' }}/>
        <ArrowChip dir="right" label="Like"  color="#4EFFD6" style={{ top: '50%', right: 0,   transform: 'translateY(-50%)' }}/>
      </div>
    );
  }
  if (kind === 'match') {
    // Confetti pieces — fixed positions for a stable but lively burst.
    const confetti = [
      { x: 18,  y: 12, c: '#FFB547', s: 8,  d: 0.0, dur: 2.4 },
      { x: 80,  y: 22, c: '#FF3B6B', s: 6,  d: 0.3, dur: 2.6 },
      { x: 140, y: 8,  c: '#9B3BFF', s: 10, d: 0.6, dur: 2.2 },
      { x: 210, y: 26, c: '#4EFFD6', s: 7,  d: 0.2, dur: 2.8 },
      { x: 270, y: 14, c: '#FF6B4A', s: 9,  d: 0.5, dur: 2.5 },
      { x: 38,  y: 220, c: '#FFB547', s: 6, d: 0.7, dur: 2.7 },
      { x: 290, y: 200, c: '#9B3BFF', s: 8, d: 0.4, dur: 2.3 },
      { x: 0,   y: 130, c: '#FF3B6B', s: 7, d: 0.8, dur: 2.6 },
      { x: 305, y: 130, c: '#FFB547', s: 7, d: 0.1, dur: 2.5 },
      { x: 100, y: 250, c: '#4EFFD6', s: 6, d: 0.9, dur: 2.4 },
      { x: 220, y: 250, c: '#FF6B4A', s: 8, d: 0.5, dur: 2.6 },
    ];
    return (
      <div style={{
        position: 'relative', width: 320, height: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Pulsing radial halo */}
        <div style={{
          position: 'absolute', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.55) 0%, rgba(155,59,255,0.30) 40%, transparent 70%)',
          filter: 'blur(28px)',
          animation: 'fp-onb-halo 2.8s ease-in-out infinite',
        }}/>

        {/* Confetti shower */}
        {confetti.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: p.x, top: p.y,
            width: p.s, height: p.s, borderRadius: '50%',
            background: p.c, boxShadow: `0 0 12px ${p.c}`,
            opacity: 0,
            animation: `fp-onb-confetti ${p.dur}s ${p.d}s ease-in-out infinite`,
          }}/>
        ))}

        {/* Center stack: MATCH text + avatars + heart */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            fontFamily: '"Space Grotesk", system-ui', fontWeight: 900,
            fontSize: 72, letterSpacing: -3.5, lineHeight: 0.9,
            background: 'linear-gradient(135deg, #FFB547 0%, #FF6B4A 30%, #FF3B6B 65%, #9B3BFF 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 22px rgba(255,107,74,0.70)) drop-shadow(0 0 40px rgba(155,59,255,0.45))',
            animation: 'fp-onb-match-pop 1.4s cubic-bezier(.2,.8,.3,1.4) infinite',
            textShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}>¡MATCH!</div>

          {/* Avatars + heart between them */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Avatar letter="A" color="#FF6B4A" style={{
              animation: 'fp-onb-bump-l 1.4s cubic-bezier(.2,.8,.3,1.2) infinite',
            }}/>
            <Avatar letter="M" color="#9B3BFF" style={{
              marginLeft: -14,
              animation: 'fp-onb-bump-r 1.4s cubic-bezier(.2,.8,.3,1.2) infinite',
            }}/>
            {/* Heart sticker that pops between them */}
            <div style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF3B6B, #FF6B4A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(255,59,107,0.6), 0 0 0 3px #0E0719',
              animation: 'fp-onb-heart 1.4s cubic-bezier(.2,.8,.3,1.4) infinite',
              zIndex: 5,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'platforms') {
    // Real provider logos via TMDB CDN — same paths the rest of the app
    // uses, so the user sees the actual artwork.
    const providers = [
      { name: 'Netflix',            logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
      { name: 'Amazon Prime Video', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
      { name: 'Max',                logo: '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg' },
      { name: 'Disney+',            logo: '/97yvRBw1GzX7fXprcF80er19ot.jpg' },
      { name: 'Apple TV+',          logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
    ];
    const total = providers.length;
    // Cycle: each platform lifts in turn, suggesting "tap me".
    const CYCLE = 4.5; // seconds — full loop
    return (
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'nowrap',
        justifyContent: 'center', maxWidth: 360,
      }}>
        {providers.map((p, i) => (
          <div key={p.name} title={p.name} style={{
            width: 58, height: 58, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#0E0719',
            boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
            animation: `fp-onb-lift ${CYCLE}s ${(i / total) * CYCLE}s ease-in-out infinite`,
            flexShrink: 0,
          }}>
            <img
              src={`https://image.tmdb.org/t/p/w154${p.logo}`}
              alt={p.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.style.background = 'linear-gradient(135deg, #FF6B4A, #9B3BFF)'; }}
            />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'go') {
    return (
      <div style={{
        position: 'relative', width: 200, height: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,183,71,0.55) 0%, rgba(255,107,74,0.4) 30%, rgba(155,59,255,0.25) 70%, transparent 100%)',
          filter: 'blur(20px)',
          animation: 'fp-onb-pulse 3s ease-in-out infinite',
        }}/>
        <div style={{ fontSize: 90, position: 'relative' }}>🍿</div>
      </div>
    );
  }
  return null;
};

const FakeButton = ({ children, primary }) => (
  <div style={{
    height: 56, borderRadius: 999,
    background: primary
      ? 'linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 50%, #9B3BFF 100%)'
      : 'rgba(255,255,255,0.06)',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.12)',
    color: '#fff', fontWeight: 800, fontSize: 16,
    fontFamily: '"Space Grotesk"',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: primary ? '0 12px 32px rgba(255,59,107,0.30)' : 'none',
  }}>{children}</div>
);

const ArrowChip = ({ dir, label, color, style }) => {
  const anim = dir === 'right' ? 'fp-onb-swipe-r 1.6s ease-in-out infinite'
              : dir === 'left'  ? 'fp-onb-swipe-l 1.6s ease-in-out infinite'
              : 'fp-onb-pulse 1.6s ease-in-out infinite';
  return (
    <div style={{
      position: 'absolute',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: 'rgba(255,255,255,0.06)',
      border: `1px solid ${color}`,
      color, fontSize: 12, fontWeight: 800,
      fontFamily: '"Space Grotesk"',
      boxShadow: `0 0 20px ${color}55`,
      animation: anim,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {dir === 'right' && <span>→</span>}
      {dir === 'left'  && <span>←</span>}
      {dir === 'up'    && <span>↑</span>}
      {label}
    </div>
  );
};

const Avatar = ({ letter, color, style }) => (
  <div style={{
    width: 64, height: 64, borderRadius: 999,
    background: color, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '"Space Grotesk"', fontWeight: 800, fontSize: 26,
    border: '3px solid #0E0719',
    boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
    ...style,
  }}>{letter}</div>
);

const BgOrbs = () => (
  <>
    <div style={{
      position: 'absolute', top: '-12%', left: '-10%',
      width: '60vmin', height: '60vmin', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,107,74,0.45), transparent 65%)',
      filter: 'blur(60px)',
      animation: 'fp-onb-float 14s ease-in-out infinite',
      pointerEvents: 'none',
    }}/>
    <div style={{
      position: 'absolute', bottom: '-12%', right: '-10%',
      width: '60vmin', height: '60vmin', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(155,59,255,0.40), transparent 65%)',
      filter: 'blur(60px)',
      animation: 'fp-onb-float 18s ease-in-out infinite reverse',
      pointerEvents: 'none',
    }}/>
  </>
);

export default OnboardingTutorial;
