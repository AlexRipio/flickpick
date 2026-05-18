/**
 * avatarLibrary — personal collection of avatars (AI-generated + uploaded)
 * persisted per user. Lets the user switch between any saved avatar
 * without regenerating or re-uploading.
 *
 * Storage:
 *   - localStorage[`flickpick.avatarLibrary.v1.${userId}`] = Array<AvatarItem>
 *   - synced server-side via user_settings.avatarLibrary (userSync.js)
 *
 * Each item:
 *   { id, type: 'ai'|'upload', url, style?, createdAt }
 *
 * Cap: 10 items. Oldest is dropped on add (FIFO).
 */

const KEY = (userId) => `flickpick.avatarLibrary.v1.${userId}`;
const MAX_ITEMS = 10;

function safeRead(userId) {
  if (!userId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(userId)) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function safeWrite(userId, list) {
  if (!userId) return;
  try { localStorage.setItem(KEY(userId), JSON.stringify(list)); } catch {}
  // Fire a sync event so subscribed UIs re-render.
  try { window.dispatchEvent(new CustomEvent('flickpick:avatar-library-changed')); } catch {}
  // Push to server (debounced inside userSync).
  import('@/lib/userSync').then(({ userSync }) => {
    try { userSync.avatarLibrary?.(list); } catch {}
  }).catch(() => {});
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'av-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getLibrary(userId) {
  return safeRead(userId);
}

/**
 * Add an avatar to the library. Deduplicates by URL — if the same image
 * is already in the library, returns the existing entry without growing
 * the list. Otherwise prepends and trims to MAX_ITEMS.
 */
export function addToLibrary(userId, { type, url, style }) {
  if (!userId || !url) return null;
  const list = safeRead(userId);
  const existing = list.find((a) => a.url === url);
  if (existing) return existing;
  const item = {
    id: uuid(),
    type: type === 'upload' ? 'upload' : 'ai',
    url,
    style: style || null,
    createdAt: Date.now(),
  };
  const next = [item, ...list].slice(0, MAX_ITEMS);
  safeWrite(userId, next);
  return item;
}

export function removeFromLibrary(userId, id) {
  if (!userId || !id) return;
  const list = safeRead(userId);
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return;
  safeWrite(userId, next);
}

export function subscribeLibrary(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  const fn = () => handler();
  window.addEventListener('flickpick:avatar-library-changed', fn);
  window.addEventListener('flickpick:settings-refreshed', fn);
  return () => {
    window.removeEventListener('flickpick:avatar-library-changed', fn);
    window.removeEventListener('flickpick:settings-refreshed', fn);
  };
}
