/**
 * Watchlist + Watched stores — localStorage, cross-tab sync via listeners.
 *
 * "Quiero ver"  → KEY_WANT   (watchlist)
 * "Vistas"      → KEY_WATCHED
 */

const KEY_WANT    = 'flickpick.watchlist.v1';
const KEY_WATCHED = 'flickpick.watched.v1';

const wantListeners    = new Set();
const watchedListeners = new Set();

// ── internal helpers ──────────────────────────────────────────────────────────
function readKey(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeKey(key, list, listeners) {
  localStorage.setItem(key, JSON.stringify(list));
  listeners.forEach(fn => { try { fn(); } catch {} });
}

// ── "Quiero ver" API ──────────────────────────────────────────────────────────
export function getWatchlist()           { return readKey(KEY_WANT); }
export function isInWatchlist(movieId)   { return readKey(KEY_WANT).some(m => m.id === movieId); }

/** Returns true if movie was ADDED, false if removed. */
export function toggleWatchlist(movie) {
  const list = readKey(KEY_WANT);
  const idx  = list.findIndex(m => m.id === movie.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeKey(KEY_WANT, list, wantListeners);
    return false;
  }
  list.unshift({ ...movie, savedAt: Date.now() });
  writeKey(KEY_WANT, list, wantListeners);
  return true;
}

export function removeFromWatchlist(movieId) {
  const list = readKey(KEY_WANT).filter(m => m.id !== movieId);
  writeKey(KEY_WANT, list, wantListeners);
}

export function subscribeWatchlist(fn) {
  wantListeners.add(fn);
  const onStorage = (e) => { if (e.key === KEY_WANT) fn(); };
  window.addEventListener('storage', onStorage);
  return () => { wantListeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

// ── "Vistas" API ──────────────────────────────────────────────────────────────
export function getWatched()             { return readKey(KEY_WATCHED); }
export function isWatched(movieId)       { return readKey(KEY_WATCHED).some(m => m.id === movieId); }

/** Marks a movie as watched — removes from watchlist, adds to watched. */
export function markWatched(movie) {
  // Remove from want list
  const want = readKey(KEY_WANT).filter(m => m.id !== movie.id);
  writeKey(KEY_WANT, want, wantListeners);
  // Add to watched (if not already)
  const watched = readKey(KEY_WATCHED);
  if (!watched.some(m => m.id === movie.id)) {
    watched.unshift({ ...movie, watchedAt: Date.now() });
    writeKey(KEY_WATCHED, watched, watchedListeners);
  }
}

/** Moves a movie from watched back to watchlist. */
export function unmarkWatched(movie) {
  const watched = readKey(KEY_WATCHED).filter(m => m.id !== movie.id);
  writeKey(KEY_WATCHED, watched, watchedListeners);
  // Re-add to watchlist
  const want = readKey(KEY_WANT);
  if (!want.some(m => m.id === movie.id)) {
    want.unshift({ ...movie, savedAt: Date.now() });
    writeKey(KEY_WANT, want, wantListeners);
  }
}

export function removeWatched(movieId) {
  const watched = readKey(KEY_WATCHED).filter(m => m.id !== movieId);
  writeKey(KEY_WATCHED, watched, watchedListeners);
}

export function subscribeWatched(fn) {
  watchedListeners.add(fn);
  const onStorage = (e) => { if (e.key === KEY_WATCHED) fn(); };
  window.addEventListener('storage', onStorage);
  return () => { watchedListeners.delete(fn); window.removeEventListener('storage', onStorage); };
}
