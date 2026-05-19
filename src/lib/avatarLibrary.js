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
 * Caps per type — the user MUST remove one to add another:
 *   - upload (foto subida): 1
 *   - ai (avatares IA):     4
 *
 * Hard caps (not FIFO) so the user controls what stays. Trying to add
 * past the limit throws an Error with .code = 'LIBRARY_FULL'.
 */

const KEY = (userId) => `flickpick.avatarLibrary.v1.${userId}`;
export const MAX_UPLOAD = 1;
export const MAX_AI = 4;

export function countByType(list) {
  const out = { upload: 0, ai: 0 };
  for (const a of (Array.isArray(list) ? list : [])) {
    if (a?.type === 'upload') out.upload += 1;
    else if (a?.type === 'ai') out.ai += 1;
  }
  return out;
}

export function canAddToLibrary(userId, type) {
  const list = safeRead(userId);
  const counts = countByType(list);
  if (type === 'upload') return counts.upload < MAX_UPLOAD;
  return counts.ai < MAX_AI;
}

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
 * Add an avatar to the library.
 *  - Deduplicates by URL: if the same image is already saved, returns
 *    the existing entry (no error).
 *  - Enforces per-type caps. If full, throws Error with code 'LIBRARY_FULL'
 *    so the caller can surface a clear message and refuse the save.
 */
export function addToLibrary(userId, { type, url, style }) {
  if (!userId || !url) return null;
  const list = safeRead(userId);
  const existing = list.find((a) => a.url === url);
  if (existing) return existing;

  const kind = type === 'upload' ? 'upload' : 'ai';
  const counts = countByType(list);
  const limit  = kind === 'upload' ? MAX_UPLOAD : MAX_AI;
  if (counts[kind] >= limit) {
    const message = kind === 'upload'
      ? 'Solo puedes guardar 1 foto. Borra la actual antes de subir otra.'
      : `Tu galería de avatares IA está llena (${MAX_AI}). Borra uno para añadir este.`;
    const err = new Error(message);
    err.code = 'LIBRARY_FULL';
    err.kind = kind;
    throw err;
  }

  const item = {
    id: uuid(),
    type: kind,
    url,
    style: style || null,
    createdAt: Date.now(),
  };
  const next = [item, ...list];
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
