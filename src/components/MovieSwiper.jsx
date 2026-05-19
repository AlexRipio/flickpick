import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton, IconButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import {
  addMember, getMemberVotedIds, getRoom, recordVote,
  closeRoom, subscribe, hydrateRoomById,
  requestEndRoom, clearEndRequest,
  markWatchedShared, getRoomWatchedIds,
} from '@/lib/roomStore';
import { fetchPoolForRoom, getSimilar, getMovieDetails, getMovieVideoKey, posterUrl, PROVIDER_WATCH_URLS } from '@/lib/tmdb';
import { blendTastes, rankPool, topGenres } from '@/lib/matchmaking';
import { markWatched, getWatched, subscribeWatched } from '@/lib/watchlist';
import DetailSheet from '@/components/DetailSheet';
import { openShowtimes } from '@/lib/showtimes';
import haptic from '@/lib/haptic';

const RERANK_EVERY      = 5;
const REFILL_THRESHOLD  = 6;
const DEFAULT_PAUSE_AT  = 25; // pausa por defecto cuando swipeTarget = null
// pauseAt dinámico: si hay swipeTarget, mitad redondeada arriba (mín 5)
function computePauseAt(swipeTarget) {
  if (!swipeTarget) return DEFAULT_PAUSE_AT;
  return Math.max(5, Math.ceil(swipeTarget / 2));
}

