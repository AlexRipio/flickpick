/**
 * App Badging — pinta el numerito rojo sobre el icono de la PWA cuando
 * hay actividad pendiente (matches, peticiones de terminar sala, etc.).
 *
 * Soporte: Android Chrome / Edge / Samsung; desktop Chrome / Edge.
 * iOS Safari NO lo soporta (Apple lo bloquea). En navegadores sin
 * soporte estas funciones son no-op silenciosas.
 *
 * Uso:
 *   import { setBadge, clearBadge, recomputeBadge } from '@/lib/badging';
 *   recomputeBadge(profileId); // calcula desde rooms/matches y aplica
 */

function supported() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.setAppBadge === 'function';
}

export function setBadge(count) {
  if (!supported()) return;
  try {
    if (!count || count <= 0) navigator.clearAppBadge?.();
    else navigator.setAppBadge(count);
  } catch {}
}

export function clearBadge() {
  if (!supported()) return;
  try { navigator.clearAppBadge?.(); } catch {}
}

/**
 * Reads localStorage rooms and computes badge count = number of unread
 * pending events for the user. Currently:
 *   + 1 per active end-room request waiting for host approval (room.endRequest exists)
 *   + 1 per match that the user hasn't seen yet (room.matches with seenBy not including userId)
 * Throttled to once every 500ms to avoid hammering when many rooms update.
 */
// Matches older than this window stop contributing to the badge even
// when seenBy[] was never written for them. Prevents the badge from
// growing unbounded with the user's full match history.
const MATCH_FRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let recomputeTimer = null;
export function recomputeBadge(profileId) {
  if (!supported()) return;
  if (recomputeTimer) return; // already scheduled
  recomputeTimer = setTimeout(() => {
    recomputeTimer = null;
    try {
      let count = 0;
      const cutoff = Date.now() - MATCH_FRESH_WINDOW_MS;
      const all = JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}');
      for (const r of Object.values(all)) {
        if (!r || !profileId) continue;
        // Closed rooms never contribute notifications.
        if (r.status === 'ended') continue;
        const isMember = r.members?.some(m => m.id === profileId);
        const isOwner  = r.ownerId === profileId;
        if (!isMember && !isOwner) continue;
        // End-room request pending and not from this user (host needs to act)
        if (isOwner && r.endRequest && r.endRequest.memberId !== profileId) count += 1;
        // Unseen matches in the freshness window
        if (Array.isArray(r.matches)) {
          for (const m of r.matches) {
            if (!m) continue;
            const seen = Array.isArray(m.seenBy) ? m.seenBy : [];
            if (seen.includes(profileId)) continue;
            const ts = m.matchedAt || m.createdAt || 0;
            if (ts && ts < cutoff) continue;
            count += 1;
          }
        }
      }
      setBadge(count);
    } catch {}
  }, 500);
}
