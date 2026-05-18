import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { markUpdatesSeen, getCurrentReleaseNotes, APP_VERSION } from '@/lib/appVersion';

// Inline SVG icon set, all stroke-based, no emoji.
const Icon = ({ name, size = 28, color = '#fff', strokeWidth = 2 }) => {
  const s = { width: size, height: size, display: 'block' };
  const common = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'popcorn':
      return (
        <svg viewBox="0 0 24 24" style={s}><g {...common}>
          <path d="M6 9c0-1.7 1.3-3 3-3 .3-1.2 1.4-2 2.7-2 1.3 0 2.4.8 2.7 2H15c1.7 0 3 1.3 3 3v.5"/>
          <path d="M5.5 9.5h13L17 21H7L5.5 9.5z"/>
          <path d="M9 12v6M12 12v6M15 12v6"/>
        </g></svg>
      );
    case 'reorder':
      return (
        <svg viewBox="0 0 24 24" style={s}><g {...common}>
          <path d="M4 7h11M4 12h11M4 17h7"/>
          <path d="M18 5v14M21 8l-3-3-3 3M21 16l-3 3-3-3"/>
        </g></svg>
      );
    case 'arrow':
      return (
        <svg viewBox="0 0 24 24" style={s}><g {...common}>
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </g></svg>
      );
    case 'close':
      return (
        <svg viewBox="0 0 24 24" style={s}><g {...common}>
          <path d="M6 6l12 12M18 6L6 18"/>
        </g></svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" style={s}><g fill={color} stroke="none">
          <path d="M12 2c.6 3-1.5 4.6-2.8 6C7.7 9.7 6 11.4 6 14a6 6 0 0 0 12 0c0-2.2-1-3.6-2.3-4.7-1-.9-1.7-1.7-1.7-3 0-1-.5-2.6-2-4.3z"/>
        </g></svg>
      );
    default:
      return null;
  }
};

const Spark = ({ top, left, size = 6, delay = 0, color = '#FFB547' }) => (
  <span style={{
    position: 'absolute', top, left, width: size, height: size, borderRadius: '50%',
    background: color, boxShadow: `0 0 ${size * 2.5}px ${color}`,
    animation: `fp-upd-spark 2.6s ${delay}s ease-in-out infinite`,
    pointerEvents: 'none',
  }}/>
);

const FeatureRow = ({ icon, tint, title, body, badge, delay }) => (
  <div style={{
    display: 'flex', gap: 16, padding: '14px 4px',
    animation: `fp-upd-fade-up .6s ${delay}s both ease-out`,
  }}>
    <div style={{
      width: 54, height: 54, flexShrink: 0, borderRadius: 16,
      background: `linear-gradient(135deg, ${tint}28, ${tint}10)`,
      border: `1px solid ${tint}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 22px ${tint}30, inset 0 1px 0 rgba(255,255,255,.12)`,
    }}>
      <Icon name={icon} size={26} color={tint}/>
    </div>
    <div style={{ flex: 1, paddingTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif', fontWeight: 800, fontSize: 17,
          color: '#fff', letterSpacing: '-.2px',
        }}>{title}</div>
        {badge && (
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 9, letterSpacing: 1.5,
            padding: '3px 7px', borderRadius: 6,
            background: 'linear-gradient(90deg,#FFB547,#FF3B6B)',
            color: '#0a0210', fontWeight: 800,
          }}>{badge}</span>
        )}
      </div>
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13.5, lineHeight: 1.45, color: 'rgba(255,255,255,.66)',
      }}>{body}</div>
    </div>
  </div>
);

/**
 * UpdatesModal — pantalla "Novedades" full-screen.
 *
 * Props:
 *   onClose(persist)  — el caller decide. CTA primario y X llaman onClose(true)
 *                       (marca como visto). El link "Quizás luego" llama onClose(false).
 *   profileId         — id del usuario actual; persiste el "visto" por cuenta.
 *
 * Si no hay release notes para APP_VERSION actual, no renderiza nada.
 */
