import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import {
  getTrending, getTrendingTV, getNowPlaying,
  getMoviesByGenre, getTVByGenre, backdropUrl, posterUrl,
} from '@/lib/tmdb';
import { isInWatchlist, toggleWatchlist, subscribeWatchlist } from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';

// ─── Tiny floating toast ──────────────────────────────────────────────────────
function MiniToast({ msg, visible }) {
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 999, pointerEvents: 'none',
      background: 'rgba(20,12,36,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 999, padding: '10px 20px',
      fontSize: 13, fontWeight: 700, color: '#fff',
      whiteSpace: 'nowrap',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.22s',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>{msg}</div>
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
      const title = movie.title || movie.name || 'Película';
      _setGlobalToast(added ? `❤️ Añadida: ${title}` : `🗑️ Eliminada de tu lista`);
      setTimeout(() => _setGlobalToast(null), 2000);
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
  { label: '🔥 Todo',       ids: [],    tvIds: []     },
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
  const [mood, setMood]     = useState(0);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const moodScrollRef = useRef(null);

  // Register global toast setter so HeartBtn can call it
  useEffect(() => {
    _setGlobalToast = setToastMsg;
    return () => { _setGlobalToast = null; };
  }, []);

  // ── data loader ─────────────────────────────────────────────────────────────
  const load = useCallback(async (currentTab, moodIdx) => {
    setLoading(true);
    setItems([]);
    try {
      const m = MOODS[moodIdx];
      let results = [];

      if (currentTab === 'cartelera') {
        const [p1, p2] = await Promise.all([
          getNowPlaying({ page: 1 }).catch(() => []),
          getNowPlaying({ page: 2 }).catch(() => []),
        ]);
        results = [...p1, ...p2];
      } else if (currentTab === 'movies') {
        const genreIds = m.ids;
        const [p1, p2] = await Promise.all([
          getMoviesByGenre({ genreIds, page: 1 }).catch(() => []),
          getMoviesByGenre({ genreIds, page: 2 }).catch(() => []),
        ]);
        results = [...p1, ...p2];
      } else {
        // series
        const genreIds = m.tvIds;
        const [p1, p2] = await Promise.all([
          getTVByGenre({ genreIds, page: 1 }).catch(() => []),
          getTVByGenre({ genreIds, page: 2 }).catch(() => []),
        ]);
        results = [...p1, ...p2];
      }

      // dedupe
      const seen = new Set();
      const deduped = [];
      for (const x of results) {
        if (!seen.has(x.id)) { seen.add(x.id); deduped.push(x); }
      }
      setItems(deduped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab, mood); }, [tab, mood, load]);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const open = (movie) => setSelected(movie);
  const close = () => setSelected(null);

  const [hero, podium, grid] = items.length
    ? [items[0], items.slice(1, 3), items.slice(3)]
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
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
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
            <button key={t.key} onClick={() => { setTab(t.key); setMood(0); }}
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

        {/* ── mood pills (not on cartelera) ──────────────────────────────────── */}
        {tab !== 'cartelera' && (
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

        {/* ── loading skeleton ──────────────────────────────────────────────── */}
        {loading && (
          <div style={{ padding: '0 24px 40px' }}>
            <SkeletonHero />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <SkeletonCard /><SkeletonCard />
              <SkeletonCard /><SkeletonCard />
            </div>
          </div>
        )}

        {/* ── content ───────────────────────────────────────────────────────── */}
        {!loading && items.length > 0 && (
          <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* #1 Hero */}
            {hero && <HeroCard movie={hero} onClick={() => open(hero)} />}

            {/* #2 and #3 podium */}
            {podium.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {podium.map((m, i) => (
                  <PodiumCard key={m.id} movie={m} rank={i + 2} onClick={() => open(m)} />
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
                  <GridCard key={m.id} movie={m} rank={i + 4} onClick={() => open(m)} />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && items.length === 0 && (
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
          onClose={close}
          onLike={close}
          onSkip={close}
        />
      )}

      <MiniToast msg={toastMsg || ''} visible={!!toastMsg} />
    </div>
  );
}

// ─── Hero card (#1) ───────────────────────────────────────────────────────────
function HeroCard({ movie, onClick }) {
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
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 24, fontWeight: 800, color: '#fff',
          margin: '0 0 6px', letterSpacing: -0.5, lineHeight: 1.1,
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}>{title}</h2>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          fontSize: 13, color: 'rgba(255,255,255,0.65)',
        }}>
          {year && <span>{year}</span>}
          {movie.overview && (
            <span style={{
              display: '-webkit-box', WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              flex: 1,
            }}>{movie.overview}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Podium cards (#2, #3) ────────────────────────────────────────────────────
function PodiumCard({ movie, rank, onClick }) {
  const title = movie.title || movie.name;
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const poster = posterUrl(movie.poster_path, 'w342');

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
      </div>
      <div style={{ padding: '10px 11px 12px' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 13, fontWeight: 700, color: FP.text,
          lineHeight: 1.2, marginBottom: 3,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{title}</div>
        {year && <div style={{ fontSize: 11, color: FP.textMuted }}>{year}</div>}
      </div>
    </div>
  );
}

// ─── Grid cards (#4+) ─────────────────────────────────────────────────────────
function GridCard({ movie, rank, onClick }) {
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
      </div>
      <div style={{ padding: '9px 10px 11px' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 12, fontWeight: 700, color: FP.text,
          lineHeight: 1.2, marginBottom: 2,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{title}</div>
        {year && <div style={{ fontSize: 10, color: FP.textMuted }}>{year}</div>}
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
