import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, Avatar, BackButton, IconButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { addMember, getMemberVotedIds, getRoom, recordVote, startRoom, closeRoom, subscribe, hydrateRoomById } from '@/lib/roomStore';
import { fetchPoolForRoom, getSimilar } from '@/lib/tmdb';
import { blendTastes, rankPool, topGenres } from '@/lib/matchmaking';
import DetailSheet from '@/components/DetailSheet';

const RERANK_EVERY = 5;
const REFILL_THRESHOLD = 6;

const MovieSwiper = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { profile, ensureProfile } = useProfile();

  const [room, setRoom] = useState(() => getRoom(roomId));
  const [pool, setPool] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [idx, setIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [matchMovie, setMatchMovie] = useState(null);
  const [detailMovie, setDetailMovie] = useState(null);

  // drag
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exitDir, setExitDir] = useState(null);
  const startRef = useRef(null);
  const startTimeRef = useRef(0);

  const fetchedRef = useRef(false);
  const votesSinceRerank = useRef(0);

  useEffect(() => {
    const unsub = subscribe(() => setRoom(getRoom(roomId)));
    const onStorage = () => setRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  useEffect(() => {
    const hydrate = async () => {
      let r = getRoom(roomId);
      if (!r) r = await hydrateRoomById(roomId);
      if (!r) { navigate('/home', { replace: true }); return; }
      setRoom(r);
      const me = profile?.name ? profile : ensureProfile('Invitado');
      if (me?.id && !r.members.some(m => m.id === me.id)) {
        try { addMember(roomId, { id: me.id, name: me.name }); } catch {}
      }
    };
    hydrate();
  }, [roomId, profile?.id]);

  const me = useMemo(() => room?.members.find(m => m.id === profile?.id) || null, [room, profile]);
  const isHost = !!(room && profile && room.ownerId === profile.id);
  const votedIds = useMemo(() => me ? getMemberVotedIds(room, me.id) : new Set(), [room, me]);
  const lobbyTaste = useMemo(() => room ? blendTastes(room.members.map(m => m.taste)) : null, [room]);

  const loadPool = useCallback(async () => {
    if (!room || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { platforms = [], yearFrom, yearTo, mediaType = 'movie' } = room.preferences || {};
      const includeCartelera = platforms.includes('cartelera');
      const streamingKeys = platforms.filter(p => p !== 'cartelera');
      const movies = await fetchPoolForRoom({
        platformKeys: streamingKeys,
        yearFrom, yearTo,
        includeCartelera,
        pages: 3,
        excludeIds: votedIds,
        mediaType,
      });
      if (!movies.length) setLoadError('No encontramos pelis para estos filtros. Prueba con otras plataformas.');
      setPool(movies);
    } catch (e) {
      setLoadError(e.message || 'No pudimos cargar las películas.');
    } finally {
      setIsLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (room?.status === 'live') loadPool();
  }, [room?.status, loadPool]);

  useEffect(() => {
    if (pool.length === 0) { setRanked([]); return; }
    const r = rankPool(pool, lobbyTaste, votedIds);
    setRanked(r);
    setIdx(0);
  }, [pool, lobbyTaste, votedIds]);

  const expandWithSimilar = useCallback(async () => {
    if (!me || me.taste.likes < 2) return;
    const tops = topGenres(lobbyTaste, 3);
    if (!tops.length) return;
    const likedEntries = Object.entries(room.votes[me.id] || {}).filter(([, v]) => v === 'like').slice(-3);
    const seedIds = likedEntries.map(([id]) => Number(id));
    try {
      const sets = await Promise.all(seedIds.map(id => getSimilar(id, { excludeIds: votedIds }).catch(() => [])));
      const seen = new Set(pool.map(m => m.id));
      const newMovies = [];
      for (const list of sets) for (const m of list) if (!seen.has(m.id) && !votedIds.has(m.id)) { seen.add(m.id); newMovies.push(m); }
      if (newMovies.length) setPool(prev => [...prev, ...newMovies]);
    } catch {}
  }, [me, lobbyTaste, room, votedIds, pool]);

  const current = ranked[idx] || null;
  const next = ranked[idx + 1] || null;
  const after = ranked[idx + 2] || null;

  useEffect(() => {
    if (room?.status !== 'live') return;
    const remaining = ranked.length - idx;
    if (remaining < REFILL_THRESHOLD && me && me.taste.likes >= 2) expandWithSimilar();
  }, [idx, ranked.length, room?.status, expandWithSimilar, me]);

  const swipe = (dir, movie) => {
    if (!movie || !me || exitDir) return;
    setExitDir(dir);
    let madeMatchMovie = null;
    try {
      const { madeMatch, room: updated } = recordVote(roomId, me.id, movie, dir === 'right' ? 'like' : 'skip');
      setRoom(updated);
      if (madeMatch) madeMatchMovie = movie;
      votesSinceRerank.current += 1;
      if (votesSinceRerank.current >= RERANK_EVERY) {
        votesSinceRerank.current = 0;
        const updatedTaste = blendTastes(updated.members.map(m => m.taste));
        const updatedVoted = getMemberVotedIds(updated, me.id);
        setRanked(prev => rankPool(prev.slice(idx + 1), updatedTaste, updatedVoted));
        setIdx(0);
        if (dir === 'right') expandWithSimilar();
        setTimeout(() => {
          setExitDir(null);
          setDragOffset({ x: 0, y: 0 });
          if (madeMatchMovie) setMatchMovie(madeMatchMovie);
        }, 440);
        return;
      }
    } catch {}
    setTimeout(() => {
      setIdx(i => i + 1);
      setExitDir(null);
      setDragOffset({ x: 0, y: 0 });
      if (madeMatchMovie) setMatchMovie(madeMatchMovie);
    }, 440);
  };

  const handlePointerDown = (e) => {
    if (exitDir) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handlePointerMove = (e) => {
    if (!startRef.current) return;
    setDragOffset({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const handlePointerUp = () => {
    const { x, y } = dragOffset;
    const dt = Date.now() - startTimeRef.current;
    const dist = Math.hypot(x, y);
    if (dt < 260 && dist < 8 && current) {
      setDetailMovie(current);
      setDragOffset({ x: 0, y: 0 });
    } else if (x > 90) swipe('right', current);
    else if (x < -90) swipe('left', current);
    else setDragOffset({ x: 0, y: 0 });
    setDragging(false);
    startRef.current = null;
  };

  const rotate = dragOffset.x * 0.08;
  const likeOp = Math.min(1, Math.max(0, dragOffset.x / 120));
  const skipOp = Math.min(1, Math.max(0, -dragOffset.x / 120));

  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2 }}>Cargando…</div>
      </div>
    );
  }

  if (room.status === 'lobby') {
    // auto-redirect to lobby page
    navigate(`/room/${roomId}/lobby`, { replace: true });
    return null;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AmbientBackdrop hue={280}/>

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 8px',
        maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')} size={40}/>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: FP.textMuted, letterSpacing: 2, textTransform: 'uppercase' }}>
            Sala · {room.joinCode}
          </div>
          <div style={{ display: 'flex', marginTop: 4 }}>
            {room.members.map((m, i) => (
              <div key={m.id} style={{
                width: 24, height: 24, borderRadius: 999,
                background: memberColor(i), color: '#fff',
                border: '2px solid #0A070F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, fontFamily: '"Space Grotesk"',
                marginLeft: i === 0 ? 0 : -8,
              }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isHost && (
            <IconButton onClick={() => { if (window.confirm('¿Cerrar la sala para todos?')) { closeRoom(roomId); navigate('/home', { replace: true }); } }} size={36} ariaLabel="Cerrar sala">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#FF3B6B" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </IconButton>
          )}
          <IconButton onClick={() => navigate(`/room/${roomId}/matches`)} size={40} ariaLabel="Matches">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke="#fff" strokeWidth="2" fill="none"/>
            </svg>
          </IconButton>
        </div>
      </div>

      {/* progress */}
      <div style={{ position: 'relative', zIndex: 5, padding: '0 24px', marginBottom: 10, maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${ranked.length ? Math.max(3, (idx / ranked.length) * 100) : 3}%`,
            background: FP.flame, borderRadius: 2, transition: 'width 0.3s',
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: FP.textMuted }}>
          <span>{room.matches.length} matches</span>
          <span>{Math.max(0, ranked.length - idx)} por ver</span>
        </div>
      </div>

      {/* card stack */}
      <div style={{
        flex: 1, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 22px',
        maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {isLoading && (
          <div style={{ textAlign: 'center', color: FP.textDim, fontSize: 14 }}>
            <div style={{ fontSize: 44 }}>🎞️</div>
            <div style={{ marginTop: 10 }}>Buscando películas…</div>
          </div>
        )}

        {!isLoading && !current && (
          <div style={{
            textAlign: 'center', padding: 30,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 48, opacity: 0.6 }}>🎞️</div>
            <div style={{ fontFamily: '"Space Grotesk"', fontSize: 22, fontWeight: 700, color: FP.text }}>
              {loadError ? 'Vaya…' : 'Las habéis visto todas'}
            </div>
            <div style={{ fontSize: 14, color: FP.textDim, maxWidth: 260 }}>
              {loadError || 'Mira vuestros matches o crea otra sala.'}
            </div>
            <button onClick={() => navigate(`/room/${roomId}/matches`)} style={{
              marginTop: 6, padding: '12px 22px', borderRadius: 999,
              background: FP.flame, color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>Ver matches</button>
          </div>
        )}

        {!isLoading && current && (
          <>
            {after && (
              <SwipeCard movie={after} style={{
                transform: 'scale(0.88) translateY(24px)', opacity: 0.45, zIndex: 1,
                transition: exitDir ? 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.44s' : 'none',
              }} interactive={false}/>
            )}
            {next && (
              <SwipeCard movie={next} style={{
                transform: exitDir ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
                opacity: exitDir ? 1 : 0.85, zIndex: 2,
                transition: exitDir ? 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.3s' : 'none',
              }} interactive={false}/>
            )}
            <SwipeCard
              movie={current}
              style={{
                zIndex: 3,
                transform: exitDir
                  ? `translate(${dragOffset.x + (exitDir === 'right' ? 600 : -600)}px, ${dragOffset.y + 70}px) rotate(${exitDir === 'right' ? 30 : -30}deg)`
                  : `translate(${dragOffset.x}px, ${dragOffset.y * 0.3}px) rotate(${rotate}deg)`,
                transition: dragging ? 'none' : exitDir ? 'transform 0.42s cubic-bezier(0.4,0,0.95,1)' : 'transform 0.12s ease-out',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              likeOp={likeOp}
              skipOp={skipOp}
              interactive={true}
            />
          </>
        )}
      </div>

      {/* action buttons */}
      {!isLoading && current && (
        <div style={{
          position: 'relative', zIndex: 5, padding: '18px 24px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          maxWidth: 520, width: '100%', margin: '0 auto',
        }}>
          {/* Skip */}
          <ActionFAB onClick={() => swipe('left', current)} variant="skip" size={58}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#FF3B6B" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </ActionFAB>
          {/* Like — big center */}
          <ActionFAB onClick={() => swipe('right', current)} variant="like" size={72}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="#fff"/>
            </svg>
          </ActionFAB>
          {/* Info / detalles */}
          <ActionFAB onClick={() => setDetailMovie(current)} variant="info" size={58}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" stroke="#4EFFD6" strokeWidth="2"/>
              <path d="M12 11v6" stroke="#4EFFD6" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="12" cy="8" r="1.2" fill="#4EFFD6"/>
            </svg>
          </ActionFAB>
        </div>
      )}

      {detailMovie && (
        <DetailSheet
          movie={detailMovie}
          onClose={() => setDetailMovie(null)}
          onLike={() => { const m = detailMovie; setDetailMovie(null); swipe('right', m); }}
          onSkip={() => { const m = detailMovie; setDetailMovie(null); swipe('left', m); }}
        />
      )}

      {matchMovie && (
        <MatchOverlay
          movie={matchMovie}
          members={room.members}
          onKeep={() => setMatchMovie(null)}
          onOpen={() => { setMatchMovie(null); navigate(`/room/${roomId}/matches`); }}
        />
      )}
    </div>
  );
};

function SwipeCard({ movie, style = {}, likeOp = 0, skipOp = 0, interactive = true, ...rest }) {
  const year = movie?.release_date ? movie.release_date.slice(0, 4) : '';
  return (
    <div {...rest} style={{
      position: 'absolute', top: 0, left: 22, right: 22, bottom: 0,
      borderRadius: 28, overflow: 'hidden',
      background: '#1a0f2e',
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      ...style,
    }}>
      <Poster movie={movie} showBadge={true}/>
      {interactive && likeOp > 0.05 && (
        <div style={{
          position: 'absolute', top: 30, right: 22,
          padding: '6px 14px', borderRadius: 10,
          border: '3px solid #4EFFD6',
          color: '#4EFFD6',
          fontFamily: '"Space Grotesk"', fontSize: 24, fontWeight: 800,
          transform: `rotate(14deg) scale(${0.8 + likeOp * 0.3})`,
          opacity: likeOp,
          letterSpacing: 2,
          textShadow: '0 0 20px rgba(78,255,214,0.5)',
          boxShadow: '0 0 20px rgba(78,255,214,0.4)',
          background: 'rgba(0,0,0,0.3)',
        }}>LIKE</div>
      )}
      {interactive && skipOp > 0.05 && (
        <div style={{
          position: 'absolute', top: 30, left: 22,
          padding: '6px 14px', borderRadius: 10,
          border: '3px solid #FF3B6B',
          color: '#FF3B6B',
          fontFamily: '"Space Grotesk"', fontSize: 24, fontWeight: 800,
          transform: `rotate(-14deg) scale(${0.8 + skipOp * 0.3})`,
          opacity: skipOp,
          letterSpacing: 2,
          background: 'rgba(0,0,0,0.3)',
        }}>NOPE</div>
      )}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '80px 22px 22px',
        background: 'linear-gradient(180deg, transparent, rgba(7,5,14,0.95) 80%)',
      }}>
        <div style={{
          fontFamily: '"Space Grotesk"',
          fontSize: 26, fontWeight: 800, color: '#fff',
          lineHeight: 1.05, letterSpacing: -0.5,
        }}>{movie?.title || movie?.name}</div>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          marginTop: 6, color: FP.textDim, fontSize: 12, fontWeight: 600,
        }}>
          {year && <span>{year}</span>}
          {year && movie?.vote_average > 0 && <span style={{ width: 3, height: 3, borderRadius: 999, background: FP.textMuted }}/>}
          {movie?.vote_average > 0 && <span>★ {movie.vote_average.toFixed(1)}</span>}
        </div>
        {movie?.overview && (
          <div style={{
            marginTop: 10, fontSize: 12.5, color: FP.textDim, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{movie.overview}</div>
        )}
        <div style={{
          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          fontSize: 11, fontWeight: 600, color: '#fff',
          backdropFilter: 'blur(10px)',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Toca para detalles
        </div>
      </div>
    </div>
  );
}

function ActionFAB({ children, onClick, variant, size }) {
  const bgs = {
    skip:    'rgba(255,59,107,0.1)',
    like:    FP.flame,
    info:    'rgba(78,255,214,0.1)',
  };
  const borders = {
    skip:    '1.5px solid rgba(255,59,107,0.3)',
    like:    'none',
    info:    '1.5px solid rgba(78,255,214,0.3)',
  };
  const shadows = {
    skip:    '0 6px 20px rgba(255,59,107,0.2)',
    like:    '0 10px 32px rgba(255,59,107,0.5)',
    info:    '0 6px 20px rgba(78,255,214,0.15)',
  };
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 999,
      background: bgs[variant], border: borders[variant],
      boxShadow: shadows[variant],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: '#fff', padding: 0,
      transition: 'transform 0.12s',
    }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >{children}</button>
  );
}

function MatchOverlay({ movie, members, onKeep, onOpen }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 50); return () => clearTimeout(t); }, []);
  const year = movie?.release_date ? movie.release_date.slice(0, 4) : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, overflow: 'hidden',
      background: 'radial-gradient(120% 80% at 50% 30%, #3A0F5E 0%, #0B0420 60%, #000 100%)',
    }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, filter: 'blur(30px) saturate(140%)' }}>
        <Poster movie={movie} showBadge={false}/>
      </div>

      <Confetti active={show}/>

      <div style={{
        position: 'relative', zIndex: 2, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 28px 40px', textAlign: 'center',
        maxWidth: 520, margin: '0 auto',
      }}>
        <div style={{
          width: 210, height: 300, borderRadius: 26, overflow: 'hidden',
          position: 'relative', marginTop: 30,
          transform: show ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-20deg)',
          opacity: show ? 1 : 0,
          transition: 'transform 0.7s cubic-bezier(.2,.8,.3,1.4), opacity 0.4s',
          boxShadow: '0 30px 60px rgba(155,59,255,0.5), 0 0 80px rgba(255,59,107,0.4)',
        }}>
          <Poster movie={movie} showBadge={false}/>
        </div>

        <div style={{
          marginTop: 30,
          transform: show ? 'translateY(0)' : 'translateY(20px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.2s',
        }}>
          <div style={{
            fontFamily: '"Space Grotesk"', fontSize: 13,
            letterSpacing: 5, color: '#4EFFD6',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 8,
          }}>¡Es un match!</div>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif', fontSize: 34, fontWeight: 800,
            color: '#fff', letterSpacing: -1, lineHeight: 1.05,
            background: FP.flame,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            paddingBottom: 6,
          }}>{movie.title || movie.name}</div>
          {year && <div style={{ fontSize: 14, color: FP.textDim, marginTop: 6 }}>{year}</div>}
        </div>

        <div style={{
          display: 'flex', marginTop: 20,
          transform: show ? 'scale(1)' : 'scale(0.7)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.35s',
        }}>
          {members.map((u, i) => (
            <div key={u.id} style={{
              width: 44, height: 44, borderRadius: 999,
              background: memberColor(i), color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 15,
              border: '3px solid #0B0420',
              marginLeft: i === 0 ? 0 : -12,
              boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              fontFamily: '"Space Grotesk"',
            }}>{(u.name || '?').charAt(0).toUpperCase()}</div>
          ))}
        </div>

        <div style={{ flex: 1 }}/>

        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: 10,
          transform: show ? 'translateY(0)' : 'translateY(30px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.5s',
        }}>
          <button onClick={onOpen} style={{
            width: '100%', height: 56, borderRadius: 999,
            background: FP.flame, border: 'none', color: '#fff',
            fontFamily: '"Space Grotesk"', fontWeight: 700, fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,59,107,0.35)',
          }}>Ver mis matches</button>
          <button onClick={() => window.open(`https://www.justwatch.com/es/buscar?q=${encodeURIComponent(movie.title || movie.name)}`, '_blank')} style={{
            width: '100%', height: 48, borderRadius: 999,
            background: 'rgba(78,255,214,0.12)',
            border: '1.5px solid rgba(78,255,214,0.3)',
            color: '#4EFFD6', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', fontFamily: '"Space Grotesk"',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="#4EFFD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Ver ahora
          </button>
          <button onClick={onKeep} style={{
            width: '100%', height: 56, borderRadius: 999,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
            fontFamily: '"Space Grotesk"',
          }}>Seguir deslizando</button>
        </div>
      </div>
    </div>
  );
}

function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = ['#FF6B4A', '#FF3B6B', '#9B3BFF', '#4EFFD6', '#FFB547', '#8B5CF6'];
    const color = colors[i % colors.length];
    const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 180 + Math.random() * 280;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    const delay = Math.random() * 0.25;
    const size = 6 + Math.random() * 10;
    const rot = Math.random() * 720 - 360;
    const shape = i % 3;
    return { dx, dy, delay, size, rot, color, shape, i };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
      {pieces.map((p) => (
        <div key={p.i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: p.size, height: p.shape === 2 ? p.size * 0.4 : p.size,
          background: p.color,
          borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? '3px' : '1px',
          transform: 'translate(-50%, -50%)',
          animation: `confetti-${p.i} 1.4s cubic-bezier(.1,.6,.2,1) ${p.delay}s forwards`,
          opacity: 0,
        }}/>
      ))}
      <style>{pieces.map(p => `
        @keyframes confetti-${p.i} {
          0%   { transform: translate(-50%,-50%) scale(0.2) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(1) rotate(${p.rot}deg); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  );
}

export default MovieSwiper;
