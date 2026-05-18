import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import {
  getTrending, getTrendingTV, getNowPlaying, getUpcoming, getUpcomingTV,
  getMoviesByGenre, getTVByGenre, backdropUrl, posterUrl,
  getWatchProvidersFlatrate, getReleaseDateForRegion, userRegion,
  providerSearchUrl, getLatestSeasonAirDate,
  discoverPopularOnPlatforms, discoverUpcoming, getCinemaUpcomingRange,
  discoverWithFilters,
} from '@/lib/tmdb';
import FiltersSheet, { DEFAULT_FILTERS, countActiveFilters } from '@/components/FiltersSheet';
import { isInWatchlist, toggleWatchlist, subscribeWatchlist, getWatchlist } from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';
import Top10Sections from '@/components/Top10Sections';

// ─── Cinematic toast notification ────────────────────────────────────────────
// msg: { title, sub, type: 'add'|'remove' }  OR  null to hide
function MiniToast({ msg }) {
  const visible = !!msg;
  const isAdd   = msg?.type !== 'remove';
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 22}px)`,
      zIndex: 2147483647, pointerEvents: 'none',
      background: 'linear-gradient(135deg, rgba(22,12,46,0.97) 0%, rgba(12,6,28,0.97) 100%)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${isAdd ? 'rgba(255,59,107,0.4)' : 'rgba(255,255,255,0.12)'}`,
      borderRadius: 20, padding: '11px 16px 11px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.28s cubic-bezier(0.2,0.8,0.3,1), transform 0.28s cubic-bezier(0.2,0.8,0.3,1)',
      boxShadow: isAdd
        ? '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,59,107,0.12), 0 4px 20px rgba(255,59,107,0.2)'
        : '0 16px 48px rgba(0,0,0,0.6)',
      minWidth: 220, maxWidth: 320,
    }}>
      {/* Icon badge */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: isAdd
          ? 'linear-gradient(135deg, #FF6B4A, #FF3B6B)'
          : 'rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isAdd ? '0 4px 14px rgba(255,59,107,0.45)' : 'none',
      }}>
        {isAdd ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {/* Text */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#fff',
          fontFamily: '"Space Grotesk", system-ui', letterSpacing: -0.1,
        }}>{msg?.title || ''}</div>
        {msg?.sub && (
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1,
            fontFamily: '"Space Grotesk", system-ui',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 200,
          }}>{msg.sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Release-date helpers (cartelera) ────────────────────────────────────────
const RELEASE_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Returns { kind: 'upcoming'|'released'|'unknown', date: Date|null, label: string, hasDate }.
// `regionDate` (per-region YYYY-MM-DD) is preferred; falls back to movie.release_date.
// kind === 'unknown' means upcoming with no known date — render just "Próximamente".
function getReleaseInfo(movie, regionDate) {
  const raw = regionDate || movie?.release_date || movie?.first_air_date || '';
  if (!raw) return { kind: 'unknown', date: null, label: '', hasDate: false };
  const [y, m, day] = raw.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return { kind: 'unknown', date: null, label: '', hasDate: false };
  const release = new Date(y, m - 1, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dateLabel = RELEASE_FMT.format(release);
  if (release > today) return { kind: 'upcoming', date: release, label: dateLabel, hasDate: true };
  return { kind: 'released', date: release, label: dateLabel, hasDate: true };
}

// Two-line green pill for unreleased movies. First line "Próximamente",
// second line the exact date when known. Stacks tightly so it fits
// inside grid cards without overflow.
function UpcomingBadge({ label, hasDate, compact = false }) {
  // Compact = grid card. Two narrow columns on phones leave very little
  // horizontal room, so we render a single column with a short "Próx."
  // prefix and the date below. Non-compact keeps the wider two-line layout.
  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 8px', borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(78,255,170,0.22), rgba(78,255,170,0.10))',
        border: '1px solid rgba(78,255,170,0.55)',
        color: '#5BFFB0',
        boxShadow: '0 3px 10px rgba(78,255,170,0.16)',
        width: '100%', boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="#5BFFB0" strokeWidth="2"/>
          <path d="M3 9h18M8 3v4M16 3v4" stroke="#5BFFB0" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.15 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Próximamente
          </div>
          {hasDate && (
            <div style={{
              fontSize: 9.5, fontWeight: 700, marginTop: 1,
              color: 'rgba(91,255,176,0.85)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{label}</div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 12px', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(78,255,170,0.22), rgba(78,255,170,0.10))',
      border: '1px solid rgba(78,255,170,0.55)',
      color: '#5BFFB0',
      boxShadow: '0 4px 14px rgba(78,255,170,0.18)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="#5BFFB0" strokeWidth="2"/>
        <path d="M3 9h18M8 3v4M16 3v4" stroke="#5BFFB0" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, lineHeight: 1.1 }}>
        <span style={{
          fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>Próximamente</span>
        {hasDate && (
          <span style={{
            fontSize: 11, fontWeight: 700, marginTop: 2,
            color: 'rgba(91,255,176,0.85)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{label}</span>
        )}
      </div>
    </div>
  );
}

// Compact muted date label for already-released movies on cartelera.
function ReleasedDate({ label, small = false }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: small ? 10 : 11, color: 'rgba(255,255,255,0.55)',
      fontFamily: '"Space Grotesk", system-ui',
      fontWeight: 600,
    }}>
      <svg width={small ? 10 : 11} height={small ? 10 : 11} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.55)" strokeWidth="2"/>
        <path d="M3 9h18" stroke="rgba(255,255,255,0.55)" strokeWidth="2"/>
      </svg>
      Estrenada · {label}
    </div>
  );
}

// Sample the brightness of the bottom-left corner of a poster image so
// the "En cines" badge can flip to a high-contrast variant on light
// backgrounds (e.g. white posters). TMDB images allow CORS via crossOrigin.
function usePosterTone(src) {
  const [tone, setTone] = useState('dark');
  useEffect(() => {
    if (!src) { setTone('dark'); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d');
        // Sample bottom-left ~25% of the poster (where the badge sits).
        const sx = 0;
        const sy = Math.floor(img.height * 0.75);
        const sw = Math.floor(img.width * 0.45);
        const sh = Math.floor(img.height * 0.25);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
        setTone(sum / n > 165 ? 'light' : 'dark');
      } catch { /* CORS / decode error → keep default */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return tone;
}

// Neutral "platform not yet confirmed" pill for upcoming movies/series in
// the digital tabs where the streamer hasn't been announced. Stays distinct
// from "En cines" so series — which never go to cinemas — never get
// mislabelled as theatrical.
function UnconfirmedPlatformBadge({ compact = false }) {
  // Compact = grid card. Stack on two lines so "Plataforma / no confirmada"
  // never overflows on phones.
  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 10,
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M9 9.5a3 3 0 116 0c0 1.5-1.5 2-2 3M12 17v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase' }}>Plataforma</div>
          <div style={{ fontSize: 8.5, fontWeight: 700, opacity: 0.85 }}>no confirmada</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.18)',
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      whiteSpace: 'nowrap',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M9 9.5a3 3 0 116 0c0 1.5-1.5 2-2 3M12 17v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      Plataforma no confirmada
    </div>
  );
}

// "En cines" pill rendered in the providers row for cartelera items
// without any streaming platform yet. Adapts to poster brightness:
// dark posters → orange tinted glass; light posters → solid black with
// white text so it stays legible.
function InCinemasBadge({ tone = 'dark', compact = false }) {
  const isLight = tone === 'light';
  const bg = isLight ? '#0A0A0A' : 'rgba(255,107,74,0.20)';
  const border = isLight ? '#0A0A0A' : 'rgba(255,107,74,0.55)';
  const color = isLight ? '#fff' : '#FFB199';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: compact ? '3px 8px' : '4px 10px', borderRadius: 999,
      background: bg,
      border: `1px solid ${border}`,
      color,
      fontSize: compact ? 10 : 11, fontWeight: 800, letterSpacing: 0.2,
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
      whiteSpace: 'nowrap',
    }}>
      <svg width={compact ? 11 : 12} height={compact ? 11 : 12} viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16v16H4z M4 9h16 M4 15h16 M9 4v16 M15 4v16" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      En cines
    </div>
  );
}

