import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, FlameMark, FlickPickWordmark } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getTrending, posterUrl } from '@/lib/tmdb';
import { isInWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { subscribe } from '@/lib/roomStore';
import { getWatchlist, subscribeWatchlist } from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

function roomDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const HomeScreen = () => {
  const navigate = useNavigate();
  const { profile, authLoading } = useProfile();

  // ── ALL hooks must be declared before any conditional return ──────────────
  const [trending, setTrending]         = useState([]);
  const [tick, setTick]                 = useState(0);
  const [watchlistTick, setWatchlistTick] = useState(0);
  const [detailMovie, setDetailMovie]   = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.name) navigate('/welcome', { replace: true });
  }, [profile, navigate, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    getTrending({ page: 1 }).then(list => setTrending(list.slice(0, 12))).catch(() => {});
  }, [authLoading]);

  useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1));
    const onStorage = () => setTick(t => t + 1);
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    const unsub = subscribeWatchlist(() => setWatchlistTick(t => t + 1));
    return unsub;
  }, []);

  const { activeRoom, myRooms } = useMemo(() => {
    const all = readAllRooms();
    let active = null;
    const mine = [];
    for (const r of Object.values(all)) {
      if (!r) continue;
      if (profile?.id && r.members?.some(m => m.id === profile.id)) {
        mine.push(r);
        if (r.status !== 'ended') {
          if (!active || (r.createdAt || 0) > (active.createdAt || 0)) active = r;
        }
      }
    }
    mine.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { activeRoom: active, myRooms: mine };
  }, [tick, profile]);

  const watchlist = useMemo(() => getWatchlist(), [watchlistTick]);

  // ── Now safe to do conditional render ────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A070F' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img src="/logo.png" alt="FlickPick" style={{ width: 56, height: 56, objectFit: 'cover', objectPosition: 'center top', transform: 'scale(1.55) translateY(-14%)', transformOrigin: 'center top', animation: 'fp-pulse 1.4s ease-in-out infinite' }}/>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Cargando sesión…</div>
        </div>
      </div>
    );
  }

  const user    = profile || { name: 'Invitado' };
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();
  const previewRooms = myRooms.slice(0, 3);
  const hasMore = myRooms.length > 3;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AmbientBackdrop hue={290}/>
      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 2, padding: '24px 24px 80px', flex: 1, overflow: 'auto', maxWidth: 520, width: '100%', margin: '0 auto' }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlameMark size={30} animated/>
            <FlickPickWordmark height={19}/>
          </div>
          <button onClick={() => navigate('/profile')} style={{
            width: 40, height: 40, borderRadius: 999,
            border: '1.5px solid rgba(255,255,255,0.15)',
            background: profile?.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #FF6B4A, #9B3BFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: 0, overflow: 'hidden',
          }}>
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <span>{initial}</span>
            }
          </button>
        </div>

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: FP.textMuted, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Esta noche
          </div>
          <h1 style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 34, fontWeight: 800, color: FP.text,
            margin: 0, letterSpacing: -1, lineHeight: 1.05,
          }}>
            Hola {user.name},<br/>
            <span style={{ color: FP.textDim, fontWeight: 600 }}>¿qué os apetece hoy?</span>
          </h1>
        </div>

        {/* ── Resume active room ─────────────────────────────────────────── */}
        {activeRoom && (
          <div onClick={() => navigate(activeRoom.status === 'lobby' ? `/room/${activeRoom.id}/lobby` : `/room/${activeRoom.id}`)} style={{
            background: FP.flame, borderRadius: 22, padding: 18, marginBottom: 20,
            cursor: 'pointer', boxShadow: '0 12px 30px rgba(255,59,107,0.3)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Sigue donde lo dejaste
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>Sala · {activeRoom.joinCode}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {activeRoom.members?.length || 0} deslizando · {activeRoom.matches?.length || 0} matches
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M9 6l6 6-6 6"/></svg>
          </div>
        )}

        {/* ── Action cards ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ActionCard
            onClick={() => navigate('/create')}
            title="Crear sala"
            subtitle="Invita a tu pareja, amigos o grupo"
            gradient={FP.violet}
            shadow="0 12px 28px rgba(139,92,246,0.3)"
            icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>}
          />
          <ActionCard
            onClick={() => navigate('/join')}
            title="Unirse con código"
            subtitle="¿Tienes un código? Introdúcelo."
            gradient="rgba(255,255,255,0.05)"
            border="1px solid rgba(255,255,255,0.1)"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7M10 21H3v-7M21 3l-8 8M3 21l8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>

        {/* ── Trending strip ─────────────────────────────────────────────── */}
        <div style={{ marginTop: 32 }}>
          <SectionHeader title="Tendencia esta semana" action="Ver todas" onAction={() => navigate('/trending')}/>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', margin: '0 -24px', padding: '0 24px 4px' }}>
            {(trending.length ? trending : Array.from({ length: 6 })).map((m, i) => (
              <div key={m?.id || i} onClick={() => m && setDetailMovie(m)} style={{
                width: 140, height: 210, borderRadius: 16, overflow: 'hidden',
                position: 'relative', flexShrink: 0,
                boxShadow: '0 10px 22px rgba(0,0,0,0.4)', background: '#1a0f2e',
                cursor: m ? 'pointer' : 'default',
              }}>
                {m && <Poster movie={m} showBadge={false}/>}
                {m && m.vote_average > 0 && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    padding: '3px 7px', borderRadius: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                    fontSize: 11, fontWeight: 700, color: '#FFB547',
                  }}>★ {m.vote_average.toFixed(1)}</div>
                )}
                {m && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '24px 10px 10px',
                    background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.9))',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                  }}>{m.title || m.name}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Watchlist strip ────────────────────────────────────────────── */}
        {watchlist.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <SectionHeader title={`Quiero ver · ${watchlist.length}`} action="Ver lista" onAction={() => navigate('/watchlist')}/>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', margin: '0 -24px', padding: '0 24px 4px' }}>
              {watchlist.map(m => (
                <div key={m.id} onClick={() => setDetailMovie(m)} style={{
                  width: 110, height: 162, borderRadius: 14, overflow: 'hidden',
                  position: 'relative', flexShrink: 0, cursor: 'pointer',
                  boxShadow: '0 8px 18px rgba(0,0,0,0.4)', background: '#1a0f2e',
                }}>
                  {posterUrl(m.poster_path)
                    ? <img src={posterUrl(m.poster_path, 'w342')} alt={m.title || m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <div style={{ width: '100%', height: '100%', background: '#1a0f2e' }}/>
                  }
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '20px 8px 8px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>{m.title || m.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tus matches ────────────────────────────────────────────────── */}
        {myRooms.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <SectionHeader
              title="Tus matches"
              action={hasMore ? `Ver todo (${myRooms.length})` : null}
              onAction={() => navigate('/matches')}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {previewRooms.map(r => (
                <RoomMatchCard
                  key={r.id}
                  room={r}
                  onClick={() => navigate(`/room/${r.id}/matches`)}
                />
              ))}
              {hasMore && (
                <button onClick={() => navigate('/matches')} style={{
                  width: '100%', padding: '14px', borderRadius: 18,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  color: FP.textDim, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: 0.2,
                }}>
                  Ver las {myRooms.length - 3} salas restantes →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {detailMovie && (
        <DetailSheet
          movie={detailMovie}
          onClose={() => setDetailMovie(null)}
          onSkip={() => setDetailMovie(null)}
          skipLabel="Cerrar"
          likeLabel="Guardar"
          onLike={() => {
            if (!isInWatchlist(detailMovie.id)) toggleWatchlist(detailMovie);
            setDetailMovie(null);
          }}
        />
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontFamily: '"Space Grotesk", system-ui', fontSize: 17, fontWeight: 700, color: FP.text }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: FP.textDim, fontWeight: 600, padding: 0,
        }}>{action} →</button>
      )}
    </div>
  );
}

function RoomMatchCard({ room, onClick }) {
  const matchCount  = room.matches?.length || 0;
  const statusLabel = room.status === 'ended' ? 'Finalizada' : room.status === 'live' ? 'En curso' : 'Lobby';
  const statusColor = room.status === 'ended' ? FP.textMuted : room.status === 'live' ? '#4EFFD6' : '#FFB547';
  const lastMatch   = matchCount > 0 ? room.matches[room.matches.length - 1] : null;

  return (
    <div onClick={onClick} style={{
      padding: '14px 16px', borderRadius: 20,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
    }}>
      {/* Count badge */}
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: matchCount > 0 ? 'rgba(78,255,214,0.1)' : 'rgba(255,255,255,0.06)',
        border: matchCount > 0 ? '1px solid rgba(78,255,214,0.25)' : '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1,
      }}>
        <div style={{
          fontFamily: '"Syne", sans-serif', fontSize: matchCount > 9 ? 18 : 22,
          fontWeight: 800, color: matchCount > 0 ? '#4EFFD6' : FP.textMuted, lineHeight: 1,
        }}>{matchCount}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: FP.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {matchCount === 1 ? 'match' : 'match'}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: '"Space Grotesk", system-ui', fontSize: 15, fontWeight: 700, color: FP.text }}>
            Sala · {room.joinCode}
          </span>
          <span style={{
            padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.06)',
            fontSize: 10, fontWeight: 700, color: statusColor,
          }}>{statusLabel}</span>
        </div>

        {/* Members + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <div style={{ display: 'flex' }}>
            {(room.members || []).slice(0, 5).map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -6, border: '2px solid #0A070F', borderRadius: 999 }}>
                {m.avatarUrl ? (
                  <div style={{ width: 20, height: 20, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                    <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                ) : (
                  <div style={{
                    width: 20, height: 20, borderRadius: 999, background: memberColor(i), color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                  }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
                )}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: FP.textMuted }}>
            {room.members?.length || 0} miembro{(room.members?.length || 0) !== 1 ? 's' : ''}
            {room.createdAt ? ' · ' + new Date(room.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' + new Date(room.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>

        {lastMatch?.movie && (
          <div style={{ marginTop: 4, fontSize: 11, color: FP.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            🎬 {lastMatch.movie.title || lastMatch.movie.name}{matchCount > 1 ? ` y ${matchCount - 1} más` : ''}
          </div>
        )}
      </div>

      <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)"><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
}

function ActionCard({ onClick, title, subtitle, gradient, border, icon, shadow }) {
  return (
    <div onClick={onClick} style={{
      padding: '18px 20px', borderRadius: 22, background: gradient, border: border || 'none',
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
      position: 'relative', overflow: 'hidden', boxShadow: shadow || 'none',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(10px)', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
}

export default HomeScreen;
