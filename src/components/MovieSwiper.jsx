import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton, IconButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import {
  addMember, getMemberVotedIds, getRoom, recordVote,
  closeRoom, subscribe, hydrateRoomById,
} from '@/lib/roomStore';
import { fetchPoolForRoom, getSimilar, getMovieDetails, getMovieVideoKey, PROVIDER_WATCH_URLS } from '@/lib/tmdb';
import { blendTastes, rankPool, topGenres } from '@/lib/matchmaking';
import DetailSheet from '@/components/DetailSheet';

const RERANK_EVERY = 5;
const REFILL_THRESHOLD = 6;

const MovieSwiper = () => {
  const { id: roomId } = useParams();
  const navigate       = useNavigate();
  const { profile, ensureProfile } = useProfile();

  const [room, setRoom]           = useState(() => getRoom(roomId));
  const [pool, setPool]           = useState([]);
  const [ranked, setRanked]       = useState([]);
  const [idx, setIdx]             = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [matchMovie, setMatchMovie]   = useState(null);
  const [detailMovie, setDetailMovie] = useState(null);

  // drag
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging]     = useState(false);

  // ── exit animation: the card flying off-screen lives here, separate from the stack
  // { movie, dir, startX, startY, startRot }
  const [flyingOut, setFlyingOut] = useState(null);

  const startRef        = useRef(null);
  const startTimeRef    = useRef(0);
  const fetchedRef      = useRef(false);
  const votesSinceRerank = useRef(0);
  const pendingMatchRef  = useRef(null);   // holds a match found during swipe animation
  const justMatchedRef   = useRef(null);   // movieId we just matched ourselves (skip subscription trigger)
  const prevMatchIdsRef  = useRef(null);   // snapshot of match IDs from last render cycle

  // ── room subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub    = subscribe(() => setRoom(getRoom(roomId)));
    const onStorage = () => setRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  // ── Bug 2 fix: detect new matches arriving via subscription (first voter) ─
  useEffect(() => {
    if (!room || !me) return;

    const currentMatches = room.matches || [];
    const currentIds     = new Set(currentMatches.map(m => m.movieId));

    if (prevMatchIdsRef.current !== null) {
      for (const match of currentMatches) {
        if (!prevMatchIdsRef.current.has(match.movieId)) {
          // A brand-new match appeared via remote sync.
          // If we were the one who triggered it, skip (already shown by swipe handler).
          if (justMatchedRef.current === match.movieId) {
            justMatchedRef.current = null;
            continue;
          }
          // Show the overlay if this user had already liked this movie.
          const myVotes = room.votes?.[me.id] || {};
          if (myVotes[match.movieId] === 'like') {
            setMatchMovie(match.movie);
          }
        }
      }
    }

    prevMatchIdsRef.current = currentIds;
  }, [room, me]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hydrate = async () => {
      let r = getRoom(roomId);
      if (!r) r = await hydrateRoomById(roomId);
      if (!r) { navigate('/home', { replace: true }); return; }
      setRoom(r);
      const me = profile?.name ? profile : ensureProfile('Invitado');
      if (me?.id) {
        try { addMember(roomId, { id: me.id, name: me.name, avatarUrl: me.avatarUrl || null }); } catch {}
      }
    };
    hydrate();
  }, [roomId, profile?.id]);

  const me        = useMemo(() => room?.members.find(m => m.id === profile?.id) || null, [room, profile]);
  const isHost    = !!(room && profile && room.ownerId === profile.id);
  const votedIds  = useMemo(() => me ? getMemberVotedIds(room, me.id) : new Set(), [room, me]);
  const lobbyTaste = useMemo(() => room ? blendTastes(room.members.map(m => m.taste)) : null, [room]);

  const loadPool = useCallback(async () => {
    if (!room || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { platforms = [], yearFrom, yearTo, mediaType = 'movie' } = room.preferences || {};
      const includeCartelera = platforms.includes('cartelera');
      const streamingKeys    = platforms.filter(p => p !== 'cartelera');
      const movies = await fetchPoolForRoom({
        platformKeys: streamingKeys, yearFrom, yearTo,
        includeCartelera, pages: 3, excludeIds: votedIds, mediaType,
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

  // ── FIX (bug 4): only reset idx/ranked when the POOL changes (initial load).
  // If lobbyTaste / votedIds were in the dep-array, every remote vote from device A
  // would call setIdx(0) on device B, teleporting its card position back to zero.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pool.length === 0) { setRanked([]); return; }
    setRanked(rankPool(pool, lobbyTaste, votedIds));
    setIdx(0);
  }, [pool]); // intentionally omitting lobbyTaste / votedIds

  const expandWithSimilar = useCallback(async () => {
    if (!me || me.taste.likes < 2) return;
    const tops = topGenres(lobbyTaste, 3);
    if (!tops.length) return;
    const likedEntries = Object.entries(room.votes[me.id] || {})
      .filter(([, v]) => v === 'like').slice(-3);
    const seedIds = likedEntries.map(([id]) => Number(id));
    try {
      const sets = await Promise.all(
        seedIds.map(id => getSimilar(id, { excludeIds: votedIds }).catch(() => []))
      );
      const seen      = new Set(pool.map(m => m.id));
      const newMovies = [];
      for (const list of sets)
        for (const m of list)
          if (!seen.has(m.id) && !votedIds.has(m.id)) { seen.add(m.id); newMovies.push(m); }
      if (newMovies.length) setPool(prev => [...prev, ...newMovies]);
    } catch {}
  }, [me, lobbyTaste, room, votedIds, pool]);

  const current = ranked[idx]     || null;
  const next    = ranked[idx + 1] || null;
  const after   = ranked[idx + 2] || null;

  useEffect(() => {
    if (room?.status !== 'live') return;
    const remaining = ranked.length - idx;
    if (remaining < REFILL_THRESHOLD && me && me.taste.likes >= 2) expandWithSimilar();
  }, [idx, ranked.length, room?.status, expandWithSimilar, me]);

  // ── swipe ─────────────────────────────────────────────────────────────────
  const swipe = (dir, movie) => {
    if (!movie || !me || flyingOut) return;

    // Capture drag state so FlyingCard starts from the same visual position
    const capturedX   = dragOffset.x;
    const capturedY   = dragOffset.y * 0.3;
    const capturedRot = capturedX * 0.08;

    // Launch the exit animation overlay
    setFlyingOut({ movie, dir, startX: capturedX, startY: capturedY, startRot: capturedRot });

    // Reset pointer state immediately so the next card is clean
    setDragOffset({ x: 0, y: 0 });
    setDragging(false);
    startRef.current = null;

    let madeMatchMovie = null;
    try {
      const { madeMatch, room: updated } = recordVote(
        roomId, me.id, movie, dir === 'right' ? 'like' : 'skip'
      );
      setRoom(updated);
      if (madeMatch) {
        madeMatchMovie = movie;
        justMatchedRef.current = movie.id; // prevent subscription from double-showing
      }

      votesSinceRerank.current += 1;
      if (votesSinceRerank.current >= RERANK_EVERY) {
        votesSinceRerank.current = 0;
        const updatedTaste = blendTastes(updated.members.map(m => m.taste));
        const updatedVoted = getMemberVotedIds(updated, me.id);
        setRanked(rankPool(ranked.slice(idx + 1), updatedTaste, updatedVoted));
        setIdx(0);
        if (dir === 'right') expandWithSimilar();
      } else {
        setIdx(i => i + 1); // advance immediately — FlyingCard handles the visual exit
      }
    } catch {
      setIdx(i => i + 1);
    }

    // Stash pending match so the setTimeout closure doesn't capture stale state
    pendingMatchRef.current = madeMatchMovie;
    setTimeout(() => {
      setFlyingOut(null);
      if (pendingMatchRef.current) {
        setMatchMovie(pendingMatchRef.current);
        pendingMatchRef.current = null;
      }
    }, 440);
  };

  // ── pointer handlers ──────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (flyingOut) return;
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
    if (!startRef.current) { setDragging(false); return; }
    const { x, y } = dragOffset;
    const dt   = Date.now() - startTimeRef.current;
    const dist = Math.hypot(x, y);
    if (dt < 260 && dist < 8 && current) {
      setDetailMovie(current);
      setDragOffset({ x: 0, y: 0 });
      setDragging(false);
      startRef.current = null;
    } else if (x > 90) {
      swipe('right', current);
    } else if (x < -90) {
      swipe('left', current);
    } else {
      setDragOffset({ x: 0, y: 0 });
      setDragging(false);
      startRef.current = null;
    }
  };

  const rotate = dragOffset.x * 0.08;
  const likeOp = Math.min(1, Math.max(0, dragOffset.x / 100));
  const skipOp = Math.min(1, Math.max(0, -dragOffset.x / 100));

  // ── guards ────────────────────────────────────────────────────────────────
  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2 }}>Cargando…</div>
      </div>
    );
  }
  if (room.status === 'lobby') {
    navigate(`/room/${roomId}/lobby`, { replace: true });
    return null;
  }
  // Bug 1 fix: when host closes the room, all members land on the analysis screen
  if (room.status === 'ended') {
    navigate(`/room/${roomId}/analysis`, { replace: true });
    return null;
  }

  // ── render ────────────────────────────────────────────────────────────────
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
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid #0A070F', borderRadius: 999 }}>
                {m.avatarUrl ? (
                  <div style={{ width: 24, height: 24, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                    <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                ) : (
                  <div style={{
                    width: 24, height: 24, borderRadius: 999,
                    background: memberColor(i), color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, fontFamily: '"Space Grotesk"',
                  }}>{(m.name || '?').charAt(0).toUpperCase()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isHost && (
            <IconButton
              onClick={() => {
                if (window.confirm('¿Cerrar la sala para todos?')) {
                  closeRoom(roomId);
                  navigate(`/room/${roomId}/analysis`, { replace: true });
                }
              }}
              size={36} ariaLabel="Cerrar sala"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#FF3B6B" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </IconButton>
          )}
          <IconButton onClick={() => navigate(`/room/${roomId}/matches`)} size={40} ariaLabel="Matches">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
                    stroke="#fff" strokeWidth="2" fill="none"/>
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Progress */}
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

      {/* ── Card stack ────────────────────────────────────────────────────── */}
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

        {/* Empty state — only show once flyingOut animation also finishes */}
        {!isLoading && !current && !flyingOut && (
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

        {!isLoading && (current || flyingOut) && (
          <>
            {/* Back card — always transitions to give stack-breathing effect */}
            {after && (
              <SwipeCard
                key={after.id}
                movie={after}
                style={{
                  zIndex: 1,
                  transform: 'translate(0px, 24px) scale(0.88)',
                  opacity: 0.55,
                  transition: 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.44s',
                }}
              />
            )}

            {/* Middle card */}
            {next && (
              <SwipeCard
                key={next.id}
                movie={next}
                style={{
                  zIndex: 2,
                  transform: 'translate(0px, 12px) scale(0.94)',
                  opacity: 0.82,
                  transition: 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.44s',
                }}
              />
            )}

            {/* Front card — draggable */}
            {current && (
              <SwipeCard
                key={current.id}
                movie={current}
                style={{
                  zIndex: 3,
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.3}px) scale(1) rotate(${rotate}deg)`,
                  transition: dragging ? 'none' : 'transform 0.12s ease-out',
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
            )}

            {/* ── Exiting card overlay — flies off independently ── */}
            {flyingOut && (
              <FlyingCard
                key={`exit-${flyingOut.movie.id}`}
                movie={flyingOut.movie}
                dir={flyingOut.dir}
                startX={flyingOut.startX}
                startY={flyingOut.startY}
                startRot={flyingOut.startRot}
              />
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {!isLoading && current && (
        <div style={{
          position: 'relative', zIndex: 5, padding: '18px 24px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          maxWidth: 520, width: '100%', margin: '0 auto',
        }}>
          <ActionFAB onClick={() => swipe('left', current)} variant="skip" size={58}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#FF3B6B" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </ActionFAB>
          <ActionFAB onClick={() => swipe('right', current)} variant="like" size={72}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="#fff"/>
            </svg>
          </ActionFAB>
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

// ── FlyingCard — mounts at the card's last position, then exits off-screen ─────
// Two rAF frames give the browser time to paint the initial position before the
// CSS transition starts, avoiding the card teleporting straight to the target.
function FlyingCard({ movie, dir, startX, startY, startRot }) {
  const [exited, setExited] = useState(false);

  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setExited(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, []);

  const targetX   = dir === 'right' ? 900 : -900;
  const targetRot = dir === 'right' ? 32  : -32;

  return (
    <SwipeCard
      movie={movie}
      style={{
        zIndex: 10,
        pointerEvents: 'none',
        transform: exited
          ? `translate(${targetX}px, 90px) scale(1) rotate(${targetRot}deg)`
          : `translate(${startX}px, ${startY}px) scale(1) rotate(${startRot}deg)`,
        transition: exited ? 'transform 0.42s cubic-bezier(0.4,0,0.95,1)' : 'none',
      }}
      likeOp={dir === 'right' ? 1 : 0}
      skipOp={dir === 'left'  ? 1 : 0}
      interactive={true}
    />
  );
}

// ── SwipeCard ──────────────────────────────────────────────────────────────────
function SwipeCard({ movie, style = {}, likeOp = 0, skipOp = 0, interactive = true, ...rest }) {
  const year = movie?.release_date
    ? movie.release_date.slice(0, 4)
    : movie?.first_air_date?.slice(0, 4) || '';

  // ── Trailer state ──
  const [trailerKey,     setTrailerKey]     = useState(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerOpen,    setTrailerOpen]    = useState(false);

  // Reset when card changes
  useEffect(() => {
    setTrailerKey(null);
    setTrailerLoading(false);
    setTrailerOpen(false);
  }, [movie?.id]);

  const handlePlayTrailer = async (e) => {
    e.stopPropagation();
    if (trailerOpen) return;
    if (trailerKey) { setTrailerOpen(true); return; }
    setTrailerLoading(true);
    const mediaType = movie?.first_air_date ? 'tv' : 'movie';
    const key = await getMovieVideoKey(movie.id, mediaType);
    setTrailerLoading(false);
    if (key) { setTrailerKey(key); setTrailerOpen(true); }
  };

  return (
    <div {...rest} style={{
      position: 'absolute', top: 0, left: 22, right: 22, bottom: 0,
      borderRadius: 28, overflow: 'hidden',
      background: '#1a0f2e',
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      WebkitTransform: 'translateZ(0)',
      ...style,
    }}>
      <Poster movie={movie} showBadge={true}/>

      {/* ── Trailer overlay ── */}
      {interactive && trailerOpen && trailerKey && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#000',
            display: 'flex', alignItems: 'center' }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
            style={{ width: '100%', height: '56.25%', border: 'none' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Tráiler"
          />
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setTrailerOpen(false); }}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 22,
              width: 36, height: 36, borderRadius: 999,
              background: 'rgba(0,0,0,0.72)', border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Swipe indicators ── */}
      {/* LIKE indicator — positioned on the LEFT so it stays visible as card moves right */}
      {interactive && likeOp > 0.04 && (
        <div style={{
          position: 'absolute', top: 32, left: 18,
          width: 62, height: 62, borderRadius: 999,
          background: `rgba(74,222,128,${0.18 + likeOp * 0.18})`,
          border: `3.5px solid rgba(74,222,128,${0.6 + likeOp * 0.4})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `rotate(-12deg) scale(${0.65 + likeOp * 0.45})`,
          opacity: Math.min(1, likeOp * 1.4),
          boxShadow: `0 0 ${likeOp * 32}px rgba(74,222,128,0.65)`,
          backdropFilter: 'blur(4px)',
          transition: 'none',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      {/* NOPE indicator — positioned on the RIGHT so it stays visible as card moves left */}
      {interactive && skipOp > 0.04 && (
        <div style={{
          position: 'absolute', top: 32, right: 18,
          width: 62, height: 62, borderRadius: 999,
          background: `rgba(255,59,107,${0.18 + skipOp * 0.18})`,
          border: `3.5px solid rgba(255,59,107,${0.6 + skipOp * 0.4})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `rotate(12deg) scale(${0.65 + skipOp * 0.45})`,
          opacity: Math.min(1, skipOp * 1.4),
          boxShadow: `0 0 ${skipOp * 32}px rgba(255,59,107,0.65)`,
          backdropFilter: 'blur(4px)',
          transition: 'none',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M6 18L18 6" stroke="#FF3B6B" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Bottom info */}
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
          {year && movie?.vote_average > 0 && (
            <span style={{ width: 3, height: 3, borderRadius: 999, background: FP.textMuted }}/>
          )}
          {movie?.vote_average > 0 && <span>★ {movie.vote_average.toFixed(1)}</span>}
        </div>
        {movie?.overview && (
          <div style={{
            marginTop: 10, fontSize: 12.5, color: FP.textDim, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{movie.overview}</div>
        )}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
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

          {/* Trailer button — only on the front interactive card */}
          {interactive && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handlePlayTrailer}
              disabled={trailerLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(255,59,107,0.15)',
                border: '1px solid rgba(255,59,107,0.4)',
                fontSize: 11, fontWeight: 700, color: '#FF8FA3',
                backdropFilter: 'blur(10px)', cursor: trailerLoading ? 'default' : 'pointer',
                opacity: trailerLoading ? 0.7 : 1,
              }}
            >
              {trailerLoading ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="9" stroke="#FF8FA3" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
              ) : (
                <svg width="9" height="10" viewBox="0 0 10 12" fill="none">
                  <polygon points="0,0 10,6 0,12" fill="#FF8FA3"/>
                </svg>
              )}
              {trailerLoading ? 'Cargando…' : 'Tráiler'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ActionFAB ─────────────────────────────────────────────────────────────────
function ActionFAB({ children, onClick, variant, size }) {
  const bgs     = { skip: 'rgba(255,59,107,0.1)', like: FP.flame,  info: 'rgba(78,255,214,0.1)' };
  const borders = { skip: '1.5px solid rgba(255,59,107,0.3)', like: 'none', info: '1.5px solid rgba(78,255,214,0.3)' };
  const shadows = { skip: '0 6px 20px rgba(255,59,107,0.2)', like: '0 10px 32px rgba(255,59,107,0.5)', info: '0 6px 20px rgba(78,255,214,0.15)' };
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 999,
      background: bgs[variant], border: borders[variant],
      boxShadow: shadows[variant],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: '#fff', padding: 0,
      transition: 'transform 0.12s',
    }}
      onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.9)'; }}
      onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >{children}</button>
  );
}

// ── MatchOverlay ──────────────────────────────────────────────────────────────
// Bug 2 fix: much bigger "¡MATCH!" title, explosive gradient, rounder font, more confetti
function MatchOverlay({ movie, members, onKeep, onOpen }) {
  const [show, setShow]         = useState(false);
  const [providers, setProviders] = useState(null);

  useEffect(() => { const t = setTimeout(() => setShow(true), 50); return () => clearTimeout(t); }, []);

  // Fetch streaming providers for this movie
  useEffect(() => {
    if (!movie?.id) return;
    let cancelled = false;
    getMovieDetails(movie.id)
      .then(d => {
        if (cancelled) return;
        const p = d?.['watch/providers']?.results?.ES
               || d?.['watch/providers']?.results?.US
               || null;
        setProviders(p);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.id]);

  const flatrate   = providers?.flatrate?.slice(0, 5) || [];
  const fallbackUrl = providers?.link
    || `https://www.justwatch.com/es/buscar?q=${encodeURIComponent(movie.title || movie.name)}`;

  const year = movie?.release_date
    ? movie.release_date.slice(0, 4)
    : movie?.first_air_date?.slice(0, 4) || '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, overflow: 'hidden',
      background: 'radial-gradient(130% 80% at 50% 20%, #3A0F5E 0%, #0B0420 55%, #000 100%)',
    }}>
      {/* Blurred backdrop poster */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.28, filter: 'blur(28px) saturate(150%)' }}>
        <Poster movie={movie} showBadge={false}/>
      </div>

      <Confetti active={show}/>

      <div style={{
        position: 'relative', zIndex: 2, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '44px 28px 36px', textAlign: 'center',
        maxWidth: 520, margin: '0 auto', overflow: 'hidden',
      }}>

        {/* ── Big "¡MATCH!" header ── */}
        <div style={{
          transform: show ? 'translateY(0) scale(1)' : 'translateY(-24px) scale(0.6)',
          opacity: show ? 1 : 0,
          transition: 'all 0.62s cubic-bezier(.2,.8,.3,1.35)',
        }}>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 90, fontWeight: 900, lineHeight: 0.88,
            letterSpacing: -5,
            background: 'linear-gradient(140deg, #FF6B4A 0%, #FF3B6B 45%, #BF5AF2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 44px rgba(255,59,107,0.55))',
          }}>¡MATCH!</div>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 6,
          }}>os ha gustado a los dos 🍿</div>
        </div>

        {/* Poster */}
        <div style={{
          width: 188, height: 270, borderRadius: 24, overflow: 'hidden',
          position: 'relative', marginTop: 20,
          transform: show ? 'scale(1) rotate(-1.5deg)' : 'scale(0.45) rotate(-22deg)',
          opacity: show ? 1 : 0,
          transition: 'transform 0.72s cubic-bezier(.2,.8,.3,1.4) 0.08s, opacity 0.42s 0.08s',
          boxShadow: '0 28px 60px rgba(155,59,255,0.55), 0 0 80px rgba(255,59,107,0.38)',
        }}>
          <Poster movie={movie} showBadge={false}/>
        </div>

        {/* Movie title */}
        <div style={{
          marginTop: 20,
          transform: show ? 'translateY(0)' : 'translateY(22px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.52s 0.22s',
        }}>
          <div style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 28, fontWeight: 800,
            color: '#fff', letterSpacing: -0.8, lineHeight: 1.08,
          }}>{movie.title || movie.name}</div>
          {year && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 5 }}>{year}</div>
          )}
        </div>

        {/* Member avatars */}
        <div style={{
          display: 'flex', marginTop: 18,
          transform: show ? 'scale(1)' : 'scale(0.65)',
          opacity: show ? 1 : 0,
          transition: 'all 0.52s 0.34s',
        }}>
          {members.map((u, i) => (
            <div key={u.id} style={{
              marginLeft: i === 0 ? 0 : -11,
              border: '3px solid #0B0420', borderRadius: 999,
              boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            }}>
              {u.avatarUrl ? (
                <div style={{ width: 42, height: 42, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                  <img src={u.avatarUrl} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ) : (
                <div style={{
                  width: 42, height: 42, borderRadius: 999,
                  background: memberColor(i), color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                  fontFamily: '"Space Grotesk"',
                }}>{(u.name || '?').charAt(0).toUpperCase()}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}/>

        {/* Buttons */}
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: 10,
          transform: show ? 'translateY(0)' : 'translateY(32px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.52s 0.5s',
        }}>
          <button onClick={onOpen} style={{
            width: '100%', height: 56, borderRadius: 999,
            background: FP.flame, border: 'none', color: '#fff',
            fontFamily: '"Space Grotesk"', fontWeight: 700, fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,59,107,0.38)',
          }}>Ver mis matches</button>
          {/* ── Ver ahora: real platform links ── */}
          {flatrate.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {flatrate.map(p => {
                const url = PROVIDER_WATCH_URLS[p.provider_id]?.(movie.title || movie.name) || fallbackUrl;
                return (
                  <a key={p.provider_id} href={url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '8px 10px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    textDecoration: 'none',
                  }}>
                    <img
                      src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                      alt={p.provider_name}
                      style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover' }}
                    />
                    <span style={{
                      fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 700,
                      fontFamily: '"Space Grotesk"', textAlign: 'center', maxWidth: 64,
                      lineHeight: 1.2,
                    }}>{p.provider_name}</span>
                  </a>
                );
              })}
            </div>
          ) : (
            <button
              onClick={() => window.open(fallbackUrl, '_blank')}
              style={{
                width: '100%', height: 48, borderRadius: 999,
                background: 'rgba(78,255,214,0.12)',
                border: '1.5px solid rgba(78,255,214,0.3)',
                color: '#4EFFD6', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', fontFamily: '"Space Grotesk"',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                      stroke="#4EFFD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ver ahora
            </button>
          )}
          <button onClick={onKeep} style={{
            width: '100%', height: 52, borderRadius: 999,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
            fontFamily: '"Space Grotesk"',
          }}>Seguir deslizando</button>
        </div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const colors = ['#FF6B4A', '#FF3B6B', '#9B3BFF', '#4EFFD6', '#FFB547', '#8B5CF6', '#F472B6', '#34D399', '#FACC15'];
    const color  = colors[i % colors.length];
    const angle  = (i / 90) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist   = 160 + Math.random() * 340;
    const dx     = Math.cos(angle) * dist;
    const dy     = Math.sin(angle) * dist - 80;
    const delay  = Math.random() * 0.3;
    const size   = 5 + Math.random() * 11;
    const rot    = Math.random() * 800 - 400;
    const shape  = i % 4; // 0=circle, 1=square, 2=rect, 3=diamond
    return { dx, dy, delay, size, rot, color, shape, i };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.i} style={{
          position: 'absolute', left: '50%', top: '40%',
          width:  p.size,
          height: p.shape === 2 ? p.size * 0.38 : p.shape === 3 ? p.size * 0.7 : p.size,
          background: p.color,
          borderRadius: p.shape === 0 ? '50%' : p.shape === 3 ? '2px' : '3px',
          transform: `translate(-50%, -50%) ${p.shape === 3 ? 'rotate(45deg)' : ''}`,
          animation: `fp-confetti-${p.i} 1.5s cubic-bezier(.1,.6,.2,1) ${p.delay}s forwards`,
          opacity: 0,
        }}/>
      ))}
      <style>{pieces.map(p => `
        @keyframes fp-confetti-${p.i} {
          0%   { transform: translate(-50%,-50%) scale(0.15) rotate(0deg); opacity:0; }
          12%  { opacity:1; }
          100% { transform: translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(1) rotate(${p.rot}deg); opacity:0; }
        }
      `).join('\n')}</style>
    </div>
  );
}

export default MovieSwiper;
