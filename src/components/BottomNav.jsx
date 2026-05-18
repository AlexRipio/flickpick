import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isStandalone } from '@/lib/installApp';
import { useProfile } from '@/contexts/ProfileContext';

// Pure helper: looks up the user's most recent non-ended room from
// localStorage that has had activity in the last 6h. Returns null if
// none. Used to gate the "Crear" FAB in PWA mode with a confirmation
// dialog.
//
// Mirrors the HomeScreen "active room" rule exactly — without the 6h
// window, abandoned lobbies the user forgot to close would forever
// block FAB creation while being invisible in Home (which IS gated by
// the same window). The two views must agree.
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
function lastTouchedAt(r) {
  const t = r.updatedAt || r.lastMatchAt || r.createdAt || 0;
  if (typeof t === 'string') return Date.parse(t) || 0;
  return t || 0;
}
function findActiveRoomForUser(profileId) {
  if (!profileId) return null;
  try {
    const all = JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}');
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    let active = null;
    for (const r of Object.values(all)) {
      if (!r || r.status === 'ended') continue;
      if (lastTouchedAt(r) < cutoff) continue;
      const isMember = r.members?.some((m) => m.id === profileId);
      const isOwner  = r.ownerId === profileId;
      if (!isMember && !isOwner) continue;
      if (!active || lastTouchedAt(r) > lastTouchedAt(active)) active = r;
    }
    return active;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   FlickPick · Bottom Navigation Bar (PWA)
   1) Ranking · 2) Swipes · 3) Crear (FAB) · 4) Biblioteca · 5) Perfil
   ───────────────────────────────────────────────────────────── */

const ROUTE_BY_ID = {
  ranking: '/trending',
  swipes: '/home',
  crear: '/create',
  biblioteca: '/watchlist',
  perfil: '/profile',
};

const ID_BY_PATH = [
  { test: (p) => p.startsWith('/trending'), id: 'ranking' },
  { test: (p) => p === '/home', id: 'swipes' },
  { test: (p) => p.startsWith('/create'), id: 'crear' },
  { test: (p) => p.startsWith('/watchlist') || p.startsWith('/matches'), id: 'biblioteca' },
  { test: (p) => p.startsWith('/profile'), id: 'perfil' },
];

function deriveActiveFromPath(pathname) {
  const match = ID_BY_PATH.find((r) => r.test(pathname));
  return match ? match.id : null;
}

/* ─── Iconos: outline (idle) ↔ solid (active) ───────────────── */

const IconPodio = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="3" y="11" width="6" height="9.5" rx="1.4" />
      <rect x="9" y="6.5" width="6" height="14" rx="1.4" />
      <rect x="15" y="13" width="6" height="7.5" rx="1.4" />
      <path d="M12 2.4l.95 2.05 2.25.25-1.7 1.5.45 2.2L12 7.3 9.95 8.4l.5-2.2-1.7-1.5 2.25-.25z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="6" height="9.5" rx="1.4" />
      <rect x="9" y="6.5" width="6" height="14" rx="1.4" />
      <rect x="15" y="13" width="6" height="7.5" rx="1.4" />
      <path d="M12 2.4l.95 2.05 2.25.25-1.7 1.5.45 2.2L12 7.3 9.95 8.4l.5-2.2-1.7-1.5 2.25-.25z" />
    </svg>
  );

const IconSwipe = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="6.5" y="4" width="11" height="15" rx="2.4" transform="rotate(-9 12 11.5)" opacity="0.55" />
      <rect x="6.5" y="4" width="11" height="15" rx="2.4" transform="rotate(8 12 11.5)" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="6.5" y="4" width="11" height="15" rx="2.4" transform="rotate(-9 12 11.5)" />
      <rect x="6.5" y="4" width="11" height="15" rx="2.4" transform="rotate(8 12 11.5)" />
    </svg>
  );

const IconBiblioteca = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M7 3.5h10a2 2 0 0 1 2 2v15.2a.6.6 0 0 1-.93.5L12 17.7l-5.07 3.5A.6.6 0 0 1 6 20.7V5.5a2 2 0 0 1 2-2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 3.5h10a2 2 0 0 1 2 2v15.2a.6.6 0 0 1-.93.5L12 17.7l-5.07 3.5A.6.6 0 0 1 6 20.7V5.5a2 2 0 0 1 2-2" />
      <path d="M9 8.5h6" />
    </svg>
  );

const IconPerfil = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.6 20.4c.9-3.5 3.7-5.6 7.4-5.6s6.5 2.1 7.4 5.6a.6.6 0 0 1-.6.7H5.2a.6.6 0 0 1-.6-.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c1-3.4 3.7-5.2 7-5.2s6 1.8 7 5.2" />
    </svg>
  );

