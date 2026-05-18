import React, { useRef, useState } from 'react';
import { FP } from '@/lib/fp';

/**
 * ActiveRoomCard — "Sigue donde lo dejaste" con swipe-to-delete.
 *
 * - Tap normal → onOpen
 * - Drag horizontal hacia la derecha → revela papelera detrás
 * - Si supera 110px y suelta → onDismiss
 * - Si no llega → vuelve con spring
 * - Drag vertical → cede al scroll (touch-action: pan-y)
 */
export default function ActiveRoomCard({ room, onOpen, onDismiss }) {
  const start = useRef(null);
  const decided = useRef(null); // 'h' | 'v' | null
  const [dx, setDx] = useState(0);
  const [exiting, setExiting] = useState(false);

  const THRESHOLD = 110;

  const onDown = (e) => {
    if (exiting) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    decided.current = null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onMove = (e) => {
    if (!start.current || exiting) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    if (decided.current === null) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      decided.current = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
    }
    if (decided.current !== 'h') return;
    setDx(Math.max(0, mx));
  };

  const onUp = (e) => {
    if (!start.current || exiting) { start.current = null; return; }
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    const horiz = decided.current === 'h';
    start.current = null;
    decided.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    if (!horiz) {
      setDx(0);
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) onOpen?.();
      return;
    }
    if (mx >= THRESHOLD) {
      setExiting(true);
      setDx(600);
      setTimeout(() => onDismiss?.(), 240);
    } else {
      setDx(0);
    }
  };

  const past = dx >= THRESHOLD;
  const trans = dx === 0 || exiting ? 'transform 0.24s cubic-bezier(0.2,0.8,0.3,1)' : 'none';

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 20,
        borderRadius: 22,
      }}
    >
      {/* Papelera detrás (estática, no se anima de ancho — solo opacidad) */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          borderRadius: 22,
          background: past
            ? 'linear-gradient(90deg, #B0182E 0%, #8E1024 100%)'
            : 'linear-gradient(90deg, rgba(176,24,46,0.92) 0%, rgba(142,16,36,0.92) 100%)',
          display: 'flex', alignItems: 'center', paddingLeft: 22,
          opacity: dx > 4 ? 1 : 0,
          transition: 'opacity 0.18s, background 0.18s',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          color: '#fff',
          transform: `scale(${past ? 1.15 : 1})`,
          transition: 'transform 0.18s',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"
              stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* La tarjeta */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'relative',
          background: FP.flame,
          borderRadius: 22,
          padding: 18,
          boxShadow: '0 12px 30px rgba(255,59,107,0.3)',
          display: 'flex', alignItems: 'center', gap: 14,
          touchAction: 'pan-y',
          transform: `translateX(${dx}px)`,
          transition: trans,
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Sigue donde lo dejaste
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {room.name || `Sala · ${room.joinCode}`}
          </div>
          {room.name && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1, fontFamily: 'ui-monospace, Menlo, monospace' }}>#{room.joinCode}</div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {room.members?.length || 0} deslizando · {room.matches?.length || 0} matches
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </div>
  );
}