// ─── Provider badges (logos overlay) ─────────────────────────────────────────
// Module-level cache so each tab change doesn't refetch the same items.
const PROVIDERS_CACHE = new Map(); // key: `${mediaType}:${id}` -> flatrate[]
const RELEASE_CACHE = new Map();   // key: `${region}:${id}` -> 'YYYY-MM-DD' | null

function ProviderBadges({ providers, title, max = 3, size = 22 }) {
  if (!providers || providers.length === 0) return null;
  const list = providers.slice(0, max);
  const stop = (e) => { e.stopPropagation(); }; // don't open the DetailSheet
  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'center',
      padding: '3px 6px', borderRadius: 999,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}>
      {list.map(p => {
        const href = providerSearchUrl(p.provider_name, title);
        const img = (
          <img
            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
            alt={p.provider_name}
            style={{
              width: size, height: size, borderRadius: 6,
              objectFit: 'cover', display: 'block',
            }}
          />
        );
        return href ? (
          <a
            key={p.provider_id}
            href={href}
            target="_blank" rel="noreferrer"
            onClick={stop} onTouchEnd={stop}
            title={`Ver "${title || ''}" en ${p.provider_name}`}
            style={{ display: 'block', lineHeight: 0 }}
          >{img}</a>
        ) : (
          <div key={p.provider_id} title={p.provider_name} style={{ display: 'block', lineHeight: 0 }}>{img}</div>
        );
      })}
      {providers.length > max && (
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)',
          paddingLeft: 2, paddingRight: 2,
        }}>+{providers.length - max}</span>
      )}
    </div>
  );
}

