/**
 * activeRoom.js — single source of truth for "does this user have an
 * active room?". BottomNav (FAB gating) and HomeScreen (resume card)
 * had their own variants; centralising it keeps the two views in sync.
 *
 * A room is active if:
 *   - it exists in localStorage
 *   - status !== 'ended'
 *   - user is owner OR member
 *   - last touched within the 6h window
 *   - hasn't been dismissed via the home swipe
 */

const ROOMS_KEY     = 'flickpick.rooms.v1';
const DISMISSED_KEY = 'flickpick.dismissedRooms.v1';
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

function readAll() {
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || '{}'); }
  catch { return {}; }
}
function readDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch { return new Set(); }
}
function lastTouchedAt(r) {
  const t = r.updatedAt || r.lastMatchAt || r.createdAt || 0;
  if (typeof t === 'string') return Date.parse(t) || 0;
  return t || 0;
}

export function findActiveRoomForUser(profileId) {
  if (!profileId) return null;
  const all = readAll();
  const dismissed = readDismissed();
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  let active = null;
  for (const r of Object.values(all)) {
    if (!r || r.status === 'ended') continue;
    if (dismissed.has(r.id)) continue;
    if (lastTouchedAt(r) < cutoff) continue;
    const isMember = r.members?.some((m) => m.id === profileId);
    const isOwner  = r.ownerId === profileId;
    if (!isMember && !isOwner) continue;
    if (!active || lastTouchedAt(r) > lastTouchedAt(active)) active = r;
  }
  return active;
}

export function pathForRoom(room) {
  if (!room?.id) return '/home';
  return room.status === 'lobby' ? `/room/${room.id}/lobby` : `/room/${room.id}`;
}