// Defensive de-duplication: TMDB occasionally serves the same movie
// across multiple discover pages, and expandWithSimilar can yield
// overlap with the existing pool. A duplicate in `pool`/`ranked`
// surfaces as the same poster appearing twice in a row — the user
// sees an identical card right after the previous one. Stripping
// duplicates by id at the boundary keeps the swipe stack monotonic.
function dedupeById(list) {
  const seen = new Set();
  const out  = [];
  for (const m of list) {
    if (m == null) continue;
    const id = Number(m.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

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
  const [matchMovie, setMatchMovie]     = useState(null);
  const [detailMovie, setDetailMovie]   = useState(null);
  const [showPause, setShowPause]       = useState(false);
  const [endRequestSent, setEndRequestSent] = useState(false);
  const [swipeCount, setSwipeCount]     = useState(0); // drives progress bar re-renders
  const swipeCountRef                   = useRef(0);   // authoritative counter (no stale closure risk)

  // drag — only `dragging` survives as state because it gates the
  // grab/grabbing cursor; the offset itself is tracked in dragOffsetRef
  // (declared further down) and applied to the DOM imperatively.
  const [dragging, setDragging]     = useState(false);

  // ── exit animation: the card flying off-screen lives here, separate from the stack
  // { movie, dir, startX, startY, startRot }
  const [flyingOut, setFlyingOut] = useState(null);
  // Synchronous mirror of flyingOut. setState batching in React lets two
  // back-to-back button taps (or a fast double-fire on Android) both clear
  // the `if (flyingOut) return` guard inside swipe() before either render
  // commits, which records the same card twice. This ref is set inline at
  // the top of swipe()/markAsWatched() so the second call short-circuits
  // immediately.
  const flyingOutRef = useRef(null);

  const startRef        = useRef(null);
  const startTimeRef    = useRef(0);
  const fetchedRef      = useRef(false);
  const votesSinceRerank = useRef(0);
  const pendingMatchRef  = useRef(null);   // holds a match found during swipe animation
  const justMatchedRef   = useRef(null);   // movieId we just matched ourselves (skip subscription trigger)
  const prevMatchIdsRef  = useRef(null);   // snapshot of match IDs from last render cycle

  // ── Derived state — declared BEFORE any effect that uses them ───────────────
  // (avoids temporal dead zone: useEffect dep arrays are evaluated during render)
  const me         = useMemo(() => room?.members.find(m => m.id === profile?.id) || null, [room, profile]);
  const isHost     = !!(room && profile && room.ownerId === profile.id);
  const votedIds   = useMemo(() => me ? getMemberVotedIds(room, me.id) : new Set(), [room, me]);
  const lobbyTaste = useMemo(() => {
    if (!room) return null;
    const members = Array.isArray(room.members) ? room.members : [];
    return blendTastes(members.map(m => m.taste));
  }, [room]);

  // ── Watched IDs (locales del usuario + compartidas en sala) ────────────────
  const [localWatchedTick, setLocalWatchedTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeWatched(() => setLocalWatchedTick(t => t + 1));
    return unsub;
  }, []);
  const excludedIds = useMemo(() => {
    const set = new Set(votedIds);
    // Si la sala marcó "incluir vistas", NO excluimos las watched (solo los votos)
    if (!room?.preferences?.includeWatched) {
      if (room) getRoomWatchedIds(room).forEach(id => set.add(id));
      getWatched().forEach(m => set.add(Number(m.id)));
    }
    return set;
  }, [votedIds, room, localWatchedTick]);

  // ── room subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub    = subscribe(() => setRoom(getRoom(roomId)));
    const onStorage = () => setRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  // ── react to room status (lobby / ended) — robust redirect ────────────────
  // Si el host cierra la sala (status='ended') o vuelve a lobby, todos los
  // miembros deben moverse aquí, no solo el host. La detección llega vía
  // polling/WS → setRoom → este efecto.
  useEffect(() => {
    if (!room) return;
    if (room.status === 'ended') {
      navigate(`/room/${roomId}/analysis`, { replace: true });
    } else if (room.status === 'lobby') {
      navigate(`/room/${roomId}/lobby`, { replace: true });
    }
  }, [room?.status, roomId, navigate]);

  // ── detect new matches arriving via subscription (first voter) ────────────
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
            haptic.match();
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

  // Safety net: if the room never resolves (hydrate failed, network
  // blackhole, corrupted localStorage…) bail back to /home after 8s
  // instead of leaving the user stuck on "Cargando…" forever.
  useEffect(() => {
    if (room) return;
    const t = setTimeout(() => {
      if (!getRoom(roomId)) navigate('/home', { replace: true });
    }, 8000);
    return () => clearTimeout(t);
  }, [room, roomId, navigate]);

  const loadPool = useCallback(async () => {
    if (!room || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { platforms = [], yearFrom, yearTo, mediaType = 'movie', vibes = [], cinema } = room.preferences || {};

      let movies = [];

      // Si hay cinema seleccionado, usar endpoint de cine específico
      if (cinema && cinema.id) {
        const apiBase = import.meta.env.VITE_API_URL || 'https://flickpick.mov/api';
        const res = await fetch(`${apiBase}/cinemas/${cinema.id}/now`);
        if (res.ok) {
          const data = await res.json();
          // Normaliza a shape TMDB. Filtra las que no tengan match TMDB
          // (sin tmdbId no podemos mostrar póster ni metadata).
          movies = (data.movies || [])
            .filter(m => m.tmdbId)
            .map(m => ({
              id:           m.tmdbId,
              title:        m.tmdbTitle || m.title,
              original_title: m.originalTitle,
              poster_path:  m.posterPath || null,
              overview:     m.overview || m.synopsis || '',
              release_date: m.releaseDate || '',
              runtime:      m.runtime || null,
              genre_ids:    [],
              vote_average: 0,
              cinemaShowtimes: m.showtimes || [],
            }));
        } else {
          throw new Error('No pudimos cargar la cartelera del cine.');
        }
      } else {
        // Flujo normal: fetchPoolForRoom
        const includeCartelera = platforms.includes('cartelera');
        const streamingKeys    = platforms.filter(p => p !== 'cartelera');

        let genreIds = [];
        let excludeGenreIds = [];
        let keywordIds = [];
        let movieMatchesVibes = null;
        if (vibes.length) {
          const v = await import('@/lib/vibes');
          genreIds          = v.vibeCoreGenres(vibes);
          excludeGenreIds   = v.vibeExcludeGenres(vibes);
          keywordIds        = v.vibeKeywordIds(vibes);
          movieMatchesVibes = v.movieMatchesVibes;
        }

        movies = await fetchPoolForRoom({
          platformKeys: streamingKeys, yearFrom, yearTo,
          includeCartelera, pages: 3, excludeIds: excludedIds, mediaType,
          genreIds, excludeGenreIds, keywordIds,
        });

        // Defensa post-fetch (cartelera no admite with_genres en TMDB y algunas
        // pelis vienen sin genre_ids). Aplica matcher estricto si hay vibes.
        if (vibes.length && movieMatchesVibes) {
          const strict = movies.filter(m => movieMatchesVibes(m, vibes));
          if (strict.length >= 6) movies = strict;
        }
      }

      if (!movies.length) setLoadError('No encontramos pelis para estos filtros. Prueba con otras plataformas.');
      setPool(dedupeById(movies));
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
    // Filtramos previamente las películas ya vistas (sala + locales) para
    // que no aparezcan, y deduplicamos por id como capa extra defensiva
    // ante TMDB devolviendo el mismo id en varias páginas.
    const filtered = dedupeById(pool.filter(m => !excludedIds.has(Number(m.id))));
    setRanked(rankPool(filtered, lobbyTaste, votedIds));
    setIdx(0);
  }, [pool, localWatchedTick]); // intentionally omitting lobbyTaste / votedIds

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
      if (newMovies.length) setPool(prev => dedupeById([...prev, ...newMovies]));
    } catch {}
  }, [me, lobbyTaste, room, votedIds, pool]);

  const current = ranked[idx]     || null;
  const next    = ranked[idx + 1] || null;
  const after   = ranked[idx + 2] || null;

  // Preload the next two poster images so the moment the front card flies
  // off, the new front card already has its bytes ready. Without this the
  // browser briefly painted the previous DOM <img> while it fetched the
  // new src — the "wrong cover that changes" bug.
  useEffect(() => {
    [next, after].forEach(m => {
      if (!m?.poster_path) return;
      const url = posterUrl(m.poster_path, 'w780');
      if (!url) return;
      const img = new Image();
      img.src = url;
    });
  }, [next?.id, after?.id]);

  useEffect(() => {
    if (room?.status !== 'live') return;
    const remaining = ranked.length - idx;
    if (remaining < REFILL_THRESHOLD && me && me.taste.likes >= 2) expandWithSimilar();
  }, [idx, ranked.length, room?.status, expandWithSimilar, me]);

  // ── marcar como vista (swipe-up) ──────────────────────────────────────────
  const markAsWatched = (movie) => {
    if (!movie || !me || flyingOutRef.current) return;
    flyingOutRef.current = movie;
    haptic.light();
    const capturedX   = dragOffsetRef.current.x;
    const capturedY   = dragOffsetRef.current.y;
    const capturedRot = capturedX * 0.04;
    setFlyingOut({ movie, dir: 'up', startX: capturedX, startY: capturedY, startRot: capturedRot });
    resetCardVisual(false);
    dragOffsetRef.current = { x: 0, y: 0 };
    setDragging(false);
    startRef.current = null;
    try {
      // 1) Local: la mueve de "Quiero ver" a "Vistas"
      markWatched(movie);
      // 2) Sala: comparte con el resto de miembros para excluirla de sus swipes
      const updated = markWatchedShared(roomId, movie);
      setRoom(updated);
    } catch {}
    swipeCountRef.current += 1;
    setSwipeCount(swipeCountRef.current);
    setIdx(i => i + 1);
    setTimeout(() => {
      setFlyingOut(null);
      flyingOutRef.current = null;
    }, 440);
  };

  // ── swipe ─────────────────────────────────────────────────────────────────
  const swipe = (dir, movie) => {
    if (!movie || !me || flyingOutRef.current) return;
    flyingOutRef.current = movie;
    haptic.light();

    // Capture drag state so FlyingCard starts from the same visual position
    const capturedX   = dragOffsetRef.current.x;
    const capturedY   = dragOffsetRef.current.y * 0.3;
    const capturedRot = capturedX * 0.08;

    // Launch the exit animation overlay
    setFlyingOut({ movie, dir, startX: capturedX, startY: capturedY, startRot: capturedRot });

    // Reset pointer state immediately so the next card is clean
    resetCardVisual(false);
    dragOffsetRef.current = { x: 0, y: 0 };
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
        // Filter out anything already voted (paranoid — rankPool uses
        // `voted` for ranking but doesn't strip), and dedupe so a noisy
        // pool can't surface the same id twice in the new ranking.
        const remaining = dedupeById(
          ranked.slice(idx + 1).filter(m => !updatedVoted.has(Number(m.id)))
        );
        setRanked(rankPool(remaining, updatedTaste, updatedVoted));
        setIdx(0);
        if (dir === 'right') expandWithSimilar();
      } else {
        setIdx(i => i + 1); // advance immediately — FlyingCard handles the visual exit
      }
    } catch {
      setIdx(i => i + 1);
    }

    // Increment swipe counter (ref = no stale closure; state = drives re-render)
    swipeCountRef.current += 1;
    setSwipeCount(swipeCountRef.current);

    const swipeTarget = room?.preferences?.swipeTarget ?? null;
    const pauseAt = computePauseAt(swipeTarget);
    const reachedTarget = swipeTarget && swipeCountRef.current >= swipeTarget;
    const shouldPause = !reachedTarget && swipeCountRef.current % pauseAt === 0;

    // Stash pending match so the setTimeout closure doesn't capture stale state
    pendingMatchRef.current = madeMatchMovie;
    setTimeout(() => {
      setFlyingOut(null);
      flyingOutRef.current = null;
      if (pendingMatchRef.current) {
        haptic.match();
        setMatchMovie(pendingMatchRef.current);
        pendingMatchRef.current = null;
        // Si tras el match hemos llegado al target, cierra también
        if (reachedTarget) {
          closeRoom(roomId);
          navigate(`/room/${roomId}/analysis`, { replace: true });
        }
      } else if (reachedTarget) {
        closeRoom(roomId);
        navigate(`/room/${roomId}/analysis`, { replace: true });
      } else if (shouldPause) {
        setShowPause(true);
      }
    }, 440);
  };

  // ── pointer handlers ──────────────────────────────────────────────────────
  // Live offset in a ref. The drag pipeline writes transforms directly to
  // DOM nodes (cardRef, likeRef, …) — without going through React state —
  // so a fast finger drag never triggers a per-frame re-render. This keeps
  // the swipe glassy even on mid-range Android. setDragOffset is only used
  // for the spring-back / programmatic reset cases.
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // DOM refs for the front (interactive) card and its three indicators.
  // Wired from <SwipeCard interactive={true} cardRef={…} likeRef={…} … />.
  const cardRef    = useRef(null);
  const likeRef    = useRef(null);
  const skipRef    = useRef(null);
  const watchedRef = useRef(null);

  // Apply transform/opacities directly to the DOM. Cheap; runs on every
  // pointermove. The browser pipeline batches this onto the next paint.
  const paintDrag = (x, y) => {
    if (cardRef.current) {
      cardRef.current.style.transform =
        `translate3d(${x}px, ${y * 0.3}px, 0) rotate(${x * 0.08}deg)`;
    }
    const likeOp    = Math.min(1, Math.max(0, x / 100));
    const skipOp    = Math.min(1, Math.max(0, -x / 100));
    const watchedOp = Math.min(1, Math.max(0, -y / 100)) * (Math.abs(x) < 80 ? 1 : 0);
    if (likeRef.current) {
      likeRef.current.style.opacity   = String(Math.min(1, likeOp * 1.4));
      likeRef.current.style.transform = `rotate(-12deg) scale(${0.65 + likeOp * 0.45})`;
    }
    if (skipRef.current) {
      skipRef.current.style.opacity   = String(Math.min(1, skipOp * 1.4));
      skipRef.current.style.transform = `rotate(12deg) scale(${0.65 + skipOp * 0.45})`;
    }
    if (watchedRef.current) {
      watchedRef.current.style.opacity   = String(Math.min(1, watchedOp * 1.4));
      watchedRef.current.style.transform = `translateX(-50%) scale(${0.65 + watchedOp * 0.45})`;
    }
  };

  const resetCardVisual = (animated = true) => {
    if (cardRef.current) {
      // The prop-level `transition` already swaps to "ease-out 0.18s"
      // once `dragging` flips to false, so we only need to set the
      // transform here. (Setting transition imperatively too would
      // race with React reapplying the prop on the next commit.)
      cardRef.current.style.transition = animated ? 'transform 0.18s ease-out' : 'none';
      cardRef.current.style.transform  = 'translate3d(0,0,0) rotate(0deg)';
    }
    if (likeRef.current)    { likeRef.current.style.opacity = '0'; }
    if (skipRef.current)    { skipRef.current.style.opacity = '0'; }
    if (watchedRef.current) { watchedRef.current.style.opacity = '0'; }
  };

  const handlePointerDown = (e) => {
    if (flyingOutRef.current) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    dragOffsetRef.current = { x: 0, y: 0 };
    setDragging(true);
    // Lock out the spring-back transition so the card follows the finger.
    if (cardRef.current) cardRef.current.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handlePointerMove = (e) => {
    if (!startRef.current) return;
    const x = e.clientX - startRef.current.x;
    const y = e.clientY - startRef.current.y;
    dragOffsetRef.current = { x, y };
    paintDrag(x, y);
  };
  const handlePointerUp = () => {
    if (!startRef.current) { setDragging(false); return; }
    // Read the LIVE ref — same reason as before: state can lag on slower
    // Android phones and would otherwise mismatch the user's final pos.
    const { x, y } = dragOffsetRef.current;
    const dt   = Date.now() - startTimeRef.current;
    const dist = Math.hypot(x, y);
    if (dt < 260 && dist < 8 && current) {
      setDetailMovie(current);
      resetCardVisual(false);
      dragOffsetRef.current = { x: 0, y: 0 };
      setDragging(false);
      startRef.current = null;
    } else if (y < -100 && Math.abs(x) < 80) {
      // Swipe-up = marcar como vista
      markAsWatched(current);
    } else if (x > 90) {
      swipe('right', current);
    } else if (x < -90) {
      swipe('left', current);
    } else {
      // Spring back to centre with a short ease.
      resetCardVisual(true);
      dragOffsetRef.current = { x: 0, y: 0 };
      setDragging(false);
      startRef.current = null;
    }
  };

  // ── guards ────────────────────────────────────────────────────────────────
  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2 }}>Cargando…</div>
      </div>
    );
  }
  if (room.status === 'lobby' || room.status === 'ended') {
    // Render-time navigation is unreliable; the actual redirect is handled
    // by the useEffect below (watches room.status). Render nothing meanwhile.
    return null;
  }

  // Guard against malformed / partially-synced rooms that arrive from
  // the server with missing fields (members[], preferences, etc.).
  // Without this the .map call on undefined crashes the component and
  // the user just sees the ambient backdrop with nothing on top.
  if (!Array.isArray(room.members) || !room.preferences) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: FP.textDim, padding: 24, textAlign: 'center' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 360 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🛠</div>
          <div style={{ fontWeight: 700, color: FP.text, fontSize: 17, marginBottom: 6 }}>Esta sala no se pudo cargar</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
            Faltan datos del servidor o la sala fue creada en otro dispositivo y aún no terminó de sincronizar.
          </div>
          <button onClick={() => navigate('/home', { replace: true })} style={{
            padding: '10px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: FP.flame, color: '#fff', fontWeight: 700, fontSize: 14,
          }}>Volver al inicio</button>
        </div>
      </div>
    );
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
          {isHost ? (
            <button
              type="button"
              onClick={() => {
                haptic.medium();
                if (window.confirm('¿Terminar la sala para todos? Veréis el análisis y los matches.')) {
                  haptic.heavy();
                  closeRoom(roomId);
                  navigate(`/room/${roomId}/analysis`, { replace: true });
                }
              }}
              aria-label="Terminar sala"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 36, padding: '0 14px', borderRadius: 999,
                background: 'rgba(255,59,107,0.14)',
                border: '1px solid rgba(255,59,107,0.45)',
                color: '#FF7A99',
                fontFamily: '"Space Grotesk", system-ui',
                fontWeight: 800, fontSize: 12, letterSpacing: 0.6,
                textTransform: 'uppercase', cursor: 'pointer',
                transition: 'background 0.18s, transform 0.12s',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="#FF7A99"/>
              </svg>
              Terminar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (endRequestSent) return;
                haptic.medium();
                requestEndRoom(roomId, profile.id, profile.name || 'Invitado');
                setEndRequestSent(true);
                setTimeout(() => setEndRequestSent(false), 30000);
              }}
              disabled={endRequestSent}
              aria-label="Solicitar terminar sala"
              title="Pide al anfitrión que termine la sala"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 36, padding: '0 12px', borderRadius: 999,
                background: endRequestSent
                  ? 'rgba(78,255,170,0.14)' : 'rgba(255,255,255,0.06)',
                border: endRequestSent
                  ? '1px solid rgba(78,255,170,0.45)'
                  : '1px solid rgba(255,255,255,0.15)',
                color: endRequestSent ? '#5BFFB0' : 'rgba(255,255,255,0.78)',
                fontFamily: '"Space Grotesk", system-ui',
                fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
                textTransform: 'uppercase',
                cursor: endRequestSent ? 'default' : 'pointer',
                transition: 'background 0.18s',
              }}
            >
              {endRequestSent ? '✓ Enviada' : 'Pedir terminar'}
            </button>
          )}
          <IconButton onClick={() => navigate(`/room/${roomId}/matches`)} size={40} ariaLabel="Matches">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
                    stroke="#fff" strokeWidth="2" fill="none"/>
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Progress — checkpoint cycle bar */}
      <ProgressBar
        swipeCount={swipeCount}
        matchCount={Array.isArray(room.matches) ? room.matches.length : 0}
        pauseAt={computePauseAt(room?.preferences?.swipeTarget)}
      />

      {/* ── Card stack ────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 22px',
        maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {isLoading && (
          <SwipeLoading/>
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
            {/* The three stack cards use POSITIONAL keys ("back" / "middle"
                / "front") instead of movie.id so React reuses the same
                DOM nodes when idx advances. That keeps:
                  · the stack-breathing transition fluid (the middle card
                    actually animates up to the front instead of being
                    destroyed and re-created at the front position),
                  · the front card's pointer refs / inline transform
                    intact between swipes,
                  · GC pressure low (no full Poster subtree re-mount).
                The Poster itself uses key={real} on its inner <img> to
                avoid the "wrong cover that switches" bug — that contract
                still holds. */}
            {after && (
              <SwipeCard
                key="back"
                movie={after}
                style={{
                  zIndex: 1,
                  transform: 'translate3d(0px, 24px, 0) scale(0.88)',
                  opacity: 0.55,
                  transition: 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.44s',
                  willChange: 'transform, opacity',
                }}
              />
            )}

            {next && (
              <SwipeCard
                key="middle"
                movie={next}
                style={{
                  zIndex: 2,
                  transform: 'translate3d(0px, 12px, 0) scale(0.94)',
                  opacity: 0.82,
                  transition: 'transform 0.44s cubic-bezier(0.2,0.8,0.3,1), opacity 0.44s',
                  willChange: 'transform, opacity',
                }}
              />
            )}

            {/* Front card — draggable. Transform is set imperatively
                via cardRef during drag (see paintDrag) — that path
                bypasses React's render cycle entirely so a fast finger
                drag never re-renders the tree. */}
            {current && (
              <SwipeCard
                key="front"
                movie={current}
                cardRef={cardRef}
                likeRef={likeRef}
                skipRef={skipRef}
                watchedRef={watchedRef}
                style={{
                  zIndex: 3,
                  transform: 'translate3d(0,0,0) rotate(0deg)',
                  // 'none' while dragging so the imperative paint runs
                  // 1:1 with the finger; a short ease enables the
                  // spring-back to animate when the drag is released
                  // without a swipe.
                  transition: dragging ? 'none' : 'transform 0.18s ease-out',
                  cursor: dragging ? 'grabbing' : 'grab',
                  touchAction: 'none',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
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
          <ActionFAB onClick={() => markAsWatched(current)} variant="watched" size={58}>
            {/* Ojo = ya la he visto */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#9B6BFF" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="#9B6BFF" strokeWidth="2"/>
            </svg>
          </ActionFAB>
        </div>
      )}

      {detailMovie && (
        <DetailSheet
          movie={detailMovie}
          cartelera={!!room.preferences?.platforms?.includes('cartelera')}
          onClose={() => setDetailMovie(null)}
          onLike={() => { const m = detailMovie; setDetailMovie(null); swipe('right', m); }}
          onSkip={() => { const m = detailMovie; setDetailMovie(null); swipe('left', m); }}
        />
      )}

      {matchMovie && (
        <MatchOverlay
          movie={matchMovie}
          members={room.members}
          cartelera={!!room.preferences?.platforms?.includes('cartelera')}
          onKeep={() => setMatchMovie(null)}
          onOpen={() => { setMatchMovie(null); navigate(`/room/${roomId}/matches`); }}
        />
      )}

      {showPause && (
        <MidSessionPause
          swipeCount={swipeCount}
          matchCount={room.matches?.length || 0}
          members={room.members}
          onContinue={() => setShowPause(false)}
          onEnd={() => {
            closeRoom(roomId);
            navigate(`/room/${roomId}/analysis`, { replace: true });
          }}
        />
      )}

      {/* End-room request banner — pinned at the top while the guest's
          request is active. We deliberately use a banner (not a one-off
          popup) so the host can't miss it even if the WS reconnects or
          the data syncs in pieces. Visible as long as room.endRequest
          exists and isn't from this same user. */}
      {isHost
        && room?.endRequest
        && room.endRequest.memberId !== profile?.id && (
        <EndRequestBanner
          requesterName={room.endRequest.memberName}
          onIgnore={() => { haptic.light(); clearEndRequest(roomId); }}
          onFinish={() => {
            haptic.heavy();
            clearEndRequest(roomId);
            closeRoom(roomId);
            navigate(`/room/${roomId}/analysis`, { replace: true });
          }}
        />
      )}
    </div>
  );
};

// ── EndRequestBanner ─────────────────────────────────────────────────
function EndRequestBanner({ requesterName, onIgnore, onFinish }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      background: 'linear-gradient(180deg, rgba(255,107,74,0.96) 0%, rgba(255,59,107,0.92) 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.18)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.08) inset',
      animation: 'fp-end-req-in 0.3s cubic-bezier(.2,.8,.3,1.1) both',
    }}>
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        fontFamily: '"Space Grotesk", system-ui',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999, flexShrink: 0,
          background: 'rgba(255,255,255,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0zM12 8v4M12 16v.01"
                  stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 140, color: '#fff' }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>
            {requesterName || 'Un invitado'} pide terminar
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
            Decide: terminar la sala para todos o ignorar.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onIgnore} style={{
            padding: '8px 14px', borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.30)',
            color: '#fff', fontWeight: 700, fontSize: 12,
            cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
          }}>Ignorar</button>
          <button onClick={onFinish} style={{
            padding: '8px 14px', borderRadius: 999,
            background: '#fff',
            border: 'none', color: '#FF3B6B', fontWeight: 800, fontSize: 12,
            cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
            boxShadow: '0 4px 14px rgba(0,0,0,0.20)',
          }}>Terminar</button>
        </div>
      </div>
      <style>{`
        @keyframes fp-end-req-in {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}


// ── ProgressBar — stable component so CSS transition works across renders ────────
function ProgressBar({ swipeCount, matchCount, pauseAt }) {
  const swipesInCycle = swipeCount % pauseAt;
  const pct           = swipeCount === 0 ? 0 : (swipesInCycle / pauseAt) * 100;
  const swipesLeft    = pauseAt - swipesInCycle;

  return (
    <div style={{
      position: 'relative', zIndex: 5,
      padding: '0 24px', marginBottom: 8,
      maxWidth: 520, width: '100%', alignSelf: 'center',
    }}>
      {/* Track */}
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        {/* Fill — stable DOM node, CSS transition animates width */}
        <div style={{
          height: '100%',
          width: `${Math.max(1.5, pct)}%`,
          background: 'linear-gradient(90deg, #FF3B6B, #BF5AF2)',
          borderRadius: 99,
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}/>
      </div>
      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 5, fontSize: 11, color: FP.textMuted,
      }}>
        <span>💘 {matchCount} {matchCount === 1 ? 'match' : 'matches'}</span>
        <span>
          🎬 {swipeCount}
          {swipeCount > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>
              · {swipesLeft} para el checkpoint
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

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

  const isUp = dir === 'up';
  const targetX   = isUp ? 0 : (dir === 'right' ? 900 : -900);
  const targetY   = isUp ? -1200 : 90;
  const targetRot = isUp ? 0 : (dir === 'right' ? 32 : -32);

  return (
    <SwipeCard
      movie={movie}
      style={{
        zIndex: 10,
        pointerEvents: 'none',
        transform: exited
          ? `translate(${targetX}px, ${targetY}px) scale(${isUp ? 0.85 : 1}) rotate(${targetRot}deg)`
          : `translate(${startX}px, ${startY}px) scale(1) rotate(${startRot}deg)`,
        transition: exited ? 'transform 0.42s cubic-bezier(0.4,0,0.95,1), opacity 0.42s ease' : 'none',
        opacity: exited && isUp ? 0 : 1,
      }}
      likeOp={dir === 'right' ? 1 : 0}
      skipOp={dir === 'left'  ? 1 : 0}
      watchedOp={dir === 'up' ? 1 : 0}
      interactive={true}
    />
  );
}

// ── SwipeCard ──────────────────────────────────────────────────────────────────
// `cardRef` (when supplied) wires the outer DOM node to MovieSwiper so the
// drag pipeline can transform it imperatively. `likeRef` / `skipRef` /
// `watchedRef` do the same for the three swipe indicators — they're kept
// mounted at opacity 0 and faded in directly via inline style during drag,
// avoiding any per-frame React re-render. likeOp/skipOp/watchedOp props
// remain for back-compat on FlyingCard (the exiting card overlay).
function SwipeCard({
  movie, style = {},
  cardRef, likeRef, skipRef, watchedRef,
  likeOp = 0, skipOp = 0, watchedOp = 0,
  interactive = true,
  ...rest
}) {
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
    <div ref={cardRef} {...rest} style={{
      position: 'absolute', top: 0, left: 22, right: 22, bottom: 0,
      borderRadius: 28, overflow: 'hidden',
      background: '#1a0f2e',
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      WebkitTransform: 'translateZ(0)',
      // Stop the browser from selecting text or showing the long-press
      // image menu mid-swipe (notorious Android Chrome behaviour).
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      ...style,
    }}>
      {/* Poster wrapped so its <img> swallows no pointer events — this
          lets pointer capture on the parent card stay reliable on
          Android Chrome, which otherwise can interpret an in-image touch
          as the start of an image-save gesture. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Poster movie={movie} showBadge={true}/>
      </div>

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

      {/* ── Swipe indicators ── kept always-mounted on interactive cards.
          Opacity / scale are driven imperatively from the parent's drag
          handler (see paintDrag in MovieSwiper). FlyingCard still uses
          the {like,skip,watched}Op props so the exit animation paints
          the correct stamp on the flying card.
          Perf: no backdrop-filter, simple drop shadow, willChange to
          force GPU layer — these run at 60fps even on mid-range Android. */}
      {interactive && (
        <>
          {/* LIKE — left side */}
          <div ref={likeRef} style={{
            position: 'absolute', top: 32, left: 18,
            width: 62, height: 62, borderRadius: 999,
            background: 'rgba(74,222,128,0.32)',
            border: '3.5px solid rgba(74,222,128,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: likeRef ? 'rotate(-12deg) scale(0.65)' : `rotate(-12deg) scale(${0.65 + likeOp * 0.45})`,
            opacity: likeRef ? 0 : Math.min(1, likeOp * 1.4),
            transition: 'none', pointerEvents: 'none',
            willChange: 'opacity, transform',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {/* WATCHED — top centre (drag-up) */}
          <div ref={watchedRef} style={{
            position: 'absolute', top: 32, left: '50%',
            width: 70, height: 70, borderRadius: 999,
            background: 'rgba(155,107,255,0.34)',
            border: '3.5px solid rgba(155,107,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: watchedRef ? 'translateX(-50%) scale(0.65)' : `translateX(-50%) scale(${0.65 + watchedOp * 0.45})`,
            opacity: watchedRef ? 0 : Math.min(1, watchedOp * 1.4),
            transition: 'none', pointerEvents: 'none',
            willChange: 'opacity, transform',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#9B6BFF" strokeWidth="2.5" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3.2" stroke="#9B6BFF" strokeWidth="2.5"/>
            </svg>
          </div>
          {/* NOPE — right side */}
          <div ref={skipRef} style={{
            position: 'absolute', top: 32, right: 18,
            width: 62, height: 62, borderRadius: 999,
            background: 'rgba(255,59,107,0.32)',
            border: '3.5px solid rgba(255,59,107,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: skipRef ? 'rotate(12deg) scale(0.65)' : `rotate(12deg) scale(${0.65 + skipOp * 0.45})`,
            opacity: skipRef ? 0 : Math.min(1, skipOp * 1.4),
            transition: 'none', pointerEvents: 'none',
            willChange: 'opacity, transform',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#FF3B6B" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
        </>
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
  const bgs     = { skip: 'rgba(255,59,107,0.1)', like: FP.flame,  info: 'rgba(78,255,214,0.1)', watched: 'rgba(155,107,255,0.10)' };
  const borders = { skip: '1.5px solid rgba(255,59,107,0.3)', like: 'none', info: '1.5px solid rgba(78,255,214,0.3)', watched: '1.5px solid rgba(155,107,255,0.35)' };
  const shadows = { skip: '0 6px 20px rgba(255,59,107,0.2)', like: '0 10px 32px rgba(255,59,107,0.5)', info: '0 6px 20px rgba(78,255,214,0.15)', watched: '0 6px 20px rgba(155,107,255,0.20)' };
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
function MatchOverlay({ movie, members, cartelera = false, onKeep, onOpen }) {
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
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
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
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
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
          ) : cartelera ? (
            // Solo cuando la sala incluyó cartelera y no hay plataforma
            // → la peli es claramente de cines, mostramos showtimes.
            <button
              onClick={() => openShowtimes(movie.title || movie.name)}
              style={{
                width: '100%', height: 52, borderRadius: 999,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.30), rgba(59,130,246,0.16))',
                border: '1.5px solid rgba(96,165,250,0.55)',
                color: '#93C5FD', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', fontFamily: '"Space Grotesk"',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 18px rgba(59,130,246,0.22)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 21s-7-7.5-7-12a7 7 0 1114 0c0 4.5-7 12-7 12z" stroke="#93C5FD" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="12" cy="9" r="2.5" stroke="#93C5FD" strokeWidth="2"/>
              </svg>
              Sesiones cerca de ti
            </button>
          ) : null}
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

// ── MidSessionPause ───────────────────────────────────────────────────────────
function MidSessionPause({ swipeCount, matchCount, members, onContinue, onEnd }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 40); return () => clearTimeout(t); }, []);

  const matchRate = swipeCount > 0 ? Math.round((matchCount / swipeCount) * 100) : 0;

  const statItems = [
    { emoji: '🎬', value: swipeCount, label: 'swipes' },
    { emoji: '💘', value: matchCount, label: matchCount === 1 ? 'match' : 'matches' },
    { emoji: '🎯', value: `${matchRate}%`, label: 'afinidad' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, overflow: 'hidden',
      background: 'radial-gradient(130% 90% at 50% 10%, #1A0A3A 0%, #0B0420 55%, #000 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 28px',
    }}>
      {/* Subtle animated glow */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,59,255,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'fp-glow-pulse 3s ease-in-out infinite',
      }}/>
      <style>{`
        @keyframes fp-glow-pulse {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
          50%       { opacity: 1;   transform: translateX(-50%) scale(1.12); }
        }
      `}</style>

      <div style={{
        position: 'relative', zIndex: 2, width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>

        {/* Popcorn emoji */}
        <div style={{
          fontSize: 68,
          transform: show ? 'scale(1) rotate(-6deg)' : 'scale(0.3) rotate(-40deg)',
          opacity: show ? 1 : 0,
          transition: 'all 0.55s cubic-bezier(.2,.8,.3,1.4)',
        }}>🍿</div>

        {/* Title */}
        <div style={{
          marginTop: 20,
          transform: show ? 'translateY(0)' : 'translateY(20px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.1s',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
            fontSize: 34, fontWeight: 900, lineHeight: 1.05, letterSpacing: -1,
            color: '#fff',
          }}>¿Seguís o lo dejamos?</div>
          <div style={{
            marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.5)',
            fontFamily: '"Space Grotesk", sans-serif', lineHeight: 1.4,
          }}>Lleváis {swipeCount} swipes. Podéis continuar o<br/>ver el resumen de lo que habéis encontrado.</div>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: 28, display: 'flex', gap: 12, width: '100%',
          transform: show ? 'translateY(0)' : 'translateY(18px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.2s',
        }}>
          {statItems.map(s => (
            <div key={s.label} style={{
              flex: 1, borderRadius: 18, padding: '16px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 22 }}>{s.emoji}</div>
              <div style={{
                fontFamily: '"Inter", sans-serif', fontSize: 26, fontWeight: 800,
                color: '#fff', lineHeight: 1.1, marginTop: 4,
              }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Member avatars */}
        <div style={{
          display: 'flex', marginTop: 22,
          transform: show ? 'scale(1)' : 'scale(0.7)',
          opacity: show ? 1 : 0,
          transition: 'all 0.45s 0.28s',
        }}>
          {members.map((u, i) => (
            <div key={u.id} style={{
              marginLeft: i === 0 ? 0 : -10,
              border: '2.5px solid #0B0420', borderRadius: 999,
            }}>
              {u.avatarUrl ? (
                <div style={{ width: 38, height: 38, borderRadius: 999, overflow: 'hidden', background: '#1a0f2e' }}>
                  <img src={u.avatarUrl} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ) : (
                <div style={{
                  width: 38, height: 38, borderRadius: 999,
                  background: memberColor(i), color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, fontFamily: '"Space Grotesk"',
                }}>{(u.name || '?').charAt(0).toUpperCase()}</div>
              )}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{
          marginTop: 28, width: '100%', display: 'flex', flexDirection: 'column', gap: 10,
          transform: show ? 'translateY(0)' : 'translateY(24px)',
          opacity: show ? 1 : 0,
          transition: 'all 0.5s 0.36s',
        }}>
          <button onClick={onContinue} style={{
            width: '100%', height: 58, borderRadius: 999,
            background: FP.flame, border: 'none', color: '#fff',
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 17,
            cursor: 'pointer',
            boxShadow: '0 10px 28px rgba(255,59,107,0.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Seguir deslizando
          </button>
          <button onClick={onEnd} style={{
            width: '100%', height: 54, borderRadius: 999,
            background: 'rgba(78,255,214,0.1)',
            border: '1.5px solid rgba(78,255,214,0.3)',
            color: '#4EFFD6', fontWeight: 700, fontSize: 16,
            cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>✨</span> Ver resumen final
          </button>
        </div>

        {/* Fine print */}
        <div style={{
          marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.25)',
          textAlign: 'center', lineHeight: 1.4,
          opacity: show ? 1 : 0, transition: 'opacity 0.4s 0.5s',
        }}>
          Si finalizáis, se cerrará la sala para ambos y<br/>veréis el análisis completo de la sesión.
        </div>
      </div>
    </div>
  );
}

// ── SwipeLoading — pantalla de carga visual con stack de pósters falsos ─
// que rotan y un mensaje friendly. Mejor que un emoji + texto plano.
function SwipeLoading() {
  // Posters provisionales — gradientes flame para no hacer fetch extra.
  const cards = [
    { gradient: 'linear-gradient(160deg, #1A0F2E, #FF3B6B)' },
    { gradient: 'linear-gradient(160deg, #5B1DB5, #FF6B4A)' },
    { gradient: 'linear-gradient(160deg, #FFB547, #FF3B6B)' },
    { gradient: 'linear-gradient(160deg, #0E0719, #9B3BFF)' },
  ];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 26, padding: '0 24px',
    }}>
      {/* Animated stack */}
      <div style={{
        position: 'relative', width: 180, height: 240,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        perspective: 800,
      }}>
        {/* Halo pulsante detrás */}
        <div style={{
          position: 'absolute', width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,74,0.40) 0%, transparent 60%)',
          filter: 'blur(28px)',
          animation: 'fp-swl-halo 2.4s ease-in-out infinite',
        }}/>
        {cards.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', width: 130, height: 200, borderRadius: 18,
            background: c.gradient,
            boxShadow: '0 18px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: `fp-swl-deal 3.2s ${i * 0.4}s cubic-bezier(.4,.0,.2,1) infinite`,
            transformOrigin: 'center 110%',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 50%)',
              borderRadius: 18,
            }}/>
          </div>
        ))}
      </div>

      {/* Friendly text + small bouncy dots */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        fontFamily: '"Space Grotesk", system-ui',
      }}>
        <div style={{
          fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.4,
          background: 'linear-gradient(135deg, #FFB547 0%, #FF6B4A 30%, #FF3B6B 65%, #9B3BFF 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Preparando vuestras pelis
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,242,255,0.65)' }}>
          Encajando gustos del grupo…
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
              animation: `fp-swl-dot 1.1s ${i * 0.18}s ease-in-out infinite`,
            }}/>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fp-swl-deal {
          0%   { transform: translateY(8px) rotate(-3deg) scale(0.92); opacity: 0; }
          15%  { transform: translateY(0) rotate(-2deg) scale(1); opacity: 1; }
          70%  { transform: translateY(0) rotate(2deg) scale(1); opacity: 1; }
          85%  { transform: translateY(-22px) rotate(8deg) scale(0.95); opacity: 0; }
          100% { transform: translateY(-22px) rotate(8deg) scale(0.95); opacity: 0; }
        }
        @keyframes fp-swl-halo {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes fp-swl-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default MovieSwiper;
