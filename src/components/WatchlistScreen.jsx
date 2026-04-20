import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { posterUrl, backdropUrl } from '@/lib/tmdb';
import {
  getWatchlist, getWatched,
  subscribeWatchlist, subscribeWatched,
  markWatched, unmarkWatched,
  removeFromWatchlist, removeWatched,
  isInWatchlist, toggleWatchlist,
} from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';

export default function WatchlistScreen() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState('want');   // 'want' | 'watched'
  const [wantTick, setWantTick]       = useState(0);
  const [watchedTick, setWatchedTick] = useState(0);
  const [selected, setSelected]       = useState(null);
  const [toastMsg, setToastMsg]       = useState(null);

  useEffect(() => {
    const u1 = subscribeWatchlist(() => setWantTick(t => t + 1));
    const u2 = subscribeWatched(()    => setWatchedTick(t => t + 1));
    return () => { u1(); u2(); };
  }, []);

  const wantList    = useMemo(() => getWatchlist(), [wantTick]);
  const watchedList = useMemo(() => getWatched(),   [watchedTick]);

  const showToast = (obj) => {
    setToastMsg(obj);
    setTimeout(() => setToastMsg(null), 2400);
  };

  const handleMarkWatched = (movie) => {
    markWatched(movie);
    showToast({ type: 'watched', title: '¡Ya la viste!', sub: movie.title || movie.name });
  };

  const handleUnmark = (movie) => {
    unmarkWatched(movie);
    showToast({ type: 'unmark', title: 'Movida a Quiero ver', sub: movie.title || movie.name });
  };

  const handleRemoveWant = (movieId) => {
    removeFromWatchlist(movieId);
    showToast({ type: 'remove', title: 'Eliminada de tu lista' });
  };

  const handleRemoveWatched = (movieId) => {
    removeWatched(movieId);
    showToast({ type: 'remove', title: 'Eliminada de Vistas' });
  };

  const list    = tab === 'want' ? wantList : watchedList;
  const isEmpty = list.length === 0;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={270} />

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')} />
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Mi lista</div>
        <div style={{ width: 42 }} />
      </div>

      {/* Content */}
      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '0 24px 48px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {/* Title */}
        <h1 style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 30, fontWeight: 800, color: FP.text, margin: '0 0 6px', letterSpacing: -0.8,
        }}>Mi lista</h1>
        <p style={{ fontSize: 13, color: FP.textDim, margin: '0 0 20px' }}>
          {wantList.length} por ver · {watchedList.length} vistas
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { key: 'want',    label: '🎬 Quiero ver', count: wantList.length    },
            { key: 'watched', label: '👁 Vistas',      count: watchedList.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 0', borderRadius: 999, cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              transition: 'all 0.18s',
              background: tab === t.key ? FP.flame : 'rgba(255,255,255,0.06)',
              border: tab === t.key ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              boxShadow: tab === t.key ? '0 4px 18px rgba(255,59,107,0.35)' : 'none',
            }}>
              {t.label} {t.count > 0 && <span style={{ opacity: 0.8, fontSize: 12 }}>({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div style={{
            marginTop: 30, textAlign: 'center', padding: '48px 24px', borderRadius: 24,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 52 }}>{tab === 'want' ? '🎬' : '👁'}</div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 18, color: FP.text }}>
              {tab === 'want' ? 'Tu lista está vacía' : 'Aún no has marcado nada como visto'}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: FP.textDim }}>
              {tab === 'want'
                ? 'Guarda películas desde Tendencias pulsando el corazón'
                : 'Pulsa "Ya la vi" en Quiero ver cuando hayas visto una peli'}
            </div>
            {tab === 'want' && (
              <button onClick={() => navigate('/trending')} style={{
                marginTop: 20, padding: '12px 24px', borderRadius: 999,
                background: FP.flame, border: 'none', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
              }}>Explorar tendencias</button>
            )}
          </div>
        )}

        {/* Movie list */}
        {!isEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map(movie => (
              tab === 'want'
                ? <WantCard
                    key={movie.id}
                    movie={movie}
                    onOpen={() => setSelected(movie)}
                    onMarkWatched={() => handleMarkWatched(movie)}
                    onRemove={() => handleRemoveWant(movie.id)}
                  />
                : <WatchedCard
                    key={movie.id}
                    movie={movie}
                    onOpen={() => setSelected(movie)}
                    onUnmark={() => handleUnmark(movie)}
                    onRemove={() => handleRemoveWatched(movie.id)}
                  />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      <WatchlistToast msg={toastMsg} />

      {/* Detail sheet */}
      {selected && (
        <DetailSheet
          movie={selected}
          onClose={() => setSelected(null)}
          onSkip={() => setSelected(null)}
          skipLabel="Cerrar"
          likeLabel={isInWatchlist(selected.id) ? 'Guardada' : 'Guardar'}
          onLike={() => {
            if (!isInWatchlist(selected.id)) {
              toggleWatchlist(selected);
              showToast({ type: 'add', title: 'Añadida a tu Watchlist', sub: selected.title || selected.name });
            }
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ── Cinematic toast ───────────────────────────────────────────────────────────
function WatchlistToast({ msg }) {
  const visible = !!msg;
  const isEye    = msg?.type === 'watched';
  const isAdd    = msg?.type === 'add';
  const isRemove = msg?.type === 'remove';

  const accent = isEye ? '#8B5CF6' : isAdd ? '#FF3B6B' : 'rgba(255,255,255,0.15)';
  const accentSoft = isEye ? 'rgba(139,92,246,0.4)' : isAdd ? 'rgba(255,59,107,0.4)' : 'rgba(255,255,255,0.12)';
  const glowColor = isEye ? 'rgba(139,92,246,0.25)' : isAdd ? 'rgba(255,59,107,0.22)' : 'transparent';

  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 22}px)`,
      zIndex: 999, pointerEvents: 'none',
      background: 'linear-gradient(135deg, rgba(22,12,46,0.97) 0%, rgba(12,6,28,0.97) 100%)',
      backdropFilter: 'blur(24px)',
      border: `1px solid ${accentSoft}`,
      borderRadius: 20, padding: '11px 16px 11px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.28s cubic-bezier(0.2,0.8,0.3,1), transform 0.28s cubic-bezier(0.2,0.8,0.3,1)',
      boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px ${accentSoft}, 0 4px 20px ${glowColor}`,
      minWidth: 220, maxWidth: 320,
    }}>
      {/* Icon badge */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: isEye
          ? 'linear-gradient(135deg, #8B5CF6, #C084FC)'
          : isAdd
            ? 'linear-gradient(135deg, #FF6B4A, #FF3B6B)'
            : 'rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isEye ? '0 4px 14px rgba(139,92,246,0.5)' : isAdd ? '0 4px 14px rgba(255,59,107,0.45)' : 'none',
      }}>
        {isEye ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="2"/>
          </svg>
        ) : isAdd ? (
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
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{msg?.title || ''}</div>
        {msg?.sub && (
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1,
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{msg.sub}</div>
        )}
      </div>
    </div>
  );
}

// ── "Quiero ver" card ─────────────────────────────────────────────────────────
function WantCard({ movie, onOpen, onMarkWatched, onRemove }) {
  const title   = movie.title || movie.name || 'Sin título';
  const year    = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating  = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const poster  = posterUrl(movie.poster_path, 'w342');
  const backdrop = backdropUrl(movie.backdrop_path, 'w780');
  const savedDate = movie.savedAt
    ? new Date(movie.savedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Backdrop hero (if available) */}
      {backdrop && (
        <div
          onClick={onOpen}
          style={{
            position: 'relative', height: 120, overflow: 'hidden', cursor: 'pointer',
          }}
        >
          <img src={backdrop} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
          }} />
          {rating && (
            <div style={{
              position: 'absolute', top: 10, right: 12,
              padding: '4px 9px', borderRadius: 999,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              fontSize: 12, fontWeight: 700, color: '#FFD700',
            }}>★ {rating}</div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        {/* Poster (only if no backdrop) */}
        {!backdrop && (
          <div onClick={onOpen} style={{
            width: 60, height: 86, borderRadius: 10, overflow: 'hidden',
            flexShrink: 0, cursor: 'pointer', background: '#1a0f2e',
          }}>
            {poster
              ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
            }
          </div>
        )}

        {/* Info */}
        <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: backdrop ? 16 : 15, fontWeight: 800, color: FP.text, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            {year && <span style={{ fontSize: 12, color: FP.textDim }}>{year}</span>}
            {!backdrop && rating && <span style={{ fontSize: 12, color: '#FFD700', fontWeight: 700 }}>★ {rating}</span>}
          </div>
          {savedDate && (
            <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 3 }}>
              Guardada el {savedDate}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
          {/* Mark as watched — eye pill */}
          <button
            onClick={(e) => { e.stopPropagation(); onMarkWatched(); }}
            title="Marcar como vista"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 13px', borderRadius: 999, cursor: 'pointer',
              background: 'rgba(139,92,246,0.16)',
              border: '1.5px solid rgba(139,92,246,0.45)',
              color: '#C084FC', fontWeight: 700, fontSize: 12,
              boxShadow: '0 0 16px rgba(139,92,246,0.22)',
              transition: 'all 0.18s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.3)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(139,92,246,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.16)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(139,92,246,0.22)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="#C084FC" strokeWidth="2"/>
            </svg>
            Ya la vi
          </button>

          {/* Remove */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Eliminar"
            style={{
              width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,107,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── "Vistas" card ─────────────────────────────────────────────────────────────
function WatchedCard({ movie, onOpen, onUnmark, onRemove }) {
  const title   = movie.title || movie.name || 'Sin título';
  const year    = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating  = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const poster  = posterUrl(movie.poster_path, 'w342');
  const watchedDate = movie.watchedAt
    ? new Date(movie.watchedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderRadius: 18, background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Poster */}
      <div onClick={onOpen} style={{
        width: 56, height: 80, borderRadius: 9, overflow: 'hidden',
        flexShrink: 0, cursor: 'pointer', position: 'relative',
        background: '#1a0f2e', opacity: 0.75,
      }}>
        {poster
          ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎬</div>
        }
        {/* Watched overlay */}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(192,132,252,0.9))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(139,92,246,0.7)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 15, fontWeight: 800, color: FP.textDim, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          {year && <span style={{ fontSize: 12, color: FP.textMuted }}>{year}</span>}
          {rating && <span style={{ fontSize: 12, color: '#FFD700', fontWeight: 700, opacity: 0.8 }}>★ {rating}</span>}
        </div>
        {watchedDate && (
          <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#C084FC" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" stroke="#C084FC" strokeWidth="2"/>
            </svg>
            Vista el {watchedDate}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
        {/* Move back to want */}
        <button
          onClick={(e) => { e.stopPropagation(); onUnmark(); }}
          title="Mover a Quiero ver"
          style={{
            width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 12l6-6M3 12l6 6" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Remove */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Eliminar"
          style={{
            width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,107,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M6 18L18 6" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
