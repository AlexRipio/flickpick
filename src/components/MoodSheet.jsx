import React, { useEffect, useState } from 'react';
import { FP } from '@/lib/fp';
import { VIBES, MAX_VIBES } from '@/lib/vibes';

/**
 * MoodSheet — bottom sheet to pick up to MAX_VIBES "vibes".
 * Same UX pattern as FiltersSheet (used in Tendencias).
 */
export default function MoodSheet({ open, value = [], onClose, onApply }) {
  const [sel, setSel] = useState(value);

  // Sync from parent each time the sheet opens
  useEffect(() => { if (open) setSel(value); }, [open, value]);

  if (!open) return null;

  const toggle = (id) => {
    setSel(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_VIBES) return prev;
      return [...prev, id];
    });
  };

  const reset = () => setSel([]);
  const apply = () => { onApply?.(sel); onClose?.(); };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fp-fade-in 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: '#0F0420',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          padding: '20px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          animation: 'fp-slide-up 0.22s cubic-bezier(.2,.8,.3,1)',
        }}
      >
        {/* Grabber */}
        <div style={{
          width: 44, height: 5, borderRadius: 999,
          background: 'rgba(255,255,255,0.18)',
          margin: '0 auto 18px',
        }}/>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: FP.text, margin: 0 }}>
            ¿Qué estilo os apetece?
          </h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: FP.textDim }}>
            {sel.length}/{MAX_VIBES}
          </span>
        </div>
        <p style={{ fontSize: 13, color: FP.textDim, margin: '0 0 18px' }}>
          Elige hasta {MAX_VIBES} estilos para afinar las pelis del swipe.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {VIBES.map(v => {
            const active = sel.includes(v.id);
            const disabled = !active && sel.length >= MAX_VIBES;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => !disabled && toggle(v.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '12px 6px', borderRadius: 16,
                  background: active ? FP.flame : 'rgba(255,255,255,0.05)',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  fontFamily: '"Space Grotesk", system-ui',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  boxShadow: active ? '0 6px 18px rgba(255,59,107,0.35)' : 'none',
                  transition: 'all 0.15s',
                  minHeight: 70,
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{v.emoji}</span>
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: FP.text, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >Limpiar</button>
          <button
            type="button"
            onClick={apply}
            style={{
              flex: 2, padding: '14px', borderRadius: 14,
              background: FP.flame, border: 'none',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
            }}
          >Aplicar</button>
        </div>
      </div>

      <style>{`
        @keyframes fp-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fp-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}
