import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getRoom, subscribe, removeMatch, hydrateRoomById } from '@/lib/roomStore';
import { posterUrl } from '@/lib/tmdb';
import { isInWatchlist, toggleWatchlist } from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';

const MatchesList = () => {
  const { id: roomId } = useParams();
  const navigate       = useNavigate();
  const { profile }    = useProfile();
  const [room, setRoom]       = useState(() => getRoom(roomId));
  const [loading, setLoading] = useState(!getRoom(roomId));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const handleRoom = (r) => { if (r) { setRoom(r); setLoading(false); } };
    const unsub    = subscribe(() => handleRoom(getRoom(roomId)));
    const onStorage = () => handleRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    // Hydrate from Supabase if not in localStorage (different device)
    hydrateRoomById(roomId)
      .then(r => { if (r) handleRoom(r); else setLoading(false); })
      .catch(() => setLoading(false));
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  const matches = useMemo(() => (room?.matches || []).slice().reverse(), [room]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A070F' }}>
        <AmbientBackdrop hue={200}/>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 36 }}>🎬</div>
          <div style={{ color: FP.textDim, fontSize: 14 }}>Cargando sala…</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={200}/>
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
          <div>Sala no encontrada</div>
          <button onClick={() => navigate('/home')} style={{
            marginTop: 16, padding: '10px 22px', borderRadius: 999,
            background: FP.flame, border: 'none', color: '#fff', cursor: 'pointer',
          }}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const createdStr = room.createdAt
    ? new Date(room.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' a las '
      + new Date(room.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={200}/>

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate(-1)}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Sala · {room.joinCode}</div>
        <div style={{ width: 42 }}/>
      </div>

      {/* Content */}
      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px 40px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {/* Header */}
        <h1 style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 30, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.8,
        }}>Vuestros matches</h1>

        {createdStr && (
          <p style={{ fontSize: 12, color: FP.textMuted, margin: '6px 0 0' }}>
            Sala iniciada el {createdStr}
          </p>
        )}

        <p style={{ fontSize: 14, color: FP.textDim, margin: '8px 0 16px' }}>
          {matches.length === 0
            ? 'Cuando todos deis like a la misma peli, aparecerá aquí.'
            : `${matches.length} ${matches.length === 1 ? 'película' : 'películas'} para ver juntos 🍿`}
        </p>

        {/* Members */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {room.members.map((m, i) => (
            <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -10, border: '2px solid #0A070F', borderRadius: 999 }}>
              {m.avatarUrl ? (
                <div style={{ width: 30, height: 30, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                  <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: 999, background: memberColor(i),
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
              )}
            </div>
          ))}
          <span style={{ marginLeft: 8, fontSize: 12, color: FP.textMuted }}>
            {room.members.map(m => m.name).join(', ')}
          </span>
        </div>

        {/* FlickPick Wrapped CTA */}
        <button
          onClick={() => navigate(`/room/${roomId}/analysis`)}
          style={{
            width: '100%', marginBottom: 20,
            padding: '14px 20px', borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(255,59,107,0.15) 100%)',
            border: '1px solid rgba(139,92,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #8B5CF6, #FF3B6B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>📊</div>
            <div>
              <div style={{
                fontFamily: '"Syne", "Space Grotesk", sans-serif',
                fontSize: 15, fontWeight: 800, color: '#fff',
              }}>FlickPick Wrapped</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                Compatibilidad, géneros y más
              </div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="rgba(139,92,246,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Empty state */}
        {matches.length === 0 && (
          <div style={{
            marginTop: 20, textAlign: 'center', padding: '40px 24px', borderRadius: 22,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 54 }}>🍿</div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 18, color: FP.text }}>Aún no hay matches</div>
            <div style={{ marginTop: 6, fontSize: 13, color: FP.textDim }}>Volved a deslizar y coincidid en una peli.</div>
            {room.status !== 'ended' && (
              <button onClick={() => navigate(`/room/${roomId}`)} style={{
                marginTop: 18, padding: '12px 22px', borderRadius: 999,
                background: FP.flame, border: 'none', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
              }}>Seguir deslizando</button>
            )}
          </div>
        )}

        {/* Match cards */}
        {matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map(m => (
              <MatchCard
                key={m.movieId}
                match={m}
                members={room.members}
                onClick={() => setSelected(m.movie)}
                onDelete={() => removeMatch(roomId, m.movieId)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DetailSheet
          movie={selected}
          onClose={() => setSelected(null)}
          onSkip={() => setSelected(null)}
          skipLabel="Cerrar"
          likeLabel="Guardar"
          onLike={() => {
            if (!isInWatchlist(selected.id)) toggleWatchlist(selected);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
};

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, members, onClick, onDelete }) {
  const [dragX, setDragX]     = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const startRef = useRef(null);

  const movie  = match.movie || {};
  const title  = movie.title || movie.name || 'Sin título';
  const year   = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const poster = posterUrl(movie.poster_path, 'w342');

  const matchedDate = match.matchedAt
    ? new Date(match.matchedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      + ' · '
      + new Date(match.matchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handlePointerMove = (e) => {
    if (!startRef.current) return;
    setDragX(Math.min(0, e.clientX - startRef.current.x));
  };
  const handlePointerUp = () => {
    if (dragX < -100) { setDeleted(true); setTimeout(onDelete, 280); }
    else setDragX(0);
    setDragging(false);
    startRef.current = null;
  };

  if (deleted) return null;

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }}>
      {/* Delete bg */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'linear-gradient(90deg, transparent, rgba(255,59,107,0.85))',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 22,
        opacity: dragX < -40 ? 1 : 0, transition: 'opacity 0.15s',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 18,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.2,0.8,0.3,1)',
          touchAction: 'pan-y', cursor: 'grab',
        }}
      >
        {/* ── Poster thumbnail — MUST have position:relative for Poster to work ── */}
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            width: 64, height: 90, borderRadius: 11, overflow: 'hidden',
            flexShrink: 0, position: 'relative',           // ← critical fix
            boxShadow: '0 6px 18px rgba(0,0,0,0.5)', cursor: 'pointer',
            background: '#1a0f2e',
          }}
        >
          {poster
            ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textMuted, fontSize: 24 }}>🎬</div>
          }
        </div>

        {/* Info */}
        <div onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 16, fontWeight: 800, color: FP.text, lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            {year && <span style={{ fontSize: 12, color: FP.textDim, fontWeight: 600 }}>{year}</span>}
            {rating && <span style={{ fontSize: 12, color: '#FFB547', fontWeight: 700 }}>★ {rating}</span>}
          </div>

          <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 3 }}>🕐 {matchedDate}</div>

          {/* Member avatars */}
          <div style={{ display: 'flex', marginTop: 7 }}>
            {members.map((mem, i) => (
              <div key={mem.id} style={{ marginLeft: i === 0 ? 0 : -6, border: '1.5px solid #0A070F', borderRadius: 999 }}>
                {mem.avatarUrl ? (
                  <div style={{ width: 20, height: 20, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                    <img src={mem.avatarUrl} alt={mem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                ) : (
                  <div style={{
                    width: 20, height: 20, borderRadius: 999, background: memberColor(i),
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                  }}>{(mem.name || '?').charAt(0).toUpperCase()}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ver detalles */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            flexShrink: 0, padding: '8px 13px', borderRadius: 999,
            background: 'rgba(78,255,214,0.1)', border: '1.5px solid rgba(78,255,214,0.3)',
            color: '#4EFFD6', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ver →
        </button>
      </div>
    </div>
  );
}

export default MatchesList;
