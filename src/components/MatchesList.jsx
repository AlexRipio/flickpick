import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getRoom, subscribe } from '@/lib/roomStore';
import { getMovieDetails } from '@/lib/tmdb';
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
          fontFamily: '"Space Grotesk", system-ui',
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {matches.map(m => (
              <MatchCard
                key={m.movieId}
                match={m}
                onClick={() => setSelected(m.movie)}
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

function MatchCard({ match, onClick }) {
  const date = new Date(match.matchedAt);
  const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const year = match.movie.release_date ? match.movie.release_date.slice(0, 4) : '';

  return (
    <div onClick={onClick} style={{
      position: 'relative', aspectRatio: '2/3',
      borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 12px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
      cursor: 'pointer',
      transition: 'transform 0.15s',
    }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Poster movie={match.movie} showBadge={false}/>
      <div style={{
        position: 'absolute', top: 8, right: 8,
        padding: '4px 8px', borderRadius: 999,
        background: FP.flame,
        fontSize: 10, fontWeight: 700, color: '#fff',
        letterSpacing: 0.5,
        boxShadow: '0 4px 10px rgba(255,59,107,0.4)',
      }}>MATCH</div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 12px 12px',
        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.92))',
      }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 14, fontWeight: 700, color: '#fff',
          lineHeight: 1.15,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{match.movie.title || match.movie.name}</div>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.65)',
          marginTop: 4, fontWeight: 600,
        }}>
          {year && <>{year} · </>}{dateStr}
        </div>
      </div>
    </div>
  );
}

export default MatchesList;
