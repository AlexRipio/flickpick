import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import { apiSendFeedback } from '@/lib/api';

const TYPES = [
  { id: 'bug',     emoji: '🐛', label: 'Bug',                   helper: 'Algo no funciona como debería' },
  { id: 'idea',    emoji: '💡', label: 'Idea',                  helper: 'Una mejora o función nueva' },
  { id: 'content', emoji: '🎬', label: 'Falta una peli o serie', helper: 'Contenido que no aparece' },
  { id: 'other',   emoji: '📝', label: 'Otro',                  helper: 'Cualquier otra cosa' },
];

const MAX_CHARS = 500;

const FeedbackSheet = ({ open, onClose, defaultEmail = '', onSent }) => {
  const [show, setShow] = useState(false);
  const [type, setType] = useState('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) { setShow(false); return; }
    setSent(false); setErr(''); setMessage(''); setType('idea');
    setEmail(defaultEmail);
    const t = setTimeout(() => setShow(true), 20);
    return () => clearTimeout(t);
  }, [open, defaultEmail]);

  const close = () => { setShow(false); setTimeout(() => onClose?.(), 220); };

  const submit = async () => {
    if (busy) return;
    if (message.trim().length < 5) { setErr('Cuéntanos un poco más.'); return; }
    setErr(''); setBusy(true);
    try {
      await apiSendFeedback({
        type, message: message.trim(),
        email: email.trim() || null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      setSent(true);
      onSent?.();
      setTimeout(close, 1500);
    } catch (e) {
      setErr(e?.message || 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
      backdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      WebkitBackdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      transition: 'background 0.25s, backdrop-filter 0.25s',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        background: 'linear-gradient(180deg, #1a0f2e 0%, #0B0420 100%)',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -30px 60px rgba(0,0,0,0.6)',
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(.2,.8,.3,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 44, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        {/* header */}
        <div style={{ padding: '6px 24px 10px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: FP.text, fontFamily: '"Space Grotesk", system-ui' }}>
            Enviar sugerencia
          </div>
          <div style={{ fontSize: 13, color: FP.textDim, marginTop: 4 }}>
            Tu opinión nos ayuda a mejorar FlickPick.
          </div>
        </div>

        {/* body */}
        {sent ? (
          <div style={{
            padding: '40px 24px 60px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(255,59,107,0.4)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>¡Gracias!</div>
            <div style={{ fontSize: 13, color: FP.textDim }}>Hemos recibido tu sugerencia.</div>
          </div>
        ) : (
          <div className="no-scrollbar" style={{
            overflowY: 'auto', padding: '4px 24px 12px',
            display: 'flex', flexDirection: 'column', gap: 18, flex: 1,
          }}>
            <div>
              <Label>Tipo</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TYPES.map(t => {
                  const active = type === t.id;
                  return (
                    <button key={t.id} onClick={() => setType(t.id)} style={{
                      padding: '12px 14px', borderRadius: 14, textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: active
                        ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.18))'
                        : 'rgba(255,255,255,0.04)',
                      border: active
                        ? '1px solid rgba(255,107,74,0.55)'
                        : '1px solid rgba(255,255,255,0.10)',
                      color: '#fff',
                      fontFamily: '"Space Grotesk", system-ui',
                    }}>
                      <div style={{ fontSize: 18 }}>{t.emoji}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.3 }}>{t.helper}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Mensaje</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Cuéntanos qué pasa, qué se podría mejorar o qué te falta…"
                rows={5}
                style={{
                  width: '100%', resize: 'vertical', minHeight: 110,
                  padding: '12px 14px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#fff', fontSize: 14, lineHeight: 1.5,
                  fontFamily: '"Space Grotesk", system-ui',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                fontSize: 11, color: FP.textMuted, marginTop: 4,
              }}>
                {message.length} / {MAX_CHARS}
              </div>
            </div>

            <div>
              <Label optional>Email para respuesta</Label>
              <input
                type="email" inputMode="email" autoCapitalize="none" autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com (opcional)"
                style={{
                  width: '100%', height: 44,
                  padding: '0 14px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#fff', fontSize: 14,
                  fontFamily: '"Space Grotesk", system-ui',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {err && (
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,59,107,0.12)',
                border: '1px solid rgba(255,59,107,0.35)',
                color: '#FFB0C2', fontSize: 13, fontWeight: 600,
              }}>{err}</div>
            )}
          </div>
        )}

        {/* sticky footer */}
        {!sent && (
          <div style={{
            padding: '12px 20px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(11,4,32,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex', gap: 10,
          }}>
            <button onClick={close} disabled={busy} style={{
              flex: 1, height: 50, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              opacity: busy ? 0.6 : 1,
            }}>Cancelar</button>
            <button onClick={submit} disabled={busy || message.trim().length < 5} style={{
              flex: 1.4, height: 50, borderRadius: 999,
              background: (busy || message.trim().length < 5)
                ? 'rgba(255,59,107,0.4)' : FP.flame,
              border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: (busy || message.trim().length < 5) ? 'default' : 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              boxShadow: '0 8px 22px rgba(255,59,107,0.38)',
            }}>{busy ? 'Enviando…' : 'Enviar'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const Label = ({ children, optional = false }) => (
  <div style={{
    fontSize: 11, fontWeight: 800, color: FP.textDim,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  }}>
    {children}
    {optional && <span style={{ marginLeft: 6, fontWeight: 600, opacity: 0.7 }}>· opcional</span>}
  </div>
);

export default FeedbackSheet;