// ─── Heart button ─────────────────────────────────────────────────────────────
let _setGlobalToast = null; // module-level setter so HeartBtn can trigger it

function HeartBtn({ movie, style = {} }) {
  const [saved, setSaved] = useState(() => isInWatchlist(movie.id));

  useEffect(() => {
    setSaved(isInWatchlist(movie.id));
    const unsub = subscribeWatchlist(() => setSaved(isInWatchlist(movie.id)));
    return unsub;
  }, [movie.id]);

  const toggle = (e) => {
    e.stopPropagation();
    const added = toggleWatchlist(movie);
    setSaved(added);
    if (_setGlobalToast) {
      const name = movie.title || movie.name || 'Película';
      _setGlobalToast(added
        ? { type: 'add',    title: 'Añadida a tu Watchlist', sub: name }
        : { type: 'remove', title: 'Eliminada de tu lista',  sub: name }
      );
      setTimeout(() => _setGlobalToast(null), 2400);
    }
  };

  return (
    <button
      onClick={toggle}
      onTouchEnd={e => {
        // Prevent the touch from also firing a click (double-toggle bug on mobile)
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.transform = 'scale(1)';
        toggle(e);
      }}
      onTouchStart={e => { e.stopPropagation(); e.currentTarget.style.transform = 'scale(0.88)'; }}
      onMouseDown={e => { e.stopPropagation(); e.currentTarget.style.transform = 'scale(0.88)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      style={{
        width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: saved ? 'rgba(255,59,107,0.25)' : 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.18s, transform 0.14s',
        ...style,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24"
        fill={saved ? '#FF3B6B' : 'none'}
        stroke={saved ? '#FF3B6B' : 'rgba(255,255,255,0.9)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>
      </svg>
    </button>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'movies',     label: '🎬 Películas' },
  { key: 'series',     label: '📺 Series'    },
  { key: 'cartelera',  label: '🎭 Cartelera' },
];

// ─── Mood filters ─────────────────────────────────────────────────────────────
const MOODS = [
  { label: 'Todo',          ids: [],    tvIds: []     },
  { label: '😂 Comedia',    ids: [35],  tvIds: [35]   },
  { label: '💥 Acción',     ids: [28],  tvIds: [10759]},
  { label: '😱 Terror',     ids: [27],  tvIds: [27]   },
  { label: '💕 Romance',    ids: [10749],tvIds:[10749] },
  { label: '🔮 Sci-Fi',     ids: [878], tvIds: [10765]},
  { label: '🔍 Thriller',   ids: [53],  tvIds: [53]   },
  { label: '🎭 Drama',      ids: [18],  tvIds: [18]   },
  { label: '🎪 Animación',  ids: [16],  tvIds: [16]   },
];

// ─── Rank medal colours ───────────────────────────────────────────────────────
const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function TrendingScreen() {
  const navigate = useNavigate();
  const [tab, setTab]       = useState('movies');
  const [subtab, setSubtab] = useState('top10'); // 'top10' | 'released' | 'upcoming'
  const [mood, setMood]     = useState(0);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [selectedSaved, setSelectedSaved] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = countActiveFilters(filters);
  const [providersById, setProvidersById] = useState({});
  const [releaseById, setReleaseById] = useState({});
  // IDs flagged by TMDB as digital-only releases — we keep them in
  // Películas/Próximamente even before /watch/providers populates.
  const [digitalIds, setDigitalIds] = useState(new Set());
  const region = userRegion();
  const moodScrollRef = useRef(null);

  // Register global toast setter so HeartBtn can call it
  useEffect(() => {
    _setGlobalToast = setToastMsg;
    return () => { _setGlobalToast = null; };
  }, []);

  // Reactive watchlist state for the DetailSheet button
  useEffect(() => {
    if (!selected) return;
    setSelectedSaved(isInWatchlist(selected.id));
    const unsub = subscribeWatchlist(() => setSelectedSaved(isInWatchlist(selected.id)));
    return unsub;
  }, [selected]);

  // ── data loader ─────────────────────────────────────────────────────────────
  const load = useCallback(async (currentTab, moodIdx, currentSubtab, currentFilters) => {
    setLoading(true);
    setItems([]);
    try {
      const m = MOODS[moodIdx];
      let results = [];

      // ── Filters override ────────────────────────────────────────────────
      // When the user has set any advanced filter, route through the
      // generic discoverWithFilters endpoint and let the server-side
      // params do the heavy lifting. Date boundary keeps subtab semantics
      // (released vs upcoming).
      if (countActiveFilters(currentFilters) > 0) {
        const mediaType = currentTab === 'series' ? 'tv' : 'movie';
        const today = new Date();
        const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const yearEnd = `${today.getFullYear()}-12-31`;
        // Cartelera scopes upcoming to year-end and released to recent past;
        // movies/series tabs use whole-history boundaries either side.
        const dateBoundary = currentTab === 'cartelera'
          ? (currentSubtab === 'upcoming' ? { gte: ymd, lte: yearEnd } : { lte: ymd })
          : (currentSubtab === 'upcoming' ? { gte: ymd } : { lte: ymd });
        const pages = await Promise.all([1,2,3,4,5].map(p =>
          discoverWithFilters({
            mediaType, page: p,
            genres: currentFilters.genres,
            yearFrom: currentFilters.yearFrom,
            yearTo: currentFilters.yearTo,
            language: currentFilters.language,
            minRating: currentFilters.minRating,
            platformId: currentFilters.platformId,
            sortBy: currentFilters.sortBy,
            dateBoundary,
            cinemaOnly: currentTab === 'cartelera',
          }).catch(() => [])
        ));
        results = pages.flat();
        // dedupe + overview filter happens below
        const seen = new Set();
        const out = [];
        for (const x of results) {
          if (seen.has(x.id)) continue;
          if (!(x.overview && x.overview.trim().length > 10)) continue;
          seen.add(x.id);
          out.push(x);
        }
        setItems(out);
        return;
      }

      if (currentTab === 'cartelera') {
        // Cartelera/Próximamente: cinema releases from today through
        // the end of the current calendar year. Pull enough pages to
        // cap at 70 after filtering out anything streaming-bound.
        const today = new Date();
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const fromDate = ymd(today);
        const toDate = `${today.getFullYear()}-12-31`;
        const np = await Promise.all([1,2].map(p => getNowPlaying({ page: p }).catch(() => [])));
        const up = await Promise.all([1,2,3,4,5,6].map(p =>
          getCinemaUpcomingRange({ page: p, fromDate, toDate }).catch(() => [])
        ));
        results = [...np.flat(), ...up.flat()];
      } else if (currentTab === 'movies' || currentTab === 'series') {
        const mediaType = currentTab === 'series' ? 'tv' : 'movie';
        const genreIds = currentTab === 'series' ? m.tvIds : m.ids;
        // Películas: fetch digital-only AND general upcoming to get
        // enough volume; we'll later trust /watch/providers to drop
        // cinema-only stragglers from the general feed.
        const wantDigitalSet = currentTab === 'movies';
        const popularPromises = [1,2,3,4].map(p => discoverPopularOnPlatforms({ mediaType, genreIds, page: p }).catch(() => []));
        const upcomingPromises = [1,2,3,4,5].map(p => discoverUpcoming({ mediaType, genreIds, page: p }).catch(() => []));
        const digitalUpcomingPromises = wantDigitalSet
          ? [1,2,3].map(p => discoverUpcoming({ mediaType, genreIds, digitalOnly: true, page: p }).catch(() => []))
          : [];
        const [popPages, upPages, digitalPages] = await Promise.all([
          Promise.all(popularPromises),
          Promise.all(upcomingPromises),
          Promise.all(digitalUpcomingPromises),
        ]);
        const digitalSet = new Set();
        for (const arr of digitalPages) for (const m of arr) digitalSet.add(m.id);
        setDigitalIds(digitalSet);
        results = [
          ...popPages.flat(),
          ...upPages.flat(),
          ...digitalPages.flat(),
        ];
      }

      // Dedupe by id and require a non-empty Spanish overview so every
      // card in trending has a synopsis. Items without overview are
      // dropped here — TMDB occasionally returns ones with empty
      // localized text for very fresh announcements.
      const seen = new Set();
      const deduped = [];
      for (const x of results) {
        if (seen.has(x.id)) continue;
        if (!(x.overview && x.overview.trim().length > 10)) continue;
        seen.add(x.id);
        deduped.push(x);
      }
      setItems(deduped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab, mood, subtab, filters); }, [tab, mood, subtab, filters, load]);

  // Fetch watch providers in parallel for the visible items.
  // Cached per (mediaType, id) so tab/mood toggles are instant on revisit.
  useEffect(() => {
    if (!items.length) return;
    const mediaType = tab === 'series' ? 'tv' : 'movie';
    let cancel = false;

    const next = {};
    const toFetch = [];
    for (const m of items) {
      const key = `${mediaType}:${m.id}`;
      if (PROVIDERS_CACHE.has(key)) {
        next[m.id] = PROVIDERS_CACHE.get(key);
      } else {
        toFetch.push(m);
      }
    }
    if (Object.keys(next).length) setProvidersById(prev => ({ ...prev, ...next }));

    if (toFetch.length === 0) return;

    (async () => {
      // Throttle: 6 in flight at a time.
      const queue = [...toFetch];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length && !cancel) {
          const m = queue.shift();
          const list = await getWatchProvidersFlatrate(m.id, mediaType);
          PROVIDERS_CACHE.set(`${mediaType}:${m.id}`, list);
          if (!cancel) {
            setProvidersById(prev => ({ ...prev, [m.id]: list }));
          }
        }
      });
      await Promise.all(workers);
    })();

    return () => { cancel = true; };
  }, [items, tab]);

  // Fetch region-specific release dates (movies/cartelera) or latest-season
  // air date (series) for the visible items. Both flows share the
  // `releaseById` state and `RELEASE_CACHE` keyed by mediaType+region+id.
  useEffect(() => {
    if (!items.length) return;
    const isTV = tab === 'series';
    const cacheKey = (id) => isTV ? `tv:${id}` : `${region}:${id}`;
    let cancel = false;

    const next = {};
    const toFetch = [];
    for (const m of items) {
      const key = cacheKey(m.id);
      if (RELEASE_CACHE.has(key)) {
        next[m.id] = RELEASE_CACHE.get(key);
      } else {
        toFetch.push(m);
      }
    }
    if (Object.keys(next).length) setReleaseById(prev => ({ ...prev, ...next }));
    if (toFetch.length === 0) return;

    (async () => {
      const queue = [...toFetch];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length && !cancel) {
          const m = queue.shift();
          const d = isTV
            ? await getLatestSeasonAirDate(m.id)
            : await getReleaseDateForRegion(m.id, region);
          RELEASE_CACHE.set(cacheKey(m.id), d);
          if (!cancel) setReleaseById(prev => ({ ...prev, [m.id]: d }));
        }
      });
      await Promise.all(workers);
    })();

    return () => { cancel = true; };
  }, [items, tab, region]);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const open = (movie) => setSelected(movie);
  const close = () => setSelected(null);

  // Split items by release status (using region/last-season date) and, for
  // the Películas tab, hide cinema-only titles — those without any digital
  // platform once their providers fetch has resolved. This keeps Películas
  // strictly as "available on streaming" and pushes theatrical-only titles
  // to the Cartelera tab.
  const filteredItems = React.useMemo(() => {
    const split = items.filter(m => {
      const info = getReleaseInfo(m, releaseById[m.id]);
      const isUpcoming = info.kind === 'upcoming' || info.kind === 'unknown';
      if ((subtab === 'upcoming') !== isUpcoming) return false;
      if ((tab === 'movies' || tab === 'series') && subtab === 'released') {
        const provs = providersById[m.id];
        if (provs !== undefined && provs.length === 0) return false;
      }
      if (tab === 'movies' && subtab === 'upcoming') {
        // Drop cinema-only films: keep an item only if TMDB tagged it as
        // digital-only OR /watch/providers came back with a platform.
        // Items still loading providers stay until resolved.
        const provs = providersById[m.id];
        const isDigital = digitalIds.has(m.id);
        if (!isDigital && provs !== undefined && provs.length === 0) return false;
      }
      if (tab === 'cartelera' && subtab === 'upcoming') {
        // Cartelera/Próximamente is strictly cinema. Drop films that
        // already have a streaming flatrate registered — those will
        // premiere on a digital platform, not in theatres.
        const provs = providersById[m.id];
        if (provs && provs.length > 0) return false;
      }
      if (tab === 'cartelera' && subtab === 'released') {
        // Cartelera/En cines: solo películas EN cartel, NO las que ya están
        // en plataformas. Aunque TMDB filtra flatrate, a veces se cuelan
        // títulos con doble distribución simultánea (cine + streaming).
        // Si el endpoint /watch/providers devuelve plataformas, está en
        // streaming → fuera de "En cines".
        const provs = providersById[m.id];
        if (provs && provs.length > 0) return false;
      }
      return true;
    });
    if (subtab === 'upcoming') {
      // Two-tier ranking: titles with enough early reviews go on top sorted
      // by critic score; the rest follow ranked by popularity so we can
      // always reach 50 even when few upcomings have ratings yet.
      const rated = split.filter(m => (m.vote_count || 0) >= 5);
      const unrated = split.filter(m => (m.vote_count || 0) < 5);
      rated.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)
        || (b.popularity || 0) - (a.popularity || 0));
      unrated.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      // Cartelera/Próximamente: top 70 cinema releases.
      const cap = tab === 'cartelera' ? 70 : 50;
      return [...rated, ...unrated].slice(0, cap);
    }
    return split.slice(0, 70);
  }, [items, releaseById, providersById, digitalIds, subtab, tab]);

  const [hero, podium, grid] = filteredItems.length
    ? [filteredItems[0], filteredItems.slice(1, 3), filteredItems.slice(3)]
    : [null, [], []];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={220} />

      {/* ── top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')} />
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Tendencias</div>
        <div style={{ width: 42 }} />
      </div>

      {/* ── scrollable body ─────────────────────────────────────────────────── */}
      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        maxWidth: 520, width: '100%', margin: '0 auto',
      }}>

        {/* Title */}
        <div style={{ padding: '0 24px 0' }}>
          <h1 style={{
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
            fontSize: 32, fontWeight: 800, color: FP.text,
            margin: '0 0 4px', letterSpacing: -1,
          }}>Tendencias</h1>
          <p style={{ fontSize: 13, color: FP.textDim, margin: '0 0 20px' }}>
            Lo que todo el mundo está viendo ahora
          </p>
        </div>

        {/* ── tabs ──────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, padding: '0 24px 18px',
          overflowX: 'auto',
        }} className="no-scrollbar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setMood(0); setSubtab('top10'); setFilters(DEFAULT_FILTERS); }}
              style={{
                flexShrink: 0, padding: '8px 18px', borderRadius: 999,
                fontFamily: '"Space Grotesk", system-ui',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.18s',
                background: tab === t.key
                  ? FP.flame
                  : 'rgba(255,255,255,0.06)',
                border: tab === t.key
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                boxShadow: tab === t.key ? '0 4px 18px rgba(255,59,107,0.35)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── sub-tab segmented control + filters button ─────────────────── */}
        <div style={{
          display: 'flex', gap: 8, padding: '0 24px 16px',
          alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'inline-flex', padding: 4, borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {[
              { key: 'top10',    label: 'Top 10' },
              { key: 'released', label: tab === 'cartelera' ? 'En cines' : 'Estrenadas' },
              { key: 'upcoming', label: 'Próximamente' },
            ].map(s => {
              const active = subtab === s.key;
              const isTop10 = s.key === 'top10';
              const isUpcoming = s.key === 'upcoming';
              return (
                <button key={s.key} onClick={() => setSubtab(s.key)} style={{
                  padding: '7px 14px', borderRadius: 999, border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12,
                  fontFamily: '"Space Grotesk", system-ui',
                  letterSpacing: 0.3,
                  background: active
                    ? (isUpcoming
                        ? 'linear-gradient(135deg, rgba(78,255,170,0.30), rgba(78,255,170,0.15))'
                      : isTop10
                        ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.20))'
                        : 'rgba(255,255,255,0.10)')
                    : 'transparent',
                  color: active
                    ? (isUpcoming ? '#5BFFB0' : '#fff')
                    : FP.textDim,
                  border: active && isUpcoming
                    ? '1px solid rgba(78,255,170,0.55)'
                    : (active && isTop10
                        ? '1px solid rgba(255,107,74,0.55)'
                        : 'none'),
                  transition: 'background 0.15s, color 0.15s',
                }}>{s.label}</button>
              );
            })}
          </div>
          {subtab !== 'top10' && (
            <button onClick={() => setFiltersOpen(true)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              background: filterCount > 0
                ? 'linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,59,107,0.20))'
                : 'rgba(255,255,255,0.06)',
              border: filterCount > 0
                ? '1px solid rgba(255,107,74,0.55)'
                : '1px solid rgba(255,255,255,0.10)',
              color: filterCount > 0 ? '#fff' : FP.textDim,
              fontFamily: '"Space Grotesk", system-ui',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Filtros{filterCount > 0 ? ` · ${filterCount}` : ''}
            </button>
          )}
          {/* end filters button */}
        </div>

        {/* ── mood pills (not on cartelera, not on Top 10 — irrelevant ahí) ─── */}
        {tab !== 'cartelera' && subtab !== 'top10' && (
          <div ref={moodScrollRef}
            className="no-scrollbar"
            style={{
              display: 'flex', gap: 8, padding: '0 24px 22px',
              overflowX: 'auto',
            }}>
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => setMood(i)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 999,
                  fontFamily: '"Space Grotesk", system-ui',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: mood === i
                    ? 'rgba(78,255,214,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: mood === i
                    ? '1px solid rgba(78,255,214,0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: mood === i ? '#4EFFD6' : FP.textDim,
                }}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Top 10 por plataforma — su propio subtab, predeterminado ─────── */}
        {subtab === 'top10' && (
          <Top10Sections tab={tab} onOpenItem={open}/>
        )}

        {/* ── loading skeleton (solo en estrenadas / próximamente) ──────────── */}
        {subtab !== 'top10' && loading && (
          <div style={{ padding: '0 24px 40px' }}>
            <SkeletonHero />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <SkeletonCard /><SkeletonCard />
              <SkeletonCard /><SkeletonCard />
            </div>
          </div>
        )}

        {/* ── content ───────────────────────────────────────────────────────── */}
        {subtab !== 'top10' && !loading && items.length > 0 && (
          <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* #1 Hero */}
            {hero && <HeroCard movie={hero} providers={providersById[hero.id]} regionDate={releaseById[hero.id]} cartelera={tab === 'cartelera'} onClick={() => open(hero)} />}

            {/* #2 and #3 podium */}
            {podium.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {podium.map((m, i) => (
                  <PodiumCard key={m.id} movie={m} rank={i + 2} providers={providersById[m.id]} regionDate={releaseById[m.id]} cartelera={tab === 'cartelera'} onClick={() => open(m)} />
                ))}
              </div>
            )}

            {/* Section header */}
            {grid.length > 0 && (
              <div style={{
                fontSize: 11, fontWeight: 700, color: FP.textMuted,
                letterSpacing: 2, textTransform: 'uppercase', marginTop: 4,
              }}>
                Más tendencias
              </div>
            )}

            {/* Grid */}
            {grid.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {grid.map((m, i) => (
                  <GridCard key={m.id} movie={m} rank={i + 4} providers={providersById[m.id]} regionDate={releaseById[m.id]} cartelera={tab === 'cartelera'} onClick={() => open(m)} />
                ))}
              </div>
            )}
          </div>
        )}

        {subtab !== 'top10' && !loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: FP.textDim }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎞️</div>
            <div>Sin resultados para este filtro</div>
          </div>
        )}
      </div>

      {/* ── detail sheet ────────────────────────────────────────────────────── */}
      {selected && (
        <DetailSheet
          movie={selected}
          mediaType={tab === 'series' ? 'tv' : 'movie'}
          cartelera={tab === 'cartelera'}
          onClose={close}
          onSkip={close}
          skipLabel="Cerrar"
          likeLabel={selectedSaved ? 'Quitar de mi lista' : 'Guardar'}
          onLike={() => {
            const added = toggleWatchlist(selected);
            const name = selected.title || selected.name;
            if (_setGlobalToast) {
              _setGlobalToast(added
                ? { type: 'add',    title: 'Añadida a tu Watchlist', sub: name }
                : { type: 'remove', title: 'Eliminada de tu lista',  sub: name }
              );
              setTimeout(() => _setGlobalToast(null), 2400);
            }
            close();
          }}
        />
      )}

      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        tab={tab}
        filters={filters}
        onApply={(next) => setFilters(next)}
      />

      <MiniToast msg={toastMsg} />
    </div>
  );
}

