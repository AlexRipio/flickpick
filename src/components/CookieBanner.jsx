import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FP } from '@/lib/fp';
import { hasDecided, setConsent, onConsentChange } from '@/lib/consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !hasDecided());

  useEffect(() => {
    const unsub = onConsentChange(() => setVisible(!hasDecided()));
    return unsub;
  }, []);

  if (!visible) return null;

  const accept = () => setConsent({ analytics: true });
  const reject = () => setConsent({ analytics: false });

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      maxWidth: 520, margin: '0 auto', zIndex: 2147483646,
      padding: 18, borderRadius: 22,
      background: 'linear-gradient(135deg, rgba(22,12,46,0.97) 0%, rgba(12,6,28,0.97) 100%)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      fontFamily: '"Space Grotesk", system-ui',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🍪</span>
        <strong style={{ fontSize: 14, fontWeight: 800 }}>Cookies y privacidad</strong>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)', margin: '0 0 12px' }}>
        Usamos cookies <strong>técnicas</strong> para que la app funcione (sesión, salas,
        watchlist) y, si lo aceptas, cookies <strong>analíticas</strong> de Google Analytics
        para entender cómo se usa la app y mejorarla. Puedes cambiar tu decisión en
        cualquier momento desde la <Link to="/cookies" style={{ color: '#FF6B4A' }}>Política de Cookies</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={reject} style={{
          flex: 1, height: 42, borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: '"Space Grotesk", system-ui',
        }}>Solo técnicas</button>
        <button onClick={accept} style={{
          flex: 1.3, height: 42, borderRadius: 999,
          background: FP.flame, border: 'none',
          color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          fontFamily: '"Space Grotesk", system-ui',
          boxShadow: '0 6px 18px rgba(255,59,107,0.35)',
        }}>Aceptar todas</button>
      </div>
    </div>
  );
}
