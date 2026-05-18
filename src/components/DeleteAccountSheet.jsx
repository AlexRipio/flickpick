import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import { apiDeleteAccount } from '@/lib/api';

const CONFIRM_WORD = 'ELIMINAR';

/**
 * DeleteAccountSheet — bottom sheet de confirmación de borrado.
 *
 * Props:
 *   onClose()    — cierra el sheet sin acción.
 *   onDeleted()  — llamado tras éxito; el caller hace signOut + redirect.
 */
const DeleteAccountSheet = ({ onClose, onDeleted }) => {
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 20);
    const onKey = (e) => { if (e.key === 'Escape' && !busy) handleClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = text.trim().toUpperCase() === CONFIRM_WORD;

  const handleClose = () => {
    if (busy) return;
    setShow(false);
    setTimeout(() => onClose?.(), 220);
  };

  const handleDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setErr('');
    try {
      await apiDeleteAccount(CONFIRM_WORD);
      setShow(false);
      setTimeout(() => onDeleted?.(), 220);
    } catch (e) {
      setBusy(false);
      setErr(e?.message || 'No se pudo eliminar la cuenta');
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Eliminar cuenta"
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        opacity: show ? 1 : 0,
        transition: 'opacity .22s ease',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'linear-gradient(180deg, #14080F 0%, #0A0610 100%)',
          borderTop: '1px solid rgba(255,107,107,0.22)',
          borderRadius: '24px 24px 0 0',
          padding: '22px 22px calc(env(safe-area-inset-bottom, 0px) + 22px)',
          transform: show ? 'translateY(0)' : 'translateY(40px)',
          transition: 'transform .28s cubic-bezier(.2,.9,.25,1)',
          boxShadow: '0 -20px 60px rgba(255,59,107,.18)',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 38, height: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.18)',
          margin: '0 auto 18px',
        }}/>

        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255,75,75,0.22), rgba(255,75,75,0.06))',
            border: '1px solid rgba(255,75,75,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17v.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"
                stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: '"Space Grotesk", system-ui', fontWeight: 800,
              fontSize: 20, color: '#FFE7E7', letterSpacing: '-0.3px',
            }}>Eliminar cuenta</div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: 2, textTransform: 'uppercase',
              color: '#FF6B6B', marginTop: 2,
            }}>Acción irreversible</div>
          </div>
        </div>

        {/* Warning */}
        <div style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(255,75,75,0.06)',
          border: '1px solid rgba(255,75,75,0.18)',
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: 'Inter, system-ui', fontSize: 13.5, lineHeight: 1.5,
            color: 'rgba(255,255,255,0.78)',
          }}>
            Esto eliminará permanentemente tu cuenta, perfil, salas creadas, watchlist, matches y avatares.
            <strong style={{ color: '#FFB3B3', display: 'block', marginTop: 6 }}>
              No se puede deshacer.
            </strong>
          </div>
        </div>

        {/* Confirm input */}
        <div style={{ marginBottom: 8 }}>
          <label style={{
            display: 'block', marginBottom: 8,
            fontFamily: 'Inter, system-ui', fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
          }}>
            Escribe <strong style={{
              color: '#FF6B6B', letterSpacing: 1,
              fontFamily: '"JetBrains Mono", monospace',
            }}>{CONFIRM_WORD}</strong> para confirmar:
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={CONFIRM_WORD}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '14px 16px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 16, letterSpacing: 1.5,
              color: '#fff',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${matches ? 'rgba(255,75,75,0.55)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 12,
              outline: 'none',
              transition: 'border-color .18s ease',
            }}
          />
        </div>

        {err && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(255,75,75,0.08)',
            border: '1px solid rgba(255,75,75,0.25)',
            fontSize: 13, color: '#FFB3B3',
          }}>{err}</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{
              flex: 1, padding: '14px 16px',
              borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontFamily: '"Space Grotesk", system-ui', fontWeight: 700, fontSize: 15,
            }}
          >Cancelar</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!matches || busy}
            style={{
              flex: 1, padding: '14px 16px',
              borderRadius: 12,
              cursor: (!matches || busy) ? 'not-allowed' : 'pointer',
              background: (!matches || busy)
                ? 'rgba(255,75,75,0.18)'
                : 'linear-gradient(90deg,#FF4B4B,#FF1F4F)',
              border: '1px solid rgba(255,75,75,0.55)',
              color: (!matches || busy) ? 'rgba(255,255,255,0.45)' : '#fff',
              fontFamily: '"Space Grotesk", system-ui', fontWeight: 800, fontSize: 15,
              boxShadow: (!matches || busy) ? 'none' : '0 8px 24px rgba(255,31,79,0.35)',
              transition: 'all .18s ease',
            }}
          >{busy ? 'Eliminando…' : 'Eliminar cuenta'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteAccountSheet;
