import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { subscribe } from '@/lib/roomStore';
import { posterUrl } from '@/lib/tmdb';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

const MatchesHistory = () => {
  const navigate       = useNavigate();
  const { profile }    = useProfile();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1));
    const onStorage = () => setTick(t => t + 1);
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, []);

  const myRooms = useMemo(() => {
    const all = readAllRooms();
    const mine = [];
    for (const r of Object.values(all)) {
      if (!r) continue;
      if (!profile?.id) continue;
      // Include rooms where the user is a member OR the owner —
      // mirrors the server-side filter in /api/rooms/mine. Some rooms
      // may have been created before the user logged in (members has
      // a guest id) but ownerId matches; OR vice versa with members
      // pointing to the canonical user.id.
      const isMember = r.members?.some(m => m.id === profile.id);
      const isOwner  = r.ownerId === profile.id;
      if (isMember || isOwner) mine.push(r);
    }
    return mine.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [tick, profile]);

  const totalMatches = myRooms.reduce((sum, r) => sum + (r.matches?.length || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={200}/>

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Historial</div>
        <div style={{ width: 42 }}/>
      </div>

      {/* Content */}
      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px var(--fp-content-bottom)', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <h1 style={{
          fontFamily: '"Inter", "Space Grotesk", sans-serif',
          fontSize: 30, fontWeight: 800, color: FP.text, margin: '0 0 4px', letterSpacing: -0.8,
        }}>Tus matches</h1>
        <p style={{ fontSize: 14, color: FP.textDim, margin: '0 0 22px' }}>
          {myRooms.length} {myRooms.length === 1 ? 'sala' : 'salas'} · {totalMatches} {totalMatches === 1 ? 'match total' : 'matches totales'}
        </p>

        {myRooms.length === 0 ? (
          <div style={{
            marginTop: 40, textAlign: 'center', padding: '48px 24px', borderRadius: 24,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 52 }}>🍿</div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 18, color: FP.text }}>Aún no has jugado</div>
            <div style={{ marginTop: 6, fontSize: 13, color: FP.textDim }}>Crea una sala e invita a alguien para empezar.</div>
            <button onClick={() => navigate('/create')} style={{
              marginTop: 20, padding: '12px 24px', borderRadius: 999,
              background: FP.flame, border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
            }}>Crear sala</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {myRooms.map(r => (
              <RoomCard key={r.id} room={r} onOpen={() => navigate(`/room/${r.id}/matches`)} onResume={() => navigate(r.status === 'lobby' ? `/room/${r.id}/lobby` : `/room/${r.id}`)}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room, onOpen, onResume }) {
  const matches     = room.matches || [];
  const matchCount  = matches.length;
  const statusLabel = room.status === 'ended' ? 'Finalizada' : room.status === 'live' ? 'En curso' : 'Lobby';
  const statusColor = room.status === 'ended' ? FP.textMuted : room.status === 'live' ? '#4EFFD6' : '#FFB547';
  const canResume   = room.status !== 'ended';

  const createdStr = room.createdAt
    ? new Date(room.createdAt).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      + ' · '
      + new Date(room.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Header row */}
      <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Count badge */}
        <div style={{
          width: 52, height: 52, borderRadius: 15, flexShrink: 0,
          background: matchCount > 0 ? 'rgba(78,255,214,0.1)' : 'rgba(255,255,255,0.06)',
          border: matchCount > 0 ? '1px solid rgba(78,255,214,0.25)' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        }}>
          <div style={{
            fontFamily: '"Inter", sans-serif', fontSize: matchCount > 9 ? 18 : 22,
            fontWeight: 800, color: matchCount > 0 ? '#4EFFD6' : FP.textMuted, lineHeight: 1,
          }}>{matchCount}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: FP.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            match{matchCount !== 1 ? 'es' : ''}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"Space Grotesk", system-ui', fontSize: 16, fontWeight: 700, color: FP.text }}>
              {room.name || `Sala · ${room.joinCode}`}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)',
              fontSize: 10, fontWeight: 700, color: statusColor,
            }}>{statusLabel}</span>
          </div>
          {room.name && (
            <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 2, fontFamily: 'ui-monospace, Menlo, monospace' }}>
              #{room.joinCode}
            </div>
          )}

          {createdStr && (
            <div style={{ fontSize: 11, color: FP.textMuted, marginTop: 4 }}>📅 {createdStr}</div>
          )}

          {/* Members */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
            <div style={{ display: 'flex' }}>
              {(room.members || []).slice(0, 6).map((m, i) => (
                <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid #0A070F', borderRadius: 999 }}>
                  {m.avatarUrl ? (
                    <div style={{ width: 24, height: 24, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                      <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  ) : (
                    <div style={{
                      width: 24, height: 24, borderRadius: 999, background: memberColor(i), color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
                  )}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: FP.textMuted }}>
              {(room.members || []).map(m => m.name).join(', ')}
            </span>
          </div>
        </div>
      </div>

      {/* Match poster strip */}
      {matchCount > 0 && (
        <div className="no-scrollbar" style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          padding: '0 18px 14px',
        }}>
          {matches.slice().reverse().slice(0, 8).map(m => {
            const p = posterUrl(m.movie?.poster_path, 'w185');
            return (
              <div key={m.movieId} style={{
                width: 56, height: 80, borderRadius: 9, overflow: 'hidden',
                flexShrink: 0, background: '#1a0f2e',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}>
                {p
                  ? <img src={p} alt={m.movie?.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎬</div>
                }
              </div>
            );
          })}
          {matchCount > 8 && (
            <div style={{
              width: 56, height: 80, borderRadius: 9, background: 'rgba(255,255,255,0.06)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: FP.textDim,
            }}>+{matchCount - 8}</div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 8, padding: '0 14px 14px',
      }}>
        <button onClick={onOpen} style={{
          flex: 1, height: 42, borderRadius: 999, cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: FP.text, fontWeight: 700, fontSize: 13,
        }}>
          Ver matches
        </button>
        {canResume && (
          <button onClick={onResume} style={{
            flex: 1, height: 42, borderRadius: 999, cursor: 'pointer',
            background: FP.flame, border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 6px 18px rgba(255,59,107,0.3)',
          }}>
            Continuar →
          </button>
        )}
      </div>
    </div>
  );
}

export default MatchesHistory;
