/**
 * User Settings Sync — keep user data in lockstep with the backend so
 * a logout/uninstall/device change never loses progress.
 *
 * Server: GET/PATCH /api/user/settings, returns/accepts a JSONB blob.
 * Local: writes go to localStorage AND debounced-PATCH to backend.
 *
 * On post-login bootstrap:
 *   1. Fetch server blob.
 *   2. For each key, prefer server value if present (server is source
 *      of truth for cross-device).
 *   3. Apply to localStorage so the rest of the app reads the synced
 *      state without changes.
 */

import { apiFetch, apiListMyRooms } from '@/lib/api';

// ── Storage key helpers (mirror keys used elsewhere in the app) ──────
const KEYS = {
  watchlist:      'flickpick.watchlist.v1',
  watched:        'flickpick.watched.v1',
  listView:       'flickpick.list-view',
  haptic:         'flickpick.haptic.v1',
  consent:        'flickpick.consent.v1',
  top10Movies:    'flickpick.top10.order.movies',
  top10Series:    'flickpick.top10.order.series',
  top10Cartelera: 'flickpick.top10.order.cartelera',
  navHidden:      'fp.nav.hidden',
};

const PER_USER_KEYS = {
  avatar:      (id) => `flickpick.avatar.v1.${id}`,
  onboarding:  (id) => `flickpick.onboarding.seen.${id}`,
  updatesSeen: (id) => `flickpick.updates.lastSeen.${id}`,
};

// ── Server I/O ───────────────────────────────────────────────────────
export async function fetchUserSettings() {
  try {
    const res = await apiFetch('/user/settings');
    console.info('[userSync] fetchUserSettings →', res);
    return res?.data || {};
  } catch (e) {
    console.warn('[userSync] fetchUserSettings failed:', e?.message);
    return null;
  }
}

// Short debounce — just enough to coalesce rapid bursts (e.g. drag
// reorder of Top10 firing 10 saves in 200ms) without losing data on
// tab close. We also flush on pagehide via fetch keepalive.
const PUSH_DEBOUNCE_MS = 200;
let pushTimer = null;
let pendingPatch = {};

// Get JWT directly so we can build a `keepalive: true` fetch that
// survives the page being unloaded (sendBeacon-style).
function getJwt() {
  try { return localStorage.getItem('flickpick.jwt.v1'); } catch { return null; }
}
function getApiBase() {
  // Mirror logic in lib/api.js
  try { return import.meta.env.VITE_API_URL || 'https://flickpick.mov/api'; } catch { return 'https://flickpick.mov/api'; }
}

function sendPatch(patch, { keepalive = false } = {}) {
  if (!patch || Object.keys(patch).length === 0) return Promise.resolve();
  const jwt = getJwt();
  if (!jwt) {
    console.warn('[userSync] push skipped — no JWT');
    return Promise.resolve();
  }
  const url = getApiBase() + '/user/settings';
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt };
  const body = JSON.stringify(patch);
  return fetch(url, { method: 'PATCH', headers, body, keepalive })
    .then(async (r) => {
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        console.warn('[userSync] PATCH failed', r.status, txt);
      } else {
        console.info('[userSync] PATCH ok', Object.keys(patch));
      }
    })
    .catch((e) => console.warn('[userSync] PATCH error:', e?.message));
}

function flushPush() {
  pushTimer = null;
  const patch = pendingPatch;
  pendingPatch = {};
  if (Object.keys(patch).length === 0) return;
  sendPatch(patch);
}

export function pushUserSettings(patch) {
  if (!patch || typeof patch !== 'object') return;
  pendingPatch = { ...pendingPatch, ...patch };
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, PUSH_DEBOUNCE_MS);
}

// Synchronous flush — guarantees the patch goes out even if the page
// is being unloaded. Uses `fetch keepalive` (modern browsers' equivalent
// of navigator.sendBeacon for arbitrary methods/headers).
export function flushPushSync() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const patch = pendingPatch;
  pendingPatch = {};
  if (Object.keys(patch).length === 0) return;
  sendPatch(patch, { keepalive: true });
}

// Install once: ensure pending changes are flushed when the tab is
// hidden or about to close. iOS Safari fires `visibilitychange` more
// reliably than `beforeunload`/`pagehide` on PWA standalone.
let unloadHandlerInstalled = false;
function installUnloadFlush() {
  if (unloadHandlerInstalled) return;
  unloadHandlerInstalled = true;
  const handler = () => { try { flushPushSync(); } catch {} };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handler();
  });
  window.addEventListener('pagehide', handler);
  window.addEventListener('beforeunload', handler);
}
if (typeof window !== 'undefined') installUnloadFlush();

