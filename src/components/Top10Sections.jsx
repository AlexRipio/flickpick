import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FP } from '@/lib/fp';
import { posterUrl } from '@/lib/tmdb';
import { isInWatchlist, toggleWatchlist, subscribeWatchlist } from '@/lib/watchlist';

// ── Persistencia del orden de plataformas por tab ──────────────────────────
const ORDER_KEY = (tab) => `flickpick.top10.order.${tab}`;
function loadOrder(tab, defaultKeys) {
  try {
    const raw = localStorage.getItem(ORDER_KEY(tab));
    if (!raw) return defaultKeys;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return defaultKeys;
    const valid   = saved.filter(k => defaultKeys.includes(k));
    const missing = defaultKeys.filter(k => !valid.includes(k));
    return [...valid, ...missing];
  } catch { return defaultKeys; }
}
function saveOrder(tab, keys) {
  try { localStorage.setItem(ORDER_KEY(tab), JSON.stringify(keys)); } catch {}
  // Cross-device sync (debounced PATCH /api/user/settings)
  try {
    import('@/lib/userSync').then(({ userSync }) => {
      if (tab === 'movies')         userSync.top10Movies(keys);
      else if (tab === 'series')    userSync.top10Series(keys);
      else if (tab === 'cartelera') userSync.top10Cartelera(keys);
    }).catch(() => {});
  } catch {}
}

/**
 * Top10Sections — bloque de filas horizontales con el Top 10 por
 * plataforma, inspirado en la captura del usuario. Cada fila lleva el
 * logo + 10 tarjetas con rango grande, póster y botón rápido "Guardar".
 *
 * Uso:
 *   <Top10Sections tab="movies" /> → películas
 *   <Top10Sections tab="series" /> → series
 *   <Top10Sections tab="cartelera" /> → resalta "En cines" arriba
 */
