/**
 * Multi-device room sync.
 *
 * Transport strategy:
 *   1. PRIMARY: HTTP polling (works on every host, no proxy modules needed).
 *      Each subscriber polls /api/rooms/:id every POLL_MS and fires
 *      onRemoteUpdate when `updated_at` changes.
 *   2. SECONDARY: WebSocket attempt — if `wss://flickpick.mov/ws` opens
 *      successfully we use it for instant pushes; if it errors or never
 *      opens (e.g. Apache mod_proxy_wstunnel not loaded) we silently
 *      fall back to polling. The two transports are idempotent: receiving
 *      the same update twice is safe (mergeRooms is a deep union).
 *
 * Why this hybrid: Dinahosting shared hosting blocks WS upgrades, so
 * production must work without WS. Local dev / VPS deployments DO get
 * the instant push benefit for free.
 */

import { getToken } from './api';

// Configurable poll cadence — fast enough to feel real-time, slow enough
// to keep load down on shared hosting.
const POLL_MS = 1500;
// Max poll cadence after the tab is hidden — saves battery / bandwidth.
const POLL_HIDDEN_MS = 5000;

const WS_URL = (import.meta.env.VITE_API_URL || 'https://flickpick.mov/api')
  .replace(/^http/, 'ws')
  .replace(/\/api$/, '/ws');

// Legacy export — some modules still import this from before the
// Supabase removal. Kept to avoid breaking imports.
export const hasSupabase = false;

// roomId -> { ws?: WebSocket, pollHandle?: number, lastUpdatedAt?: string }
const SUBS = new Map();

let onRemoteUpdate = null;
export function setOnRemoteUpdate(cb) { onRemoteUpdate = cb; }

// ── Helpers ────────────────────────────────────────────────────────
function unwrapRow(row) {
  if (!row) return null;
  if (row.data && typeof row.data === 'object') {
    return { ...row.data, id: row.id || row.data.id, joinCode: row.join_code || row.data.joinCode };
  }
  return row;
}

async function fetchRoomRow(id) {
  try {
    const { apiGetRoomById } = await import('./api');
    return await apiGetRoomById(id);
  } catch { return null; }
}

export async function fetchRoomByCode(code) {
  if (!code) return null;
  try {
    const { apiGetRoomByCode } = await import('./api');
    const row = await apiGetRoomByCode(String(code).toUpperCase());
    return unwrapRow(row);
  } catch { return null; }
}

export async function fetchRoomById(id) {
  if (!id) return null;
  const row = await fetchRoomRow(id);
  return unwrapRow(row);
}

// ── Polling loop ───────────────────────────────────────────────────
async function pollOnce(roomId) {
  const sub = SUBS.get(roomId);
  if (!sub) return;
  const row = await fetchRoomRow(roomId);
  if (!row || !sub) return;
  // Ignore stale responses if the subscription was cancelled meanwhile.
  if (!SUBS.has(roomId)) return;
  const stamp = row.updated_at || row.updatedAt || '';
  if (stamp && sub.lastUpdatedAt === stamp) return;
  sub.lastUpdatedAt = stamp;
  const room = unwrapRow(row);
  if (room && typeof onRemoteUpdate === 'function') onRemoteUpdate(room);
}

function schedulePoll(roomId) {
  const sub = SUBS.get(roomId);
  if (!sub) return;
  const delay = document.visibilityState === 'hidden' ? POLL_HIDDEN_MS : POLL_MS;
  sub.pollHandle = window.setTimeout(async () => {
    await pollOnce(roomId);
    if (SUBS.has(roomId)) schedulePoll(roomId);
  }, delay);
}

// ── Optional WebSocket (best-effort, optional acceleration) ────────
function tryOpenWs(roomId) {
  let ws;
  try { ws = new WebSocket(WS_URL); } catch { return; }
  const sub = SUBS.get(roomId);
  if (!sub) { try { ws.close(); } catch {} return; }
  sub.ws = ws;

  ws.onopen = () => {
    const token = getToken();
    try { ws.send(JSON.stringify({ type: 'join', roomId, token })); } catch {}
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'room_updated' && msg.room) {
        const room = unwrapRow(msg.room);
        if (room && typeof onRemoteUpdate === 'function') onRemoteUpdate(room);
      }
    } catch {}
  };
  // Errors are silent — polling carries the load.
  ws.onerror = () => {};
  ws.onclose = () => {
    const s = SUBS.get(roomId);
    if (s && s.ws === ws) s.ws = null;
  };
}

// ── Subscribe / unsubscribe ────────────────────────────────────────
export function subscribeToRoom(roomId) {
  if (!roomId) return () => {};
  if (SUBS.has(roomId)) return () => {}; // idempotent

  const sub = { ws: null, pollHandle: null, lastUpdatedAt: null };
  SUBS.set(roomId, sub);

  // Kick off both transports. Polling is the source of truth; WS is a
  // best-effort accelerator that may or may not connect.
  schedulePoll(roomId);
  tryOpenWs(roomId);

  return () => {
    const s = SUBS.get(roomId);
    if (!s) return;
    if (s.pollHandle) { clearTimeout(s.pollHandle); s.pollHandle = null; }
    if (s.ws) {
      try {
        if (s.ws.readyState === 1) s.ws.send(JSON.stringify({ type: 'leave', roomId }));
        s.ws.close();
      } catch {}
    }
    SUBS.delete(roomId);
  };
}

// ── Push local room → backend ──────────────────────────────────────
// Single source of truth: HTTP UPSERT. The backend rebroadcasts to any
// WS subscribers AND every subscribed client sees the change on its
// next poll tick (≤ POLL_MS). This is the line that makes the host's
// lobby refresh when a guest joins from another device.
export async function pushRoom(room) {
  if (!room?.id) return;
  try {
    const { apiUpsertRoom } = await import('./api');
    await apiUpsertRoom(room);
  } catch { /* non-fatal — next saveRoom call retries */ }

  // Opportunistic WS push — if a socket is open, instant fan-out;
  // otherwise polling on the other end picks the change up.
  const sub = SUBS.get(room.id);
  if (sub?.ws && sub.ws.readyState === 1) {
    try { sub.ws.send(JSON.stringify({ type: 'update', roomId: room.id, roomData: room })); } catch {}
  }
}

// React to tab visibility — when the user comes back, poll immediately
// so the lobby doesn't show stale state.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    for (const roomId of SUBS.keys()) pollOnce(roomId);
  });
}
