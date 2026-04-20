import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getRoom, subscribe, removeMatch } from '@/lib/roomStore';
import DetailSheet from '@/components/DetailSheet';

const MatchesList = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [room, setRoom] = useState(() => getRoom(roomId));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = subscribe(() => setRoom(getRoom(roomId)));
    const onStorage = () => setRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  const matches = useMemo(() => (room?.matches || []).slice().reverse(), [room]);

  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={200}/>
        <div style={{ position: 'relative', zIndex: 2 }}>Sala no encontrada.</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={200}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate(-1)}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Matches</div>
        <div style={{ width: 42 }}/>
      </div>

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px 40px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <h1 style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 30, fontWeight: 800, color: FP.text,
          margin: 0, letterSpacing: -0.8,
        }}>Vuestros matches</h1>
        <p style={{ fontSize: 14, color: FP.textDim, margin: '8px 0 20px' }}>
          {matches.length === 0
            ? 'Cuando todos deis like a la misma peli, aparecerá aquí.'
            : `${matches.length} ${matches.length === 1 ? 'peli' : 'pelis'} para ver juntos.`}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          {room.members.map((m, i) => (
            <div key={m.id} style={{
              width: 28, height: 28, borderRadius: 999,
              background: memberColor(i), color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", system-ui', fontWeight: 700, fontSize: 11,
              border: '2px solid #0A070F',
              marginLeft: i === 0 ? 0 : -8,
            }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
          ))}
          <span style={{ marginLeft: 6, fontSize: 12, color: FP.textMuted }}>
            {room.members.length} {room.members.length === 1 ? 'miembro' : 'miembros'}
          </span>
        </div>

        {matches.length === 0 ? (
          <div style={{
            marginTop: 40, textAlign: 'center',
            padding: '40px 24px', borderRadius: 22,
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 54 }}>🍿</div>
            <div style={{
              marginTop: 14, fontFamily: '"Space Grotesk"', fontWeight: 700,
              fontSize: 18, color: FP.text,
            }}>Aún no hay matches</div>
            <div style={{ marginTop: 6, fontSize: 13, color: FP.textDim }}>
              Volved a deslizar y coincidid en una peli.
            </div>
            <button onClick={() => navigate(`/room/${roomId}`)} style={{
              marginTop: 18, padding: '12px 22px', borderRadius: 999,
              background: FP.flame, border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
            }}>Seguir deslizando</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map(m => (
              <MatchRow
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
          onLike={() => setSelected(null)}
          onSkip={() => setSelected(null)}
        />
      )}
    </div>
  );
};

function MatchRow({ match, members, onClick, onDelete }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const startRef = useRef(null);

  const date = new Date(match.matchedAt);
  const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const year = match.movie.release_date ? match.movie.release_date.slice(0, 4) : (match.movie.first_air_date ? match.movie.first_air_date.slice(0, 4) : '');
  const rating = match.movie.vote_average;

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handlePointerMove = (e) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    setDragX(Math.min(0, dx));
  };
  const handlePointerUp = () => {
    if (dragX < -100) {
      setDeleted(true);
      setTimeout(() => onDelete(), 300);
    } else {
      setDragX(0);
    }
    setDragging(false);
    startRef.current = null;
  };

  if (deleted) return null;

  const showDelete = dragX < -40;

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }}>
      {/* Delete background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(255,59,107,0.15), rgba(255,59,107,0.8))',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 20,
        opacity: showDelete ? 1 : 0,
        transition: 'opacity 0.15s',
        borderRadius: 18,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Row content */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.2,0.8,0.3,1)',
          cursor: 'grab',
          touchAction: 'pan-y',
        }}
      >
        {/* Poster thumbnail */}
        <div onClick={onClick} style={{
          width: 60, height: 85, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
          boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
          cursor: 'pointer',
        }}>
          <Poster movie={match.movie} showBadge={false}/>
        </div>

        {/* Info */}
        <div onClick={onClick} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 16, fontWeight: 800, color: FP.text,
            lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{match.movie.title || match.movie.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            {year && <span style={{ fontSize: 12, color: FP.textDim, fontWeight: 600 }}>{year}</span>}
            {rating > 0 && (
              <span style={{ fontSize: 12, color: '#FFB547', fontWeight: 700 }}>★ {rating.toFixed(1)}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 4 }}>{dateStr}</div>

          {/* Member avatars */}
          <div style={{ display: 'flex', marginTop: 6 }}>
            {members.map((mem, i) => (
              <div key={mem.id} style={{
                width: 20, height: 20, borderRadius: 999,
                background: memberColor(i), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                border: '1.5px solid #0A070F',
                marginLeft: i === 0 ? 0 : -6,
              }}>{(mem.name || '?').charAt(0).toUpperCase()}</div>
            ))}
          </div>
        </div>

        {/* Ver ahora button */}
        <button
          onClick={(e) => { e.stopPropagation(); window.open(`https://www.justwatch.com/es/buscar?q=${encodeURIComponent(match.movie.title || match.movie.name)}`, '_blank'); }}
          style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 999,
            background: 'rgba(78,255,214,0.12)',
            border: '1.5px solid rgba(78,255,214,0.3)',
            color: '#4EFFD6', fontWeight: 700, fontSize: 12,
            cursor: 'pointer', fontFamily: '"Space Grotesk"',
            display: 'flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="#4EFFD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Ver ahora
        </button>
      </div>
    </div>
  );
}

export default MatchesList;