// Plataformas para el Top 10. `letter` es el fallback que se pinta en
// un cuadrado de color cuando el logo de TMDB no está disponible.
const PLATFORMS_BASE = [
  { key: 'netflix',  name: 'Netflix',     providerId: 8,    accent: '#E50914', logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg', letter: 'N' },
  { key: 'prime',    name: 'Prime Video', providerId: 119,  accent: '#00A8E1', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg', letter: 'P' },
  { key: 'max',      name: 'Max',         providerId: 1899, accent: '#9B3BFF', logo: '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg', letter: 'M' },
  { key: 'cinemas',  name: 'En cines',    providerId: null, accent: '#FF6B4A', logo: null,                                letter: '🎬' },
  { key: 'disney',   name: 'Disney+',     providerId: 337,  accent: '#0F2A6F', logo: '/97yvRBw1GzX7fXprcF80er19ot.jpg',  letter: 'D+' },
  { key: 'apple',    name: 'Apple TV+',   providerId: 350,  accent: '#0a0a0a', logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',  letter: '' },
  // Logos oficiales de TMDB — paths verificados contra la API
  // /watch/providers/movie?watch_region=ES.
  { key: 'movistar', name: 'Movistar+',   providerId: 2241, accent: '#019DF4', logo: '/jse4MOi92Jgetym7nbXFZZBI6LK.jpg', letter: 'M+' },
  { key: 'filmin',   name: 'Filmin',      providerId: 63,   accent: '#0E1620', logo: '/kO2SWXvDCHAquaUuTJBuZkTBAuU.jpg', letter: 'F' },
];

// Backend proxy hides TMDB API key. See backend/routes/tmdb.js.
const API_BASE = import.meta.env.VITE_API_URL || 'https://flickpick.mov/api';
const TMDB = API_BASE + '/tmdb';
const REGION = 'ES';

// Platforms with a real, source-of-truth top-10 endpoint
// (`GET /api/top10/:platform`). Other platforms fall back to TMDB
// popularity-by-provider, which is an approximation only.
const REAL_TOP10_PLATFORMS = new Set(['netflix']);

// Module-level cache so navigating away and back doesn't refetch.
const TOP10_CACHE = new Map(); // key: `${tab}:${platformKey}` -> items[]

async function fetchRealTop10({ platformKey, mediaType }) {
  const url = `${API_BASE}/top10/${platformKey}?type=${mediaType}&region=${REGION}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const items = Array.isArray(j.items) ? j.items.filter(m => m.poster_path).slice(0, 10) : [];
    return items.length ? items : null;
  } catch { return null; }
}

async function fetchTop10({ mediaType, providerId }) {
  const params = new URLSearchParams({
    language: 'es-ES',
    sort_by: 'popularity.desc',
    watch_region: REGION,
    with_watch_providers: String(providerId),
    with_watch_monetization_types: 'flatrate|ads|free',
    'vote_count.gte': mediaType === 'tv' ? '20' : '40',
    page: '1',
  });
  try {
    const r = await fetch(`${TMDB}/discover/${mediaType}?${params}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).filter(m => m.poster_path).slice(0, 10);
  } catch { return []; }
}

async function fetchInCinemas() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const from = new Date(today);
  // Ventana de 60 días: la mayoría de cines mantiene un estreno 4-8 semanas.
  // Más allá de eso, TMDB todavía marca release_type=3 pero la peli ya está fuera de cartel.
  from.setDate(from.getDate() - 60);
  const fromStr = from.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    language: 'es-ES',
    sort_by: 'popularity.desc', include_adult: 'false',
    region: REGION, watch_region: REGION,
    with_release_type: '3|2',
    'primary_release_date.gte': fromStr,
    'primary_release_date.lte': todayStr,
    without_watch_monetization_types: 'flatrate',
    page: '1',
  });
  try {
    const r = await fetch(`${TMDB}/discover/movie?${params}`);
    if (!r.ok) return [];
    const j = await r.json();
    const candidates = (j.results || []).filter(m => m.poster_path).slice(0, 25);

    // Cross-check defensivo: TMDB a veces deja pasar pelis que ya están en flatrate.
    // Pedimos /watch/providers por película y descartamos las que tengan
    // suscripción (flatrate) en ES. Renta o compra (rent/buy) sí se permite —
    // muchas pelis aún en cines también están en TVOD.
    const checked = await Promise.all(candidates.map(async (m) => {
      try {
        const pr = await fetch(`${TMDB}/movie/${m.id}/watch/providers`);
        if (!pr.ok) return m; // si falla el check, no descartamos (mejor incluir que perder)
        const pj = await pr.json();
        const es = pj?.results?.[REGION];
        // Si tiene proveedores flatrate en ES → ya está en streaming → fuera.
        if (es?.flatrate && es.flatrate.length > 0) return null;
        return m;
      } catch {
        return m;
      }
    }));

    return checked.filter(Boolean).slice(0, 10);
  } catch { return []; }
}

const PLATFORM_BY_KEY = Object.fromEntries(PLATFORMS_BASE.map(p => [p.key, p]));