/* ─── NavItem (los 4 botones laterales) ────────────────────────── */
function NavItem({ label, Icon, active, onClick }) {
  const [hover, setHover] = useState(false);
  const litColor = '#FF6B4A';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="group relative flex-1 flex flex-col items-center justify-center
                 h-full pt-1.5 pb-1 select-none
                 outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-2xl
                 transition-transform active:scale-[0.92]"
      style={{ minHeight: 56 }}
    >
      <span
        className="relative w-7 h-7 grid place-items-center transition-all duration-300"
        style={{
          color: active ? litColor : hover ? '#ffffff' : 'rgba(245,242,255,0.95)',
          transform: active
            ? 'translateY(-1px) scale(1.05)'
            : hover
            ? 'translateY(-1px)'
            : 'none',
          filter: active ? 'drop-shadow(0 0 6px rgba(255,107,74,0.65))' : 'none',
        }}
      >
        {active && (
          <span
            aria-hidden
            className="absolute rounded-full pointer-events-none fp-glow-in"
            style={{
              inset: -10,
              top: '50%',
              left: '50%',
              width: 48,
              height: 48,
              transform: 'translate(-50%,-50%)',
              background:
                'radial-gradient(circle, rgba(255,107,74,0.55) 0%, rgba(255,59,107,0.20) 45%, transparent 75%)',
              filter: 'blur(2px)',
              zIndex: -1,
            }}
          />
        )}
        <Icon width="24" height="24" solid={active} />
      </span>

      <span
        className="mt-1 leading-none transition-all duration-300"
        style={{
          fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
          fontSize: 10,
          color: active ? '#fff' : hover ? '#ffffff' : 'rgba(245,242,255,0.85)',
          fontWeight: active ? 700 : 500,
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>

      {active && (
        <span
          aria-hidden
          className="absolute bottom-1 left-1/2 w-1 h-1 rounded-full fp-dot-in"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#FFB547,#FF3B6B)',
            boxShadow: '0 0 8px rgba(255,59,107,0.9)',
          }}
        />
      )}
    </button>
  );
}

/* ─── BottomNav ─────────────────────────────────────────────────
   Props:
   - active?: 'ranking'|'swipes'|'crear'|'biblioteca'|'perfil'
       Si no se pasa, se deriva del pathname actual.
   - onChange?: (id) => void
       Si no se pasa, navega usando ROUTE_BY_ID.
   ───────────────────────────────────────────────────────────── */
