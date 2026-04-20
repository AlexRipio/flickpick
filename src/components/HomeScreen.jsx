import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, Avatar, FlameMark, FlickPickWordmark } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getTrending } from '@/lib/tmdb';
import { subscribe } from '@/lib/roomStore';
import DetailSheet from '@/components/DetailSheet';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

const HomeScreen = () => {
  const navigate = useNavigate();
  const { profile, authLoading } = useProfile();
  const [trending, setTrending] = useState([]);
  const [tick, setTick] = useState(0);
  const [detailMovie, setDetailMovie] = useState(null);

  useEffect(() => {
    // Wait for Supabase to finish resolving the session (OAuth mobile redirect race condition).
    if (authLoading) return;
    if (!profile?.name) navigate('/welcome', { replace: true });
  }, [profile, navigate, authLoading]);

  useEffect(() => {
    getTrending({ page: 1 }).then(list => setTrending(list.slice(0, 10))).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1));
    const onStorage = () => setTick(t => t + 1);
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, []);

  const { activeRoom, totalMatches, totalRooms } = useMemo(() => {
    const all = readAllRooms();
    let active = null;
    let totalMatches = 0;
    let totalRooms = 0;
    for (const r of Object.values(all)) {
      if (!r) continue;
      if (profile?.id && r.members.some(m => m.id === profile.id)) {
        totalRooms += 1;
        totalMatches += (r.matches?.length || 0);
        if (r.status !== 'ended') {
          if (!active || (r.createdAt || 0) > (active.createdAt || 0)) active = r;
        }
      }
    }
    return { activeRoom: active, totalMatches, totalRooms };
  }, [tick, profile]);

  const user = profile || { name: 'Invitado' };
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AmbientBackdrop hue={290}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '24px 24px 80px', flex: 1, overflow: 'auto', maxWidth: 520, width: '100%', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlameMark size={30} animated/>
            <FlickPickWordmark height={19}/>
          </div>
          <button onClick={() => navigate('/profile')} style={{
            width: 40, height: 40, borderRadius: 999,
            border: '1.5px solid rgba(255,255,255,0.15)',
            background: 'linear-gradient(135deg, #FF6B4A, #9B3BFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', padding: 0, fontFamily: '"Space Grotesk"',
          }}>{initial}</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: FP.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
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

        {activeRoom && (
          <div onClick={() => navigate(`/room/${activeRoom.id}`)} style={{
            background: FP.flame, borderRadius: 22, padding: 18,
            marginBottom: 20, cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(255,59,107,0.3)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Sigue donde lo dejaste
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                Sala · {activeRoom.joinCode}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {activeRoom.members.length} deslizando · {activeRoom.matches?.length || 0} matches
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M9 6l6 6-6 6"/>
            </svg>
          </div>
        )}

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

        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{
              fontFamily: '"Space Grotesk", system-ui',
              fontSize: 18, fontWeight: 700, color: FP.text,
            }}>Tendencia esta semana</div>
            <button onClick={() => navigate('/trending')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: FP.textDim, fontWeight: 600,
              padding: 0,
            }}>Ver todas →</button>
          </div>
          <div className="no-scrollbar" style={{
            display: 'flex', gap: 12, overflowX: 'auto',
            margin: '0 -24px', padding: '0 24px 4px',
          }}>
            {(trending.length ? trending : Array.from({ length: 6 })).map((m, i) => (
              <div key={m?.id || i} onClick={() => m && setDetailMovie(m)} style={{
                width: 150, height: 220, borderRadius: 16,
                overflow: 'hidden', position: 'relative', flexShrink: 0,
                boxShadow: '0 10px 22px rgba(0,0,0,0.4)',
                background: '#1a0f2e',
                cursor: m ? 'pointer' : 'default',
              }}>
                {m && <Poster movie={m} showBadge={false}/>}
                {m && m.vote_average > 0 && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    padding: '3px 7px', borderRadius: 999,
                    background: 'rgba(0,0,0,0.7)',
                    fontSize: 11, fontWeight: 700, color: '#FFB547',
                    backdropFilter: 'blur(6px)',
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

        {(totalMatches > 0 || totalRooms > 0) && activeRoom && (
          <div onClick={() => navigate(`/room/${activeRoom.id}/matches`)} style={{
            marginTop: 28, padding: '16px 18px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(78,255,214,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20.8 11a9 9 0 11-2.9-7.6M21 3v5h-5" stroke="#4EFFD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: FP.text }}>Tus matches</div>
              <div style={{ fontSize: 12, color: FP.textDim, marginTop: 2 }}>{totalMatches} títulos en {totalRooms} {totalRooms === 1 ? 'sala' : 'salas'}</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path d="M9 6l6 6-6 6"/>
            </svg>
          </div>
        )}
      </div>
      {detailMovie && (
        <DetailSheet
          movie={detailMovie}
          onClose={() => setDetailMovie(null)}
          onLike={() => setDetailMovie(null)}
          onSkip={() => setDetailMovie(null)}
        />
      )}
    </div>
  );
};

function ActionCard({ onClick, title, subtitle, gradient, border, icon, shadow }) {
  return (
    <div onClick={onClick} style={{
      padding: '18px 20px', borderRadius: 22,
      background: gradient, border: border || 'none',
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
      boxShadow: shadow || 'none',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(10px)', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
        <path d="M9 6l6 6-6 6"/>
      </svg>
    </div>
  );
}

export default HomeScreen;
