/**
 * FlickPick Backend API Client
 * All API calls go through flickpick.mov/api (single backend)
 */

function getBaseUrl() {
  return import.meta.env.VITE_API_URL || 'https://flickpick.mov/api';
}

const TOKEN_KEY = 'flickpick.jwt.v1';

// ── Token management ─────────────────────────────────────────────────
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ── Low-level fetch wrapper ──────────────────────────────────────────
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const baseUrl = getBaseUrl();
  // Force `no-store` cache so authenticated GETs (settings, rooms/mine,
  // /me, etc.) never serve stale Safari/HTTP-cached responses. We had a
  // case where /rooms/mine returned a stale empty list because the
  // browser cached an older 0-rooms response.
  const res = await fetch(`${baseUrl}${path}`, { cache: 'no-store', ...options, headers });

  let body;
  try { body = await res.json(); } catch { body = null; }

  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

// ── Auth endpoints ───────────────────────────────────────────────────

export async function apiRegister(email, password, name) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function apiLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function apiVerifyEmail(email, token) {
  const data = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, token }),
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function apiResendVerification(email) {
  return apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiGoogleAuth(googleId, email, name, picture) {
  const data = await apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ googleId, email, name, picture }),
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function apiQaLogin(email, secretCode) {
  const data = await apiFetch('/auth/qa-login', {
    method: 'POST',
    body: JSON.stringify({ email, secretCode }),
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function apiGetMe() {
  try { return await apiFetch('/auth/me'); } catch { return null; }
}

export async function apiLogout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
  setToken(null);
}

export async function apiDeleteAccount(confirm) {
  return apiFetch('/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirm }),
  });
}

// ── Rooms endpoints ──────────────────────────────────────────────────

export async function apiUpsertRoom(room) {
  // PUT /api/rooms/:id is idempotent on the backend (INSERT ON CONFLICT DO UPDATE).
  if (!room?.id) throw new Error('Room id required');
  return apiFetch(`/rooms/${room.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      joinCode: room.joinCode,
      status:   room.status || 'lobby',
      data:     room,
    }),
  });
}

export async function apiCreateRoom(room) {
  if (!room?.id || !room?.joinCode) throw new Error('Room id and joinCode required');
  return apiFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      id:       room.id,
      joinCode: room.joinCode,
      status:   room.status || 'lobby',
      data:     room,
    }),
  });
}

export async function apiGetRoomByCode(code) {
  if (!code) return null;
  return apiFetch(`/rooms/code/${encodeURIComponent(code)}`);
}

export async function apiGetRoomById(id) {
  if (!id) return null;
  return apiFetch(`/rooms/${encodeURIComponent(id)}`);
}

// Returns the list of rooms the current user is a member of (any status).
// Used on login bootstrap to hydrate match history.
export async function apiListMyRooms() {
  try {
    const r = await apiFetch('/rooms/mine');
    const rooms = Array.isArray(r?.rooms) ? r.rooms : [];
    console.info('[userSync] apiListMyRooms →', rooms.length, 'rooms');
    if (rooms.length > 0) {
      console.info('[userSync] sample room:', { id: rooms[0]?.id, status: rooms[0]?.status, members: rooms[0]?.members?.map(m=>m.id) });
    }
    return rooms;
  } catch (e) {
    console.warn('[userSync] apiListMyRooms failed:', e?.message);
    return [];
  }
}

// ── AI avatar endpoints ──────────────────────────────────────────────
// Backend proxies to Hugging Face FLUX.1-schnell. Quota: 1/day per user.
//
// Throws on failure with a meaningful `.message` (already in Spanish from
// the server) so the picker can surface it directly. Codes worth handling:
//   429 — quota_exceeded         → user already generated today
//   503 — model_loading          → cold start, retry in ~30s
//   503 — ai_not_configured      → HF_TOKEN missing on server
//   502 — generation_unavailable → HF connectivity issue
export async function apiGenerateAvatar(style, prompt) {
  return apiFetch('/avatars/generate', {
    method: 'POST',
    body: JSON.stringify({ style: style || null, prompt: prompt || '' }),
  });
}

export async function apiGetAvatarQuota() {
  try { return await apiFetch('/avatars/quota'); } catch { return null; }
}

// ── Feedback / sugerencias ───────────────────────────────────────────
// Backend stores in `feedback` table and emails info@flickpick.mov.
// Rate-limited at 3 submissions per hour per JWT/IP.
export async function apiSendFeedback({ type, message, email, userAgent, path, title }) {
  // New flow: hits /beta/feedback which auto-resolves beta_tester_id by email,
  // tags environment from origin, and feeds the admin inbox.
  try {
    return await apiFetch('/beta/feedback', {
      method: 'POST',
      body: JSON.stringify({ type, title, message, path, metadata: { userAgent, email } }),
    });
  } catch (e) {
    // Fallback to legacy endpoint if new one fails
    return apiFetch('/feedback', {
      method: 'POST',
      body: JSON.stringify({ type, message, email, userAgent, path }),
    });
  }
}