// ─── Hero card (#1) ───────────────────────────────────────────────────────────
function HeroCard({ movie, providers, cartelera, regionDate, onClick }) {
  const release = getReleaseInfo(movie, regionDate);
  const hasProviders = providers && providers.length > 0;
  const cinemaTone = 'dark';
  const title = movie.title || movie.name;
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const bg = backdropUrl(movie.backdrop_path, 'w780')
    || posterUrl(movie.poster_path, 'w780');

  return (
    <div onClick={onClick} style={{
      position: 'relative', borderRadius: 24, overflow: 'hidden',
      height: 260, cursor: 'pointer',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      transition: 'transform 0.14s',
    }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* backdrop */}
      {bg && (
        <img src={bg} alt={title} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
        }} />
      )}

      {/* gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.95) 100%)',
      }} />

      {/* #1 badge */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          background: MEDAL[0],
          borderRadius: 999, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900, color: '#000',
          boxShadow: `0 4px 16px rgba(255,215,0,0.5)`,
        }}>#1</div>
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(255,215,0,0.15)',
          border: '1px solid rgba(255,215,0,0.4)',
          fontSize: 11, fontWeight: 700, color: '#FFD700',
          letterSpacing: 0.5,
        }}>Más popular</div>
      </div>

      {/* top-right: rating + heart */}
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 7, alignItems: 'center' }}>
        {rating && (
          <div style={{
            padding: '5px 10px', borderRadius: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            fontSize: 13, fontWeight: 800, color: '#FFD700',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>★</span>{rating}
          </div>
        )}
        <HeartBtn movie={movie} />
      </div>

      {/* title area */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 18px 20px',
      }}>
        <h2 style={{
          fontFamily: '"Inter", "Space Grotesk", sans-serif',
          fontSize: 24, fontWeight: 800, color: '#fff',
          margin: '0 0 6px', letterSpacing: -0.5, lineHeight: 1.1,
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}>{title}</h2>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          fontSize: 13, color: 'rgba(255,255,255,0.65)',
        }}>
          {!release.hasDate && year && <span>{year}</span>}
          {movie.overview && (
            <span style={{
              display: '-webkit-box', WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              flex: 1,
            }}>{movie.overview}</span>
          )}
        </div>
        {/* Providers row (or "En cines" fallback for cartelera) */}
        {(hasProviders || (cartelera && (release.kind === 'released' || release.kind !== 'released')) || (!cartelera && release.kind !== 'released')) && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {hasProviders && <ProviderBadges providers={providers} title={title} max={4} size={26} />}
            {!hasProviders && cartelera && <InCinemasBadge tone={cinemaTone} />}
            {!hasProviders && !cartelera && release.kind !== 'released' && <UnconfirmedPlatformBadge />}
          </div>
        )}
        {/* Release date row — prominent green if upcoming, muted if released */}
        {release.kind !== 'released' && (
          <div style={{ marginTop: 10 }}>
            <UpcomingBadge label={release.label} hasDate={release.hasDate} />
          </div>
        )}
        {release.kind === 'released' && release.hasDate && (
          <div style={{ marginTop: 8 }}>
            <ReleasedDate label={release.label} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Podium cards (#2, #3) ────────────────────────────────────────────────────
function PodiumCard({ movie, rank, providers, cartelera, regionDate, onClick }) {
  const release = getReleaseInfo(movie, regionDate);
  const hasProviders = providers && providers.length > 0;
  const poster = posterUrl(movie.poster_path, 'w342');
  // Cinema badge applies *only* on the Cartelera tab. Movies/series
  // without a confirmed platform on their own tabs get the neutral
  // "Plataforma no confirmada" tag instead.
  const showCinemaBadge = !hasProviders && cartelera;
  const showUnconfirmedBadge = !hasProviders && !cartelera && release.kind !== 'released';
  const cinemaTone = usePosterTone(showCinemaBadge ? poster : null);
  const title = movie.title || movie.name;
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;

  return (
    <div onClick={onClick} style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      cursor: 'pointer',
      transition: 'transform 0.14s',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ position: 'relative', aspectRatio: '2/3' }}>
        {poster
          ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)' }} />
        }
        {/* rank */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          width: 30, height: 30, borderRadius: 999,
          background: MEDAL[rank - 1] || 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900,
          color: rank <= 3 ? '#000' : '#fff',
          boxShadow: `0 2px 10px rgba(0,0,0,0.5)`,
        }}>#{rank}</div>
        {/* top-right: rating + heart */}
        <div style={{ position: 'absolute', top: 7, right: 7, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          {rating && (
            <div style={{
              padding: '3px 7px', borderRadius: 999,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
              fontSize: 11, fontWeight: 700, color: '#FFD700',
            }}>★ {rating}</div>
          )}
          <HeartBtn movie={movie} style={{ width: 28, height: 28 }} />
        </div>
        {(hasProviders || showCinemaBadge || showUnconfirmedBadge) && (
          <div style={{ position: 'absolute', bottom: 7, left: 7 }}>
            {hasProviders ? (
              <ProviderBadges providers={providers} title={title} max={3} size={20} />
            ) : showCinemaBadge ? (
              <InCinemasBadge tone={cinemaTone} />
            ) : (
              <UnconfirmedPlatformBadge compact />
            )}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 11px 12px' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 13, fontWeight: 700, color: FP.text,
          lineHeight: 1.2, marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{title}</div>
        {release.kind !== 'released' ? (
          <UpcomingBadge label={release.label} hasDate={release.hasDate} compact />
        ) : release.hasDate ? (
          <ReleasedDate label={release.label} />
        ) : year ? (
          <div style={{ fontSize: 11, color: FP.textMuted }}>{year}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Grid cards (#4+) ─────────────────────────────────────────────────────────
function GridCard({ movie, rank, providers, cartelera, regionDate, onClick }) {
  const release = getReleaseInfo(movie, regionDate);
  const hasProviders = providers && providers.length > 0;
  const gridPoster = posterUrl(movie.poster_path, 'w342');
  const showCinemaBadge = !hasProviders && cartelera;
  const showUnconfirmedBadge = !hasProviders && !cartelera && release.kind !== 'released';
  const cinemaTone = usePosterTone(showCinemaBadge ? gridPoster : null);
  const title = movie.title || movie.name;
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const poster = posterUrl(movie.poster_path, 'w342');

  return (
    <div onClick={onClick} style={{
      borderRadius: 18, overflow: 'hidden',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      cursor: 'pointer',
      transition: 'transform 0.14s',
    }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ position: 'relative', aspectRatio: '2/3' }}>
        {poster
          ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)' }} />
        }
        <div style={{
          position: 'absolute', top: 7, left: 7,
          padding: '2px 7px', borderRadius: 999,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
          fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
        }}>#{rank}</div>
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {rating && (
            <div style={{
              padding: '2px 6px', borderRadius: 999,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
              fontSize: 10, fontWeight: 700, color: '#FFD700',
            }}>★ {rating}</div>
          )}
          <HeartBtn movie={movie} style={{ width: 26, height: 26 }} />
        </div>
        {(hasProviders || showCinemaBadge || showUnconfirmedBadge) && (
          <div style={{ position: 'absolute', bottom: 6, left: 6 }}>
            {hasProviders ? (
              <ProviderBadges providers={providers} title={title} max={3} size={18} />
            ) : showCinemaBadge ? (
              <InCinemasBadge tone={cinemaTone} compact />
            ) : (
              <UnconfirmedPlatformBadge compact />
            )}
          </div>
        )}
      </div>
      <div style={{ padding: '9px 10px 11px' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 12, fontWeight: 700, color: FP.text,
          lineHeight: 1.2, marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{title}</div>
        {release.kind !== 'released' ? (
          <UpcomingBadge label={release.label} hasDate={release.hasDate} compact />
        ) : release.hasDate ? (
          <ReleasedDate label={release.label} small />
        ) : year ? (
          <div style={{ fontSize: 10, color: FP.textMuted }}>{year}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────
const shimmer = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'fp-shimmer 1.4s infinite',
};

function SkeletonHero() {
  return (
    <div style={{ borderRadius: 24, height: 260, ...shimmer }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '2/3', ...shimmer }} />
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 12, borderRadius: 6, width: '80%', ...shimmer }} />
        <div style={{ height: 10, borderRadius: 6, width: '40%', ...shimmer }} />
      </div>
    </div>
  );
}