const UpdatesModal = ({ onClose, profileId }) => {
  const notes = getCurrentReleaseNotes();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notes) return null;

  const handleClose = (persist) => {
    if (persist) markUpdatesSeen(profileId);
    if (onClose) onClose(persist);
  };

  const headlineWords = (notes.headline || '').split(' ');
  const headStart = headlineWords.slice(0, -2).join(' ');
  const headEnd = headlineWords.slice(-2).join(' ');

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Novedades de la app"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg,#06010F 0%, #0E0420 50%, #150531 100%)',
        display: 'flex', flexDirection: 'column',
        animation: 'fp-upd-sheet-in .5s cubic-bezier(.2,.9,.25,1) both',
        willChange: 'transform, opacity',
        transform: 'translate3d(0,0,0)',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Local keyframes — scoped para no contaminar la app */}
      <style>{`
        @keyframes fp-upd-sheet-in   { from{opacity:0;transform:translate3d(0,32px,0) scale(.97)} to{opacity:1;transform:translate3d(0,0,0) scale(1)} }
        @keyframes fp-upd-glow-pulse { 0%,100%{opacity:.55;transform:translate3d(0,0,0) scale(1)} 50%{opacity:.85;transform:translate3d(0,0,0) scale(1.04)} }
        @keyframes fp-upd-shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fp-upd-spark      { 0%,100%{opacity:.4;transform:translate3d(0,0,0) scale(.8)} 50%{opacity:1;transform:translate3d(0,0,0) scale(1)} }
        @keyframes fp-upd-fade-up    { from{opacity:0;transform:translate3d(0,12px,0)} to{opacity:1;transform:translate3d(0,0,0)} }
        @keyframes fp-upd-ring-rot   { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .fp-upd-glow { will-change: transform, opacity; }
        .fp-upd-cta { will-change: transform; }
        .fp-upd-cta:active { transform: scale(.98); }
        .fp-upd-close:active { transform: scale(.92); }
        @media (prefers-reduced-motion: reduce) {
          [class^="fp-upd-"], [class*=" fp-upd-"] { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      {/* Ambient glows — blurs reducidos para móvil suave */}
      <div className="fp-upd-glow" style={{
        position: 'absolute', top: -120, left: -100, width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,107,74,.55), transparent 65%)',
        filter: 'blur(40px)', opacity: .85,
        animation: 'fp-upd-glow-pulse 7s ease-in-out infinite',
        pointerEvents: 'none',
      }}/>
      <div className="fp-upd-glow" style={{
        position: 'absolute', top: 80, right: -120, width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,59,107,.55), transparent 65%)',
        filter: 'blur(48px)', opacity: .8,
        animation: 'fp-upd-glow-pulse 8s ease-in-out infinite',
        animationDelay: '-2s',
        pointerEvents: 'none',
      }}/>
      <div className="fp-upd-glow" style={{
        position: 'absolute', bottom: -100, left: -60, width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,59,255,.6), transparent 65%)',
        filter: 'blur(50px)', opacity: .95,
        animation: 'fp-upd-glow-pulse 9s ease-in-out infinite',
        animationDelay: '-4s',
        pointerEvents: 'none',
      }}/>

      {/* Decorative sparks */}
      <Spark top={140} left={48}  size={5}  delay={0}    color="#FFB547"/>
      <Spark top={190} left="82%" size={4}  delay={.4}   color="#FF3B6B"/>
      <Spark top={340} left={70}  size={3}  delay={.9}   color="#9B3BFF"/>
      <Spark top={108} left="58%" size={3}  delay={1.3}  color="#FFD166"/>

      {/* Close button (top-right, glass) */}
      <button
        type="button"
        onClick={() => handleClose(true)}
        aria-label="Cerrar"
        className="fp-upd-close"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 18px)', right: 18, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,.12)',
          border: '1px solid rgba(255,255,255,.18)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', padding: 0,
          transition: 'transform .12s ease',
        }}
      >
        <Icon name="close" size={16}/>
      </button>

      {/* Scroll body */}
      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        padding: '70px 22px 0',
      }}>
        {/* Hero */}
        <div style={{ position: 'relative', textAlign: 'center', paddingTop: 14 }}>
          {/* Version chip with rotating ring */}
          <div style={{
            position: 'relative', display: 'inline-flex',
            margin: '6px auto 18px', animation: 'fp-upd-fade-up .6s 0s both ease-out',
          }}>
            <div style={{
              position: 'absolute', inset: -10, borderRadius: 999,
              background: 'conic-gradient(from 0deg, #FFB547, #FF6B4A, #FF3B6B, #9B3BFF, #FFB547)',
              filter: 'blur(10px)', opacity: .85,
              animation: 'fp-upd-ring-rot 6s linear infinite',
            }}/>
            <div style={{
              position: 'relative',
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(8,2,18,.85)',
              border: '1px solid rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 12, letterSpacing: 2.5,
              fontWeight: 700, color: '#fff', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              <Icon name="flame" size={14} color="#FFB547"/>
              <span>VERSION {notes.version || APP_VERSION}</span>
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.2)' }}/>
              <span style={{ color: 'rgba(255,255,255,.55)' }}>{notes.releaseLabel}</span>
            </div>
          </div>

          {/* Headline */}
          <div style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif', fontWeight: 800,
            fontSize: 44, lineHeight: .98, letterSpacing: '-1.6px',
            marginBottom: 10, color: '#fff',
            animation: 'fp-upd-fade-up .65s .08s both ease-out',
          }}>
            {headStart && <span>{headStart} </span>}
            <span style={{
              background: 'linear-gradient(90deg,#FFB547,#FF6B4A,#FF3B6B,#9B3BFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{headEnd}</span>
          </div>

          {/* Subline */}
          <div style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14.5, lineHeight: 1.45, color: 'rgba(255,255,255,.7)',
            maxWidth: 320, margin: '0 auto 26px', padding: '0 6px',
            animation: 'fp-upd-fade-up .65s .15s both ease-out',
          }}>{notes.subline}</div>

          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
            paddingLeft: 4, animation: 'fp-upd-fade-up .65s .2s both ease-out',
          }}>
            <span style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, letterSpacing: 3,
              fontWeight: 700, textTransform: 'uppercase',
              background: 'linear-gradient(90deg,#FFB547,#FF3B6B)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Novedades</span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,107,74,.5),rgba(155,59,255,0))' }}/>
          </div>
        </div>

        {/* Features list */}
        <div style={{
          marginTop: 6,
          display: 'flex', flexDirection: 'column',
          gap: 0,
        }}>
          {(notes.features || []).map((f, i) => (
            <FeatureRow key={f.id} {...f} delay={.25 + i * .07}/>
          ))}
        </div>

        {/* Footnote */}
        {notes.footnote && (
          <div style={{
            marginTop: 18, padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015))',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,.55)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            animation: 'fp-upd-fade-up .65s .55s both ease-out',
          }}>
            <span style={{
              display: 'inline-block', flexShrink: 0,
              width: 6, height: 6, marginTop: 6, borderRadius: '50%',
              background: '#4EFFD6', boxShadow: '0 0 10px #4EFFD6',
            }}/>
            <span>{notes.footnote}</span>
          </div>
        )}

        <div style={{ height: 160 }}/>
      </div>

      {/* Pinned CTA */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
        padding: '18px 22px calc(env(safe-area-inset-bottom, 0px) + 22px)',
        background: 'linear-gradient(180deg, transparent, rgba(6,1,15,.85) 35%, #06010F 75%)',
        animation: 'fp-upd-fade-up .6s .35s both ease-out',
      }}>
        <button
          type="button"
          onClick={() => handleClose(true)}
          className="fp-upd-cta"
          style={{
            width: '100%', padding: '17px 20px',
            border: 'none', borderRadius: 18, cursor: 'pointer',
            background: 'linear-gradient(90deg,#FFB547 0%, #FF6B4A 30%, #FF3B6B 65%, #9B3BFF 100%)',
            color: '#fff',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: 800, fontSize: 17, letterSpacing: '-.3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 16px 40px rgba(255,59,107,.45), inset 0 1px 0 rgba(255,255,255,.3)',
            position: 'relative', overflow: 'hidden',
            transition: 'transform .12s ease',
          }}
        >
          <span style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.32), transparent)',
            backgroundSize: '200% 100%',
            animation: 'fp-upd-shimmer 2.4s linear infinite',
            pointerEvents: 'none',
          }}/>
          <span style={{ position: 'relative' }}>{notes.ctaCopy || 'Continuar'}</span>
          <Icon name="arrow" size={18} color="#fff"/>
        </button>
        <button
          type="button"
          onClick={() => handleClose(false)}
          style={{
            width: '100%', marginTop: 8, padding: '12px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,.5)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13, fontWeight: 500,
          }}
        >
          {notes.secondaryCopy || 'Quizás luego'}
        </button>
      </div>
    </div>
  );

  return createPortal(node, document.body);
};

export default UpdatesModal;