const Top10Sections = ({ tab, onOpenItem }) => {
  // Lista base de keys disponibles para este tab.
  const baseKeys = useMemo(() => {
    if (tab === 'series')    return PLATFORMS_BASE.filter(p => p.key !== 'cinemas').map(p => p.key);
    if (tab === 'cartelera') return ['cinemas'];
    return PLATFORMS_BASE.map(p => p.key);
  }, [tab]);

  const [order, setOrder] = useState(() => loadOrder(tab, baseKeys));
  const [editing, setEditing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  // ── FLIP animation: cuando el orden cambia, animamos cada fila desde su
  //    posición previa hasta la nueva con un translateY tweenable.
  const rowRefs = useRef(new Map());
  const prevRectsRef = useRef(new Map());
  // Captura rects ANTES del render que va a aplicar el nuevo orden.
  const captureRects = () => {
    const map = new Map();
    rowRefs.current.forEach((el, key) => {
      if (el) map.set(key, el.getBoundingClientRect().top);
    });
    prevRectsRef.current = map;
  };
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (!prev || prev.size === 0) return;
    rowRefs.current.forEach((el, key) => {
      if (!el) return;
      const oldTop = prev.get(key);
      if (oldTop == null) return;
      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (!delta) return;
      // FLIP: pinta inmediatamente en la pos antigua, luego anímate a la nueva
      el.style.transition = 'none';
      el.style.transform = `translate3d(0, ${delta}px, 0)`;
      // forzar layout para que el siguiente frame tome este transform como inicio
      el.getBoundingClientRect();
      el.style.transition = 'transform 360ms cubic-bezier(.22,.94,.34,1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    });
    prevRectsRef.current = new Map();
  });

  // Cuando cambia el tab resync orden + cierra edición
  useEffect(() => {
    setOrder(loadOrder(tab, baseKeys));
    setEditing(false);
  }, [tab, baseKeys]);

  const mediaType = tab === 'series' ? 'tv' : 'movie';
  const canEdit   = order.length > 1;
  const orderedPlatforms = order.map(k => PLATFORM_BY_KEY[k]).filter(Boolean);

  // Cuando el sheet aplica un nuevo orden, capturamos rects ANTES del
  // re-render para que el FLIP de las filas grandes se anime suavemente.
  const applyReorder = (next) => {
    captureRects();
    setOrder(next);
    saveOrder(tab, next);
    setToastVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 36 }}>

      {/* Toast "Orden guardado" */}
      {toastVisible && (
        <div style={{
          position: 'fixed',
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 86px)`,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 300,
          background: 'rgba(15,4,32,0.96)',
          border: '1px solid rgba(255,107,74,0.45)',
          borderRadius: 20,
          padding: '10px 20px',
          color: '#fff',
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,107,74,0.15)',
          animation: 'fp-fade-in 0.2s ease-out',
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#FF6B4A', fontSize: 15 }}>✓</span>
          Orden guardado
        </div>
      )}

      {/* FAB flotante — bottom-right, encima del BottomNav. No roba espacio
          al contenido y queda a un toque mientras scrolleas. */}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Reordenar plataformas"
          style={{
            position: 'fixed',
            right: 18,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + 96px)`,
            zIndex: 40,
            width: 54, height: 54, borderRadius: 999,
            background: 'linear-gradient(135deg,#FF6B4A,#FF3B6B)',
            border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            boxShadow: '0 12px 30px rgba(255,59,107,0.45), 0 4px 10px rgba(0,0,0,0.3)',
            transition: 'transform 0.18s, box-shadow 0.18s',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {/* Icono lista con flechas verticales — comunica "reordenar" */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M8 6h12M8 12h12M8 18h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M3 4l2-2 2 2M5 2v6M3 20l2 2 2-2M5 22v-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Sheet compacto para reordenar — toda la lista visible */}
      {editing && (
        <ReorderSheet
          orderedKeys={order}
          onClose={() => setEditing(false)}
          onReorder={applyReorder}
        />
      )}

      {orderedPlatforms.map((p) => (
        <PlatformRow
          key={`${tab}:${p.key}`}
          tab={tab}
          mediaType={mediaType}
          platform={p}
          onOpenItem={onOpenItem}
          registerRef={(el) => {
            if (el) rowRefs.current.set(p.key, el);
            else rowRefs.current.delete(p.key);
          }}
        />
      ))}
    </div>
  );
};

// Logo de la plataforma. Para casos donde TMDB no sirve un logo fiable
// (Movistar+, Filmin, En cines) renderizamos un mark inline con la
// tipografía/estética oficial de la marca. El resto usa imagen TMDB con
// fallback a la inicial brand-coloured.
// ── ReorderSheet — bottom sheet con la lista compacta y drag chulo ─────
function ReorderSheet({ orderedKeys, onClose, onReorder }) {
  const [keys, setKeys] = useState(orderedKeys);
  const [dragKey, setDragKey] = useState(null);
  // Pull-to-close on the top handle
  const [dragHandleY, setDragHandleY] = useState(0);
  const handleStartRef = useRef(null);
  const onHandleDown = (e) => {
    handleStartRef.current = e.clientY;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onHandleMove = (e) => {
    if (handleStartRef.current == null) return;
    const dy = e.clientY - handleStartRef.current;
    setDragHandleY(Math.max(0, dy));
  };
  const onHandleUp = (e) => {
    if (handleStartRef.current == null) return;
    const dy = e.clientY - handleStartRef.current;
    handleStartRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (dy > 80) {
      // Animate out then close
      setDragHandleY(window.innerHeight);
      setTimeout(() => onClose(), 180);
    } else {
      setDragHandleY(0);
    }
  };
  // lastSwapY: posición Y del dedo en el último swap (o en pointerdown)
  const dragRef = useRef({ lastSwapY: 0, rowHeight: 56 });
  const itemRefs = useRef(new Map());
  const prevRectsRef = useRef(new Map());

  const captureRects = () => {
    const map = new Map();
    itemRefs.current.forEach((el, k) => { if (el) map.set(k, el.getBoundingClientRect().top); });
    prevRectsRef.current = map;
  };
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (!prev || prev.size === 0) return;
    itemRefs.current.forEach((el, k) => {
      // El elemento arrastrado ya está controlado por translateY del dedo; no hacerle FLIP
      if (k === dragKey) return;
      const oldTop = prev.get(k);
      if (oldTop == null || !el) return;
      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (!delta) return;
      el.style.transition = 'none';
      el.style.transform = `translate3d(0, ${delta}px, 0)`;
      el.getBoundingClientRect();
      el.style.transition = 'transform 320ms cubic-bezier(.22,.94,.34,1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    });
    prevRectsRef.current = new Map();
  });

  // Usado por los botones ↑/↓ (no por drag)
  const move = (key, direction) => {
    captureRects();
    setKeys(prev => {
      const i = prev.indexOf(key);
      const t = i + direction;
      if (i < 0 || t < 0 || t >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[t]] = [next[t], next[i]];
      return next;
    });
  };

  // Refs para evitar stale closures en pointermove cuando el dragKey cambia.
  const dragKeyRef = useRef(null);
  const rafRef     = useRef(0);
  const lastEventRef = useRef(null);

  // Aplica transform directamente al DOM (sin pasar por React) usando rAF
  // para coalescer múltiples pointermove dentro del mismo frame.
  const applyDragFrame = () => {
    rafRef.current = 0;
    const ev = lastEventRef.current;
    const key = dragKeyRef.current;
    if (!ev || !key) return;
    const el = itemRefs.current.get(key);
    if (!el) return;
    const dy = ev.clientY - dragRef.current.lastSwapY;
    el.style.transform = `translate3d(0, ${dy}px, 0) scale(1.03)`;

    // Swap al cruzar exactamente la mitad de una fila — sin sub-pixel jitter.
    const { rowHeight } = dragRef.current;
    if (Math.abs(dy) >= rowHeight * 0.5) {
      const dir = dy > 0 ? 1 : -1;
      // Compensa la posición de referencia: tras el swap, el elemento
      // sube/baja una fila «naturalmente», así que movemos lastSwapY
      // exactamente rowHeight en la misma dirección. Resultado: la peli
      // no salta, sigue exactamente bajo el dedo.
      dragRef.current.lastSwapY += rowHeight * dir;
      captureRects();
      setKeys(prev => {
        const i = prev.indexOf(key);
        const t = i + dir;
        if (i < 0 || t < 0 || t >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[t]] = [next[t], next[i]];
        return next;
      });
    }
  };

  const onPointerDown = (e, key) => {
    // Solo botón principal o touch/pen
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const el = itemRefs.current.get(key);
    const rowH = el?.offsetHeight || 56;
    dragRef.current = { lastSwapY: e.clientY, rowHeight: rowH };
    dragKeyRef.current = key;
    setDragKey(key);
    // Bloqueo total del transition para que el imperative transform mande
    if (el) {
      el.style.transition = 'none';
      el.style.willChange = 'transform';
      el.style.transform = 'translate3d(0,0,0) scale(1.03)';
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragKeyRef.current) return;
    e.preventDefault();
    lastEventRef.current = e;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(applyDragFrame);
    }
  };

  const onPointerUp = () => {
    const key = dragKeyRef.current;
    if (key) {
      const el = itemRefs.current.get(key);
      if (el) {
        el.style.transition = 'transform 180ms cubic-bezier(.22,.94,.34,1)';
        el.style.transform = 'translate3d(0,0,0) scale(1)';
        // Limpia willChange tras la animación para liberar memoria GPU
        setTimeout(() => {
          if (el) { el.style.willChange = ''; el.style.transition = ''; el.style.transform = ''; }
        }, 200);
      }
    }
    dragKeyRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    lastEventRef.current = null;
    setDragKey(null);
  };

  const apply = () => { onReorder(keys); onClose(); };
  const cancel = () => onClose();

  return (
    <div
      onClick={cancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fp-fade-in 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: '#0F0420',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          // BottomNav floats ~80px above the viewport bottom in PWA mode;
          // pad the sheet bottom enough so the action buttons clear it.
          padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 96px)',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.55)',
          animation: 'fp-slide-up 0.24s cubic-bezier(.2,.8,.3,1)',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          transform: `translateY(${dragHandleY}px)`,
          transition: dragHandleY === 0 ? 'transform 0.24s cubic-bezier(.2,.8,.3,1)' : 'none',
        }}
      >
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          style={{
            // Larger touch target (24px high) with a visual bar in the middle.
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: 24, marginBottom: 6,
            cursor: 'grab', touchAction: 'none',
          }}
        >
          <div style={{ width: 44, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.32)' }}/>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 8px 4px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>Tu orden</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: FP.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Arrastra para reordenar
          </span>
        </div>

        <div style={{ overflowY: 'auto', padding: '10px 4px', flex: 1, minHeight: 0 }}>
          {keys.map((k, idx) => {
            const p = PLATFORM_BY_KEY[k];
            if (!p) return null;
            const dragging = dragKey === k;
            const dimmed = dragKey && !dragging;
            return (
              <div
                key={k}
                ref={(el) => { if (el) itemRefs.current.set(k, el); else itemRefs.current.delete(k); }}
                onPointerDown={(e) => onPointerDown(e, k)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', marginBottom: 6,
                  borderRadius: 14,
                  background: dragging
                    ? 'linear-gradient(135deg, rgba(255,107,74,0.22), rgba(255,59,107,0.18))'
                    : 'rgba(255,255,255,0.04)',
                  border: dragging ? '1px solid rgba(255,107,74,0.6)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: dragging ? '0 14px 36px rgba(255,59,107,0.32)' : 'none',
                  opacity: dimmed ? 0.45 : 1,
                  filter: dimmed ? 'saturate(0.6)' : 'none',
                  // Cuando se está arrastrando, el transform lo controla
                  // exclusivamente el código imperativo (rAF + pointermove);
                  // si ponemos transform aquí pisa el translate3d del dedo.
                  ...(dragging ? null : { transform: 'scale(1)' }),
                  // Transition NO incluye transform durante drag para evitar
                  // que el navegador interpole y cause el efecto de "adelanto".
                  transition: dragging
                    ? 'background 0.18s, border-color 0.18s, box-shadow 0.18s'
                    : 'background 0.18s, border-color 0.18s, box-shadow 0.18s, opacity 0.18s, filter 0.18s, transform 0.18s',
                  cursor: dragging ? 'grabbing' : 'grab',
                  touchAction: 'none', userSelect: 'none',
                  WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  position: 'relative', zIndex: dragging ? 5 : 'auto',
                }}
              >
                {/* Rank pill */}
                <div style={{
                  width: 22, height: 22, borderRadius: 999,
                  background: dragging ? '#fff' : 'rgba(255,255,255,0.10)',
                  color: dragging ? '#FF3B6B' : '#fff',
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{idx + 1}</div>
                <div style={{ width: 36, height: 36, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                  <PlatformLogoCompact platform={p}/>
                </div>
                <div style={{
                  flex: 1, color: '#fff',
                  fontFamily: '"Space Grotesk", system-ui',
                  fontSize: 15, fontWeight: 700, letterSpacing: -0.3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.name}</div>
                {/* Up/Down quick buttons */}
                <button
                  type="button"
                  aria-label="Subir"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); move(k, -1); }}
                  disabled={idx === 0}
                  style={miniArrow(idx > 0)}
                >↑</button>
                <button
                  type="button"
                  aria-label="Bajar"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); move(k, +1); }}
                  disabled={idx === keys.length - 1}
                  style={miniArrow(idx < keys.length - 1)}
                >↓</button>
                {/* Drag handle (visual only — todo el row es draggable) */}
                <svg width="16" height="14" viewBox="0 0 16 14" fill="none" style={{ flexShrink: 0, opacity: 0.55 }}>
                  <rect x="2" y="2"  width="12" height="1.6" rx="0.8" fill="#fff"/>
                  <rect x="2" y="6"  width="12" height="1.6" rx="0.8" fill="#fff"/>
                  <rect x="2" y="10" width="12" height="1.6" rx="0.8" fill="#fff"/>
                </svg>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '10px 4px 0' }}>
          <button
            type="button"
            onClick={cancel}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            type="button"
            onClick={apply}
            style={{
              flex: 2, padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg,#FF6B4A,#FF3B6B)',
              border: 'none', color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
            }}
          >Guardar orden</button>
        </div>
      </div>
    </div>
  );
}

function miniArrow(enabled) {
  return {
    width: 26, height: 26, borderRadius: 7,
    background: enabled ? 'rgba(255,255,255,0.06)' : 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    color: enabled ? '#fff' : 'rgba(255,255,255,0.18)',
    fontSize: 13, fontWeight: 700, lineHeight: 1,
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    flexShrink: 0,
  };
}

function PlatformLogoCompact({ platform }) {
  if (platform.key === 'cinemas') {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg,#FF6B4A,#FF3B6B)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18 }}>🍿</span>
      </div>
    );
  }
  if (!platform.logo) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: platform.accent || '#1a0f2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 12,
      }}>{platform.letter || platform.name?.[0]}</div>
    );
  }
  return (
    <img
      src={`https://image.tmdb.org/t/p/w92${platform.logo}`}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

function PlatformLogo({ platform }) {
  const SIZE = 38;
  // Custom inline brand marks for the trickier cases.
  if (platform.key === 'cinemas') {
    // Popcorn-style flame badge.
    return (
      <div style={{
        width: SIZE, height: SIZE, borderRadius: 9, flexShrink: 0,
        background: 'linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(255,107,74,0.40)',
      }}>
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          {/* Bucket */}
          <path d="M6 11h20l-2 18a2 2 0 01-2 2H10a2 2 0 01-2-2L6 11z"
            fill="#fff" stroke="#fff" strokeWidth="0.8" strokeLinejoin="round"/>
          {/* Red stripes */}
          <path d="M11 13v18M16 13v18M21 13v18" stroke="#FF3B6B" strokeWidth="2.2" strokeLinecap="round"/>
          {/* Popcorn puffs at top */}
          <circle cx="9.5"  cy="9"  r="3" fill="#FFE6BD"/>
          <circle cx="14"   cy="6.5" r="3.5" fill="#FFD49A"/>
          <circle cx="19"   cy="7"  r="3.2" fill="#FFE6BD"/>
          <circle cx="23"   cy="9"  r="3"   fill="#FFD49A"/>
          <circle cx="16"   cy="9.5" r="2.8" fill="#FFF1D6"/>
        </svg>
      </div>
    );
  }
  // Default: TMDB image with letter fallback.
  const [broken, setBroken] = useState(!platform.logo);
  if (broken || !platform.logo) {
    return (
      <div style={{
        width: SIZE, height: SIZE, borderRadius: 9, flexShrink: 0,
        background: platform.accent || '#1a0f2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 14,
        fontFamily: '"Space Grotesk", system-ui',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>{platform.letter || platform.name?.[0] || '?'}</div>
    );
  }
  return (
    <img
      src={`https://image.tmdb.org/t/p/w154${platform.logo}`}
      alt={platform.name}
      onError={() => setBroken(true)}
      style={{
        width: SIZE, height: SIZE, borderRadius: 9, objectFit: 'cover',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    />
  );
}

function PlatformRow({ tab, mediaType, platform, onOpenItem, registerRef }) {
  const cacheKey = `${tab}:${platform.key}`;
  const [items, setItems] = useState(() => TOP10_CACHE.get(cacheKey) || null);
  const [loading, setLoading] = useState(items === null);
  const rowRef = useRef(null);
  const setRowRef = (el) => { rowRef.current = el; registerRef?.(el); };

  useEffect(() => {
    if (items !== null) return;
    let cancel = false;
    (async () => {
      let list;
      if (platform.key === 'cinemas') {
        list = await fetchInCinemas();
      } else if (REAL_TOP10_PLATFORMS.has(platform.key)) {
        // Real source-of-truth ranking. If the endpoint is unavailable
        // (e.g. backend hiccup) fall back to the TMDB popularity heuristic
        // so the row never goes empty.
        list = await fetchRealTop10({ platformKey: platform.key, mediaType });
        if (!list) {
          list = await fetchTop10({ mediaType, providerId: platform.providerId });
        }
      } else {
        list = await fetchTop10({ mediaType, providerId: platform.providerId });
      }
      if (cancel) return;
      TOP10_CACHE.set(cacheKey, list);
      setItems(list);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [cacheKey, mediaType, platform, items]);

  if (!loading && items?.length === 0) return null;

  return (
    <div ref={setRowRef} data-row>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 24px 12px',
      }}>
        <PlatformLogo platform={platform}/>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 16, fontWeight: 800, color: '#fff',
            fontFamily: '"Space Grotesk", system-ui',
            letterSpacing: -0.3,
          }}>{platform.name}</div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: FP.textMuted,
            letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 1,
          }}>Top 10</div>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div className="no-scrollbar" style={{
        display: 'flex', gap: 4, overflowX: 'auto', overflowY: 'hidden',
        padding: '0 24px 4px',
        scrollSnapType: 'x mandatory',
      }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((m, i) => (
            <RankedCard
              key={m.id}
              movie={m}
              rank={i + 1}
              onOpen={() => onOpenItem?.(m)}
            />
          ))}
      </div>
    </div>
  );
}

function RankedCard({ movie, rank, onOpen }) {
  const [saved, setSaved] = useState(() => isInWatchlist(movie.id));
  useEffect(() => {
    const unsub = subscribeWatchlist(() => setSaved(isInWatchlist(movie.id)));
    return unsub;
  }, [movie.id]);

  const toggleSave = (e) => {
    e.stopPropagation();
    toggleWatchlist(movie);
  };
  const title = movie.title || movie.name;
  const poster = posterUrl(movie.poster_path, 'w342');

  return (
    <div
      onClick={onOpen}
      style={{
        flexShrink: 0, position: 'relative',
        width: 156, height: 200,
        cursor: 'pointer',
        scrollSnapAlign: 'start',
      }}
    >
      {/* Huge italic rank — peeking from the left of the poster, blue
          gradient stroke with depth shadow (Netflix Top-10 style). */}
      <div style={{
        position: 'absolute', left: -8, bottom: -6, zIndex: 1,
        fontFamily: '"Inter", "Space Grotesk", system-ui',
        fontSize: 200, fontWeight: 900, fontStyle: 'italic',
        lineHeight: 0.78, letterSpacing: -10,
        color: 'transparent',
        WebkitTextStroke: '2.2px #fff',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(120,160,255,0.08) 60%, transparent 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        textShadow: '0 8px 18px rgba(0,0,0,0.7), 0 0 24px rgba(80,120,220,0.35)',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.55))',
      }}>{rank}</div>

      {/* Poster card with the save button OVERLAID inside at the bottom */}
      <div style={{
        position: 'absolute', right: 0, top: 0,
        width: 108, height: 162, borderRadius: 10, overflow: 'hidden',
        background: '#1a0f2e', zIndex: 2,
        boxShadow: '0 12px 26px rgba(0,0,0,0.6)',
      }}>
        {poster ? (
          <img src={poster} alt={title} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
          }}>🎬</div>
        )}

        {/* Bottom scrim so the button text reads on bright posters */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 56,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          pointerEvents: 'none',
        }}/>

        {/* Save pill inside the poster, bottom centered */}
        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? 'Quitar de mi lista' : 'Guardar en mi lista'}
          style={{
            position: 'absolute', left: 8, right: 8, bottom: 8,
            height: 26, padding: 0, borderRadius: 6, cursor: 'pointer',
            background: saved
              ? '#FF3B6B'
              : 'rgba(0,0,0,0.55)',
            border: saved
              ? 'none'
              : '1px solid rgba(255,255,255,0.30)',
            color: '#fff',
            fontFamily: '"Space Grotesk", system-ui',
            fontWeight: 800, fontSize: 10.5, letterSpacing: 0.3,
            textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            boxShadow: saved ? '0 4px 12px rgba(255,59,107,0.50)' : 'none',
          }}
        >
          {saved ? 'Guardada' : '+ Guardar'}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      flexShrink: 0, position: 'relative',
      width: 156, height: 200,
    }}>
      <div style={{
        position: 'absolute', right: 0, top: 0,
        width: 108, height: 162, borderRadius: 10,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'fp-shimmer 1.4s infinite',
      }}/>
    </div>
  );
}

export default Top10Sections;