// ── Apply server blob to localStorage (post-login) ───────────────────
function writeIfPresent(key, value, encoder = JSON.stringify) {
  if (value === undefined || value === null) return;
  try { localStorage.setItem(key, encoder(value)); } catch {}
}
function writeStringIfPresent(key, value) {
  if (value === undefined || value === null) return;
  try { localStorage.setItem(key, String(value)); } catch {}
}

/**
 * Hydrate localStorage from a server settings blob.
 * Called once after login. Server is source of truth for cross-device
 * fields. Local-only changes made before login (offline guest mode)
 * are pushed UP to server here too via ensureLocalPushed().
 */
export function applyServerSettings(profileId, data) {
  if (!data || typeof data !== 'object') return;

  // Avatar
  if (data.avatar && profileId) {
    writeIfPresent(PER_USER_KEYS.avatar(profileId), data.avatar);
  }

  // Watchlist / Watched
  if (Array.isArray(data.watchlist))      writeIfPresent(KEYS.watchlist, data.watchlist);
  if (Array.isArray(data.watched))        writeIfPresent(KEYS.watched, data.watched);

  // Onboarding & updates
  if (profileId && data.onboardingSeen)   writeStringIfPresent(PER_USER_KEYS.onboarding(profileId), '1');
  if (profileId && data.updatesLastSeen)  writeStringIfPresent(PER_USER_KEYS.updatesSeen(profileId), data.updatesLastSeen);

  // Top10 ordering
  if (Array.isArray(data.top10Movies))    writeIfPresent(KEYS.top10Movies, data.top10Movies);
  if (Array.isArray(data.top10Series))    writeIfPresent(KEYS.top10Series, data.top10Series);
  if (Array.isArray(data.top10Cartelera)) writeIfPresent(KEYS.top10Cartelera, data.top10Cartelera);

  // Misc prefs
  if (data.listView)  writeStringIfPresent(KEYS.listView, data.listView);
  if (data.haptic !== undefined) writeStringIfPresent(KEYS.haptic, data.haptic ? '1' : '0');
  if (data.consent)   writeStringIfPresent(KEYS.consent, data.consent);
  if (data.navHidden !== undefined) writeStringIfPresent(KEYS.navHidden, data.navHidden ? '1' : '0');
}

/**
 * Push currently-stored local values up so the server has them too.
 * Used right after first bootstrap if server was empty (new account or
 * pre-sync user) — captures any state that existed offline.
 */
export function pushLocalSnapshot(profileId) {
  const patch = {};
  // Avatar
  if (profileId) {
    try {
      const a = JSON.parse(localStorage.getItem(PER_USER_KEYS.avatar(profileId)) || 'null');
      if (a) patch.avatar = a;
    } catch {}
  }
  // Lists
  try {
    const wl = JSON.parse(localStorage.getItem(KEYS.watchlist) || '[]');
    if (Array.isArray(wl) && wl.length) patch.watchlist = wl;
  } catch {}
  try {
    const wd = JSON.parse(localStorage.getItem(KEYS.watched) || '[]');
    if (Array.isArray(wd) && wd.length) patch.watched = wd;
  } catch {}
  // Onboarding
  if (profileId && localStorage.getItem(PER_USER_KEYS.onboarding(profileId)) === '1') {
    patch.onboardingSeen = true;
  }
  if (profileId) {
    const uv = localStorage.getItem(PER_USER_KEYS.updatesSeen(profileId));
    if (uv) patch.updatesLastSeen = uv;
  }
  // Top10
  for (const [field, key] of [
    ['top10Movies', KEYS.top10Movies],
    ['top10Series', KEYS.top10Series],
    ['top10Cartelera', KEYS.top10Cartelera],
  ]) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(v) && v.length) patch[field] = v;
    } catch {}
  }
  // Misc
  const lv = localStorage.getItem(KEYS.listView);  if (lv) patch.listView = lv;
  const hp = localStorage.getItem(KEYS.haptic);    if (hp !== null) patch.haptic = hp === '1';
  const cs = localStorage.getItem(KEYS.consent);   if (cs) patch.consent = cs;
  const nh = localStorage.getItem(KEYS.navHidden); if (nh !== null) patch.navHidden = nh === '1';

  if (Object.keys(patch).length) pushUserSettings(patch);
}

/**
 * Full post-login bootstrap. Idempotent.
 *
 * Flow:
 *   1. Fetch server settings.
 *   2. If non-empty: apply to localStorage (server wins).
 *   3. If empty: push current local state up so this user's first device
 *      seeds the server.
 *   4. After applying, also push local-only fields the server didn't
 *      have (merge of both directions).
 */
