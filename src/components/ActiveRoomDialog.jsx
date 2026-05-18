import React, { useState } from 'react';

/**
 * ActiveRoomDialog — modal that surfaces when the user tries to
 * create/join a new room while another one is still active.
 *
 * Closes with a 320ms fade so the backdrop absorbs the ghost touchend
 * on mobile (otherwise the click would fall through to whatever sits
 * behind once the dialog unmounts).
 */
export default function ActiveRoomDialog({
  room,
  intent = 'create', // 'create' | 'join'
  onReturn,
  onConfirm,
  onCancel,
}) {
  const [closing, setClosing] = useState(false);

  if (!room) return null;
  const actionLabel = intent === 'join' ? 'Unirme igualmente' : 'Crear nueva';
  const explanation = intent === 'join'
    ? 'Si te unes a otra, dejarás esta y perderás los swipes que aún no hayan hecho match.'
    : 'Si creas una nueva, dejarás esta y perderás los swipes que aún no hayan hecho match.';
  const title = room.name || `Sala · ${room.joinCode}`;

  const wrap = (fn) => (e) => {
    if (closing) return;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setClosing(true);
    setTimeout(() => fn?.(), 320);
  };

  return (
    <div
      onClick={wrap(onCancel)}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(7,5,14,0.82)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.18s ease',
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
          animation: 'fp-pop-in 0.22s cubic-bezier(0.2,0.8,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(255,59,107,0.35)',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Tienes una sala activa</div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5,
          marginBottom: 18,
        }}>
          {explanation}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={wrap(onReturn)}
            style={{
              height: 52, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
              color: '#fff', fontWeight: 800, fontSize: 14,
              border: 'none', cursor: 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              boxShadow: '0 10px 24px rgba(255,59,107,0.35)',
            }}
          >
            Volver a la sala
          </button>
          <button
            onClick={wrap(onConfirm)}
            style={{
              height: 50, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
            }}
          >
            {actionLabel}
          </button>
          <button
            onClick={wrap(onCancel)}
            style={{
              height: 44, borderRadius: 999,
              background: 'transparent',
              color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 13,
              border: 'none', cursor: 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