function BottomNav({ active: activeProp, onChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const [fabHover, setFabHover] = useState(false);
  const [pressKey, setPressKey] = useState(0); // re-trigger keyframe on each press
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  // Detect installed-PWA mode (display-mode: standalone, or iOS navigator.standalone).
  // When standalone, the bar extends edge-to-edge to fill the home-indicator
  // zone with the same glass treatment, eliminating the dark band.
  // In a regular browser tab the bar keeps its floating-pill style.
  const standalone = useMemo(() => isStandalone(), []);

  // Hide/show de la barra. En PWA standalone NUNCA se oculta — la barra
  // forma parte de la UI inferior incrustada, ocultarla dejaría la zona
  // del home-indicator vacía con la franja oscura del backdrop.
  const [hidden, setHidden] = useState(() => {
    if (standalone) return false;
    try { return localStorage.getItem('fp.nav.hidden') === '1'; } catch { return false; }
  });
  const toggleHidden = () => {
    if (standalone) return; // no-op en PWA
    setHidden((h) => {
      const next = !h;
      try { localStorage.setItem('fp.nav.hidden', next ? '1' : '0'); } catch {}
      try { import('@/lib/userSync').then(({ userSync }) => userSync.navHidden(next)).catch(() => {}); } catch {}
      return next;
    });
  };

  const active = useMemo(() => {
    if (activeProp) return activeProp;
    return deriveActiveFromPath(location.pathname);
  }, [activeProp, location.pathname]);

  const handleChange = (id) => {
    // PWA-only: tapping the Crear FAB while in an active room would
    // silently navigate away. Intercept and confirm first.
    if (id === 'crear' && standalone) {
      const active = findActiveRoomForUser(profile?.id);
      if (active) {
        setConfirmCreateOpen(true);
        return;
      }
    }
    if (onChange) {
      onChange(id);
      return;
    }
    const route = ROUTE_BY_ID[id];
    if (route) navigate(route);
  };

  const proceedCreate = () => {
    setConfirmCreateOpen(false);
    if (onChange) onChange('crear');
    else navigate(ROUTE_BY_ID.crear);
  };

  const isCreate = active === 'crear';

  const sideItems = [
    { id: 'ranking', label: 'Ranking', Icon: IconPodio },
    { id: 'swipes', label: 'Swipes', Icon: IconSwipe },
    { id: 'biblioteca', label: 'Biblioteca', Icon: IconBiblioteca },
    { id: 'perfil', label: 'Perfil', Icon: IconPerfil },
  ];

  // Cuando la barra está oculta, mostramos un chevron flotante para traerla de vuelta
  if (hidden) {
    return (
      <button
        onClick={toggleHidden}
        aria-label="Mostrar menú"
        className="fixed left-1/2 z-30 flex items-center justify-center rounded-full"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          transform: 'translateX(-50%)',
          width: 44, height: 28,
          background: 'rgba(20,12,40,0.65)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 15l6-6 6 6" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    );
  }

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={`fixed left-0 right-0 bottom-0 z-30 pt-2 ${standalone ? 'px-0' : 'px-3'}`}
      style={{
        paddingBottom: standalone ? 0 : 'max(env(safe-area-inset-bottom), 10px)',
        pointerEvents: 'none',
      }}
    >
      {/* Botón ocultar — solo en navegador (en PWA la barra está incrustada) */}
      {!standalone && (
      <button
        onClick={toggleHidden}
        aria-label="Ocultar menú"
        className="absolute z-20 flex items-center justify-center rounded-full"
        style={{
          right: 14,
          top: -14,
          width: 28, height: 28,
          background: 'rgba(20,12,40,0.75)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      )}

      <div
        className="relative mx-auto"
        style={{
          width: '100%',
          maxWidth: standalone ? '100%' : 440,
          // In PWA: card grows to also fill the home-indicator safe-area.
          // We use max(env, 34px) as a fallback in case some iOS versions
          // report 0 for env(safe-area-inset-bottom) inside standalone mode.
          // Icons remain locked to the top 80px regardless.
          // PWA: card grows by the home-indicator safe-area MINUS 6px so
          // the icons sit a little closer to the bottom edge ("pegada"
          // feel). On phones without a home indicator (env=0) we just
          // use 80px — fully responsive across devices.
          height: standalone
            ? 'calc(80px + max(0px, env(safe-area-inset-bottom, 0px) - 6px))'
            : 80,
          pointerEvents: 'auto',
        }}
      >
        {/* Liquid Glass · auténtico iOS:
            tint blanco muy bajo + blur fuerte + saturate alto.
            La sensación "glass" viene del blur+saturate, no de la opacidad. */}
        <div
          aria-hidden
          className="fp-nav-cutout absolute inset-0"
          style={{
            // En navegador: 0.001 alpha basta (efecto flotante).
            // En PWA: bg sólido oscuro translúcido + blur — barra incrustada
            //         estilo dock iOS, lee como UI del sistema.
            background: standalone
              ? 'rgba(14,8,28,0.78)'
              : 'rgba(255,255,255,0.001)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderTop: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            // PWA: top corners rounded, bottom flush with screen edge.
            // Browser: full pill rounded.
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderBottomLeftRadius: standalone ? 0 : 28,
            borderBottomRightRadius: standalone ? 0 : 28,
            ...(standalone && { borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }),
          }}
        />

        {/* Highlight superior muy sutil — solo un brillo en el borde */}
        <div
          aria-hidden
          className="fp-nav-cutout absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 20%)',
            zIndex: 2,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderBottomLeftRadius: standalone ? 0 : 28,
            borderBottomRightRadius: standalone ? 0 : 28,
          }}
        />

        {/* CAPA 2 — 5-cell grid con los iconos.
            En PWA se ancla al top 80px para no descender al ampliar el card. */}
        <div
          className="absolute grid items-stretch"
          style={{
            gridTemplateColumns: '1fr 1fr 92px 1fr 1fr',
            top: 0, left: 0, right: 0,
            height: 80,
            ...(standalone ? {} : { bottom: 0 }),
          }}
        >
          <NavItem
            {...sideItems[0]}
            active={active === sideItems[0].id}
            onClick={() => handleChange(sideItems[0].id)}
          />
          <NavItem
            {...sideItems[1]}
            active={active === sideItems[1].id}
            onClick={() => handleChange(sideItems[1].id)}
          />
          <div aria-hidden />
          <NavItem
            {...sideItems[2]}
            active={active === sideItems[2].id}
            onClick={() => handleChange(sideItems[2].id)}
          />
          <NavItem
            {...sideItems[3]}
            active={active === sideItems[3].id}
            onClick={() => handleChange(sideItems[3].id)}
          />
        </div>

        {/* Etiqueta "Crear" debajo del FAB.
            En PWA, ancla con offset del safe-area-bottom para no caer
            sobre el home indicator. */}
        <div
          className="pointer-events-none absolute left-1/2 leading-none transition-all duration-300"
          style={{
            transform: 'translateX(-50%)',
            bottom: standalone ? 'calc(max(0px, env(safe-area-inset-bottom, 0px) - 6px) + 8px)' : 8,
            fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
            fontSize: 10,
            color: isCreate ? '#fff' : 'rgba(245,242,255,0.7)',
            fontWeight: isCreate ? 700 : 600,
            letterSpacing: '0.06em',
            textShadow: isCreate ? '0 0 10px rgba(255,107,74,0.6)' : 'none',
          }}
        >
          Crear
        </div>

        {/* FAB central (Llama) */}
        <button
          key={pressKey}
          onClick={() => {
            setPressKey((k) => k + 1);
            handleChange('crear');
          }}
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
          aria-label="Crear sala"
          aria-current={isCreate ? 'page' : undefined}
          className={`group absolute left-1/2 rounded-full flex items-center justify-center
                     focus-visible:ring-4 focus-visible:ring-white/30 outline-none
                     ${pressKey > 0 ? 'fp-fab-press' : ''}`}
          style={{
            transform: 'translateX(-50%)',
            top: -28,
            zIndex: 10,
            transition: 'box-shadow 300ms ease-out',
            width: 70,
            height: 70,
            background:
              'linear-gradient(135deg, #FFB547 0%, #FF6B4A 32%, #FF3B6B 68%, #9B3BFF 100%)',
            boxShadow:
              isCreate || fabHover
                ? '0 16px 40px -6px rgba(255,59,107,0.75),' +
                  '0 6px 18px -2px rgba(155,59,255,0.55),' +
                  'inset 0 1.5px 0 rgba(255,255,255,0.40),' +
                  'inset 0 -2px 6px rgba(120,20,60,0.40)'
                : '0 12px 32px -6px rgba(255,59,107,0.55),' +
                  '0 4px 14px -2px rgba(155,59,255,0.45),' +
                  'inset 0 1.5px 0 rgba(255,255,255,0.32),' +
                  'inset 0 -2px 6px rgba(120,20,60,0.35)',
          }}
        >
          {/* Halo conic-gradient pulsante */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none fp-fab-pulse"
            style={{
              background:
                'conic-gradient(from 200deg,' +
                'rgba(255,181,71,0.40), rgba(155,59,255,0.40),' +
                'rgba(255,59,107,0.40), rgba(255,181,71,0.40))',
              filter: 'blur(12px)',
              zIndex: -1,
            }}
          />
          {/* Burst de press: ring expansivo de un solo disparo */}
          {pressKey > 0 && (
            <span
              key={`burst-${pressKey}`}
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none fp-fab-burst"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,181,71,0.55) 0%, rgba(255,59,107,0.30) 50%, transparent 75%)',
                filter: 'blur(8px)',
                zIndex: -1,
              }}
            />
          )}
          {/* Disco interior oscuro — fondo circular para aislar el imagotipo */}
          <span
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: 6,
              background:
                'radial-gradient(circle at 50% 35%, #1a0a2e 0%, #0a0418 100%)',
              boxShadow:
                'inset 0 2px 6px rgba(0,0,0,0.6), inset 0 -1px 2px rgba(255,107,74,0.25)',
            }}
          />
          {/* Imagotipo */}
          <span className="relative z-10 grid place-items-center">
            <img
              src="/imagotipo.webp"
              width={42}
              height={42}
              alt="FlickPick"
              style={{
                display: 'block',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
              }}
            />
          </span>
        </button>
      </div>

      {/* Confirm dialog when tapping "Crear" with an active room (PWA only). */}
      {confirmCreateOpen && (
        <div
          onClick={() => setConfirmCreateOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400,
              background: 'linear-gradient(180deg, #1a0f2e 0%, #0B0420 100%)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              padding: '24px 22px 20px',
              fontFamily: '"Space Grotesk", system-ui',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(255,59,107,0.35)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                    stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>¿Salir de la sala?</div>
            </div>
            <div style={{
              fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5,
              marginBottom: 18,
            }}>
              Estás en una sala activa. Si creas una nueva, dejarás la actual y perderás los swipes que aún no hayan hecho match.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmCreateOpen(false)}
                style={{
                  flex: 1, height: 50, borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  border: '1px solid rgba(255,255,255,0.10)',
                  cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={proceedCreate}
                style={{
                  flex: 1, height: 50, borderRadius: 999,
                  background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
                  color: '#fff', fontWeight: 800, fontSize: 14,
                  border: 'none', cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                  boxShadow: '0 10px 24px rgba(255,59,107,0.35)',
                }}
              >
                Crear nueva
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default BottomNav;
export { ROUTE_BY_ID, deriveActiveFromPath };