export async function bootstrapUserSettings(profileId) {
  if (!profileId) return;
  console.info('[userSync] bootstrap start, profileId=', profileId);
  const data = await fetchUserSettings();
  if (data !== null) {
    const serverEmpty = !data || Object.keys(data).length === 0;
    console.info('[userSync] server data:', serverEmpty ? 'EMPTY' : Object.keys(data));
    if (!serverEmpty) {
      applyServerSettings(profileId, data);
      console.info('[userSync] applied server settings to localStorage');
    }
    // Always push a snapshot of our local state — fields the server
    // already has will be merged (last-write-wins per field), fields it
    // didn't have will be added.
    pushLocalSnapshot(profileId);
    console.info('[userSync] pushed local snapshot to seed/merge server');
  }

  // Rooms (match history) — bidirectional sync.
  //   1) PULL: fetch all server rooms where this user is member/owner,
  //      merge into localStorage.
  //   2) PUSH: re-push every local room (idempotent upsert) so any
  //      room that was created offline / with a failed initial push
  //      ends up on the server. Both directions on every bootstrap
  //      means you can create a room on web, open the PWA, and see it
  //      automatically with NO manual sync.
  try {
    const rooms = await apiListMyRooms();
    if (Array.isArray(rooms) && rooms.length) {
      const ROOMS_KEY = 'flickpick.rooms.v1';
      let local = {};
      try { local = JSON.parse(localStorage.getItem(ROOMS_KEY) || '{}'); } catch {}
      for (const r of rooms) {
        if (!r || !r.id) continue;
        local[r.id] = { ...(local[r.id] || {}), ...r };
      }
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(local)); } catch {}
    }
  } catch (e) {
    console.warn('[userSync] rooms hydrate failed:', e?.message);
  }
  // Auto-push: take any local rooms that may not yet be on server (or
  // were saved before this user was logged in) and upsert them. Silent
  // background — non-blocking.
  try {
    const result = await repushLocalRooms(profileId);
    if (result.total > 0) {
      console.info(`[userSync] auto-repush rooms: ${result.pushed}/${result.total} (errors: ${result.errors})`);
    }
  } catch (e) {
    console.warn('[userSync] auto-repush failed:', e?.message);
  }

  // CRITICAL: notify subscribed components (watchlist, profile avatar,
  // matches list, top10 sections, etc.) so they re-render with the
  // freshly hydrated localStorage. Without this, components mounted
  // before bootstrap finished keep showing empty/stale state — the
  // exact reason the user perceived "sync only works when I press
  // the button" (the manual sync was the only path that fired this
  // event).
  try {
    window.dispatchEvent(new CustomEvent('flickpick:settings-refreshed'));
    console.info('[userSync] bootstrap done — dispatched refresh event');
  } catch {}
}

/**
 * Refresh server settings without re-running pushLocalSnapshot. Used on
 * tab focus / visibility change to pick up changes made on another
 * device or browser tab.
 */
export async function refreshUserSettings(profileId) {
  if (!profileId) return;
  const data = await fetchUserSettings();
  if (data && Object.keys(data).length > 0) {
    applyServerSettings(profileId, data);
  }
  // ALWAYS hydrate rooms (separate table). Server may be empty for
  // settings but have rooms.
  try {
    const rooms = await apiListMyRooms();
    if (Array.isArray(rooms) && rooms.length) {
      const ROOMS_KEY = 'flickpick.rooms.v1';
      let local = {};
      try { local = JSON.parse(localStorage.getItem(ROOMS_KEY) || '{}'); } catch {}
      for (const r of rooms) {
        if (!r || !r.id) continue;
        local[r.id] = { ...(local[r.id] || {}), ...r };
      }
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(local)); } catch {}
    }
  } catch {}
  // Auto-push local rooms back to server (idempotent). Catches rooms
  // whose initial push failed silently (network blip, JWT race, etc).
  try { await repushLocalRooms(profileId); } catch {}
  // ALWAYS dispatch the event so subscribed components (watchlist,
  // matches list, profile avatar, etc.) re-render even if server data
  // was empty (we may have hydrated rooms only, or just want to confirm
  // current state).
  try { window.dispatchEvent(new CustomEvent('flickpick:settings-refreshed')); } catch {}
}

let visibilityHandlerInstalled = false;
let visibilityProfileId = null;
export function installVisibilityRefresh(profileId) {
  visibilityProfileId = profileId;
  if (visibilityHandlerInstalled) return;
  visibilityHandlerInstalled = true;
  let lastFetch = 0;
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!visibilityProfileId) return;
    const now = Date.now();
    if (now - lastFetch < 5_000) return; // throttle: max one fetch per 5s
    lastFetch = now;
    refreshUserSettings(visibilityProfileId).catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
}

