import React, { useEffect, useRef, useState } from 'react';

/* Botón flotante "subir arriba" que aparece cuando el usuario ha bajado
   mucho en CUALQUIER contenedor con scroll interno (no solo window).
   Posicionado en la ESQUINA SUPERIOR DERECHA para evitar cualquier
   confusión con los controles de la BottomNav (que están abajo). */
const SHOW_AFTER_PX = 600;

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  // Mantenemos referencia al último contenedor que ha scrolleado para poder volver a 0 al pulsar
  const lastScrolledRef = useRef(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const target = e.target === document ? document.documentElement : e.target;
        const top = target.scrollTop ?? window.scrollY ?? 0;
        if (top > 0) lastScrolledRef.current = target;
        setVisible(top > SHOW_AFTER_PX);
        ticking = false;
      });
    };
    // Capture phase = oye eventos de cualquier contenedor que scrollee
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  const scrollUp = () => {
    const el = lastScrolledRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={scrollUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Volver arriba"
      style={{
        position: 'fixed',
        right: 14,
        // Esquina superior derecha, respetando el safe-area-top de iOS (notch / dynamic island)
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        width: 44,
        height: 44,
        borderRadius: 999,
        zIndex: 40,
        background: 'linear-gradient(135deg, rgba(30,18,52,0.85) 0%, rgba(20,10,40,0.90) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: hover
          ? '0 10px 28px rgba(0,0,0,0.6), 0 4px 14px rgba(255,107,74,0.35), inset 0 1px 0 rgba(255,255,255,0.20)'
          : '0 8px 22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="#FF6B4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
