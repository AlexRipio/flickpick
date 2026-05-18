import React, { useEffect, useRef, useState } from 'react';
import { subscribeNetwork } from '@/lib/network';

// User-driven dismiss: when the user closes the banner with the X, we
// silence it for this long. If the connection is still bad after the
// snooze expires, the banner pops back up. If the connection recovers
// during the snooze we reset, so a future degradation shows the banner
// again immediately rather than waiting out the leftover snooze.
const DISMISS_MS = 2 * 60 * 1000;

/**
 * Indicador global de calidad de red. Solo se muestra cuando hace falta
 * (slow / offline). Sticky arriba, con fade y respeto al notch.
 */
const NetworkIndicator = () => {
  const [status, setStatus] = useState({ quality: 'unknown', online: true });
  const [visible, setVisible] = useState(false);
  const [hide, setHide] = useState(true);
  // Snooze state — `quality` records WHICH banner the user dismissed so
  // a transition slow→offline can still surface (different message).
  const [snooze, setSnooze] = useState({ quality: null, until: 0 });
  // Tick state forces a re-render when the snooze expires so the banner
  // can pop back up without waiting for the next network event.
  const [, setTick] = useState(0);
  const snoozeTimerRef = useRef(null);

  useEffect(() => subscribeNetwork(setStatus), []);

  // Reset any active snooze when the connection recovers — that way the
  // banner reappears immediately if quality drops again later.
  useEffect(() => {
    if (status.quality === 'good' || status.quality === 'unknown') {
      if (snooze.quality) setSnooze({ quality: null, until: 0 });
    }
  }, [status.quality, snooze.quality]);

  const now = Date.now();
  const isSnoozed =
    snooze.quality === status.quality && now < snooze.until;

  // Schedule a tick at the end of the snooze so the banner re-evaluates
  // visibility on its own (no extra network event required).
  useEffect(() => {
    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
    if (!isSnoozed) return;
    const remaining = snooze.until - Date.now();
    snoozeTimerRef.current = setTimeout(() => {
      setTick((t) => t + 1);
    }, remaining + 20);
    return () => {
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, [isSnoozed, snooze.until]);

  // Drive the slide-down/up animation. We keep the node mounted briefly
  // after `quality` returns to good (or the user dismisses) so the exit
  // transition can run.
  useEffect(() => {
    const isBad = status.quality === 'slow' || status.quality === 'offline';
    const shouldShow = isBad && !isSnoozed;
    if (shouldShow) {
      setHide(false);
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setHide(true), 280);
    return () => clearTimeout(t);
  }, [status.quality, isSnoozed]);

  const dismiss = () => {
    setSnooze({ quality: status.quality, until: Date.now() + DISMISS_MS });
  };

  if (hide) return null;

  const isOffline = status.quality === 'offline';
  const colors = isOffline
    ? { bg: 'linear-gradient(135deg, #FF3B6B 0%, #B91C3C 100%)', border: 'rgba(255,90,120,0.45)', text: '#fff', icon: '#fff' }
    : { bg: 'linear-gradient(135deg, #FFB547 0%, #FF6B4A 100%)', border: 'rgba(255,181,71,0.55)', text: '#fff', icon: '#fff' };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 2147483646, pointerEvents: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(.2,.8,.3,1), opacity 0.22s',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
      }}
    >
      <div style={{
        margin: '8px auto 0',
        maxWidth: 520, width: 'calc(100% - 16px)',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 999,
        padding: '8px 14px',
        boxShadow: '0 8px 22px rgba(0,0,0,0.40)',
        display: 'flex', alignItems: 'center', gap: 10,
        pointerEvents: 'auto',
      }}>
        {/* Icon with subtle pulse to signal "live status" */}
        <div style={{
          width: 22, height: 22, borderRadius: 999, flexShrink: 0,
          background: 'rgba(255,255,255,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fp-net-pulse 1.6s ease-in-out infinite',
        }}>
          {isOffline ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 13a10 10 0 0114 0M8.5 16.5a5 5 0 017 0M12 20h.01M3 3l18 18"
                    stroke={colors.icon} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 13a10 10 0 0114 0M8.5 16.5a5 5 0 017 0M12 20h.01"
                    stroke={colors.icon} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.15 }}>
            {isOffline ? 'Sin conexión' : 'Conexión lenta'}
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1, lineHeight: 1.2 }}>
            {isOffline
              ? 'Trabajamos con tus datos guardados.'
              : 'La carga puede tardar un poco más.'}
          </div>
        </div>
        {/* Dismiss × — snoozes the banner for 2 min. If the connection
            is still bad after that window, the banner pops back up. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar aviso"
          style={{
            flexShrink: 0,
            width: 24, height: 24, borderRadius: 999,
            border: 'none', padding: 0, cursor: 'pointer',
            background: 'rgba(255,255,255,0.18)',
            color: colors.icon,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, transform 0.12s',
            marginLeft: 4,
          }}
          onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
          onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M6 18L18 6" stroke={colors.icon} strokeWidth="2.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes fp-net-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.85); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
};

export default NetworkIndicator;