// ── Field-level helpers used by writers ─────────────────────────────
export const userSync = {
  avatar(value)        { pushUserSettings({ avatar: value }); },
  watchlist(arr)       { pushUserSettings({ watchlist: arr }); },
  watched(arr)         { pushUserSettings({ watched: arr }); },
  onboardingSeen(v=true){ pushUserSettings({ onboardingSeen: !!v }); },
  updatesLastSeen(v)   { pushUserSettings({ updatesLastSeen: String(v) }); },
  top10Movies(arr)     { pushUserSettings({ top10Movies: arr }); },
  top10Series(arr)     { pushUserSettings({ top10Series: arr }); },
  top10Cartelera(arr)  { pushUserSettings({ top10Cartelera: arr }); },
  listView(v)          { pushUserSettings({ listView: v }); },
  haptic(on)           { pushUserSettings({ haptic: !!on }); },
  consent(v)           { pushUserSettings({ consent: v }); },
  navHidden(on)        { pushUserSettings({ navHidden: !!on }); },
};

// Strict v4-ish UUID detector. Backend `rooms.id` is PostgreSQL UUID
// type — a non-UUID id silently fails the INSERT. Old rooms created
// before crypto.randomUUID was available may have ids like "u-abc123".
function isValidUuid(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function newUuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Walk local rooms and re-push each one to the server. Idempotent.
 * - Detects rooms with invalid UUID ids and regenerates them in-place
 *   in localStorage (rare but possible for very old rooms).
 * - Ensures the current user is in `members` and `ownerId` so the
 *   server-side /mine query finds them on subsequent fetches.
 * Auto-runs from bootstrap and refresh — no user interaction needed.
 */
export async function repushLocalRooms(profileId) {
  if (!profileId) return { pushed: 0, total: 0, errors: 0 };
  const ROOMS_KEY = 'flickpick.rooms.v1';
  let local = {};
  try { local = JSON.parse(localStorage.getItem(ROOMS_KEY) || '{}'); } catch {}
  const entries = Object.entries(local).filter(([, r]) => r && r.id);
  let pushed = 0, errors = 0, regenerated = 0;
  const { apiUpsertRoom } = await import('@/lib/api');
  let mutated = false;
  for (const [oldKey, r] of entries) {
    let room = { ...r };
    // Regenerate invalid UUID ids
    if (!isValidUuid(room.id)) {
      const newId = newUuidV4();
      console.info('[userSync] regenerating invalid room id', room.id, '→', newId);
      room.id = newId;
      delete local[oldKey];
      local[newId] = room;
      mutated = true;
      regenerated += 1;
    }
    room.ownerId = room.ownerId || profileId;
    if (!Array.isArray(room.members)) room.members = [];
    if (!room.members.some(m => m.id === profileId)) {
      room.members = [...room.members, { id: profileId, name: 'Yo', isHost: true, taste: { likes: 0, skips: 0 } }];
      mutated = true;
      local[room.id] = room;
    }
    try {
      await apiUpsertRoom(room);
      pushed += 1;
    } catch (e) {
      errors += 1;
      console.warn('[userSync] repush failed for', room.id, e?.message);
    }
  }
  if (mutated) {
    try { localStorage.setItem(ROOMS_KEY, JSON.stringify(local)); } catch {}
  }
  if (entries.length > 0) {
    console.info(`[userSync] repushLocalRooms: pushed=${pushed} errors=${errors} regenerated=${regenerated} total=${entries.length}`);
  }
  return { pushed, errors, total: entries.length, regenerated };
}

/**
 * Manual sync trigger for the "Sincronizar ahora" button. Flushes any
 * pending push, then re-fetches and applies server state.
 * Returns { ok, durationMs } for UI feedback.
 */
export async function manualSyncNow(profileId) {
  const t0 = Date.now();
  if (!profileId) return { ok: false, error: 'no-profile' };
  // Flush pending debounced push immediately.
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (Object.keys(pendingPatch).length > 0) {
      try {
        await apiFetch('/user/settings', {
          method: 'PATCH',
          body: JSON.stringify(pendingPatch),
        });
        pendingPatch = {};
      } catch (e) {
        console.warn('manualSync: flush push failed:', e?.message);
      }
    }
  }
  // Count local rooms before sync
  let localCount = 0;
  try {
    const local = JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}');
    localCount = Object.values(local).filter(r => r && r.id).length;
  } catch {}
  // Explicit repush so we get the result counts.
  let pushed = 0, errors = 0;
  try {
    const r = await repushLocalRooms(profileId);
    pushed = r.pushed; errors = r.errors;
  } catch {}
  try {
    await refreshUserSettings(profileId);
    // Diagnostic: how many rooms does the server have for this user?
    let roomsCount = 0;
    try {
      const rooms = await apiListMyRooms();
      roomsCount = Array.isArray(rooms) ? rooms.length : 0;
    } catch {}
    return { ok: true, durationMs: Date.now() - t0, profileId, roomsCount, localCount, pushed, errors };
  } catch (e) {
    return { ok: false, error: e?.message || 'unknown', localCount, pushed, errors };
  }
}
