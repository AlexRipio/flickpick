/**
 * Personal watchlist — "Quiero ver" list saved to localStorage.
 * Movies saved here come from TrendingScreen likes / DetailSheet saves.
 */

const KEY = 'flickpick.watchlist.v1';
const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function getWatchlist() { return read(); }

export function isInWatchlist(movieId) {
  return read().some(m => m.id === movieId);
}

/** Returns true if movie was ADDED, false if removed. */
export function toggleWatchlist(movie) {
  const list = read();
  const idx = list.findIndex(m => m.id === movie.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift({ ...movie, savedAt: Date.now() });
  write(list);
  return true;
}

export function subscribeWatchlist(fn) {
  listeners.add(fn);
  // Also sync across tabs
  const onStorage = (e) => { if (e.key === KEY) fn(); };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}
