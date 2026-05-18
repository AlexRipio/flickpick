/**
 * Client-side room store. Rooms live in localStorage; changes fan out to
 * other tabs/windows on the same device via BroadcastChannel so the
 * lobby, votes, and matches stay in sync without a backend.
 *
 * Data shape:
 *   rooms[roomId] = {
 *     id, name, joinCode, ownerId, status: 'lobby'|'live'|'ended',
 *     preferences: { platforms, yearFrom, yearTo },
 *     members: [{ id, name, isHost, taste }],
 *     votes: { [memberId]: { [movieId]: 'like'|'skip' } },
 *     matches: [{ movieId, movie, matchedAt }],
 *     createdAt,
 *   }
 */

import { emptyTaste, updateTaste } from "@/lib/matchmaking";
import { fetchRoomByCode, fetchRoomById, pushRoom, setOnRemoteUpdate, subscribeToRoom } from "@/lib/roomSync";

const STORAGE_KEY = "flickpick.rooms.v1";
const CODES_KEY = "flickpick.codes.v1";
const CHANNEL = "flickpick-rooms";

const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
const listeners = new Set();

function readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function writeAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function readCodes() {
  try { return JSON.parse(localStorage.getItem(CODES_KEY) || "{}"); } catch { return {}; }
}
function writeCodes(map) {
  localStorage.setItem(CODES_KEY, JSON.stringify(map));
}

function notify(roomId) {
  listeners.forEach(fn => { try { fn(roomId); } catch {} });
}

if (bc) bc.onmessage = (e) => { if (e?.data?.roomId) notify(e.data.roomId); };
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) notify(null);
});
// Cross-device sync: when bootstrap/refresh hydrates rooms localStorage
// directly, fire the same notification so MatchesHistory/HomeScreen
// re-render with the new rooms without waiting for navigation.
window.addEventListener("flickpick:settings-refreshed", () => notify(null));

function broadcast(roomId) {
  if (bc) bc.postMessage({ roomId });
  notify(roomId);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "r-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getRoom(roomId) {
  return readAll()[roomId] || null;
}

export function findRoomByCode(code) {
  const codes = readCodes();
  const id = codes[code.toUpperCase()];
  return id ? getRoom(id) : null;
}

function saveRoom(room, { skipPush = false } = {}) {
  const stamped = { ...room, updatedAt: Date.now() };
  const all = readAll();
  all[stamped.id] = stamped;
  writeAll(all);
  const codes = readCodes();
  codes[stamped.joinCode] = stamped.id;
  writeCodes(codes);
  broadcast(stamped.id);
  if (!skipPush) pushRoom(stamped);
  return stamped;
}

// Deep-merge two room snapshots: votes union, members union, most-advanced status.
function mergeRooms(local, remote) {
  // votes: take union of all member votes
  const votes = { ...local.votes };
  for (const [memberId, memberVotes] of Object.entries(remote.votes || {})) {
    votes[memberId] = { ...(votes[memberId] || {}), ...memberVotes };
  }
  // members: prefer remote shape, keep all ids
  const memberMap = {};
  for (const m of [...(local.members || []), ...(remote.members || [])]) memberMap[m.id] = m;
  const members = Object.values(memberMap);
  // matches: union by movieId
  const matchMap = {};
  for (const m of [...(local.matches || []), ...(remote.matches || [])]) matchMap[m.movieId] = m;
  const matches = Object.values(matchMap);
  // status: most advanced wins
  const ord = { lobby: 0, live: 1, ended: 2 };
  const status = (ord[remote.status] ?? 0) >= (ord[local.status] ?? 0) ? remote.status : local.status;
  return { ...remote, votes, members, matches, status };
}

// Remote updates (FlickPick backend WS / polling) → deep-merge into local store.
setOnRemoteUpdate((remote) => {
  if (!remote || !remote.id) return;
  const local = getRoom(remote.id);
  const merged = local ? mergeRooms(local, remote) : remote;
  saveRoom(merged, { skipPush: true });
});

/** Hydrate a room from the cloud if we don't have it locally. */
export async function hydrateRoomByCode(code) {
  const local = findRoomByCode(code);
  if (local) { subscribeToRoom(local.id); return local; }
  const remote = await fetchRoomByCode(code);
  if (remote) {
    saveRoom(remote, { skipPush: true });
    subscribeToRoom(remote.id);
    return remote;
  }
  return null;
}

export async function hydrateRoomById(id) {
  const local = getRoom(id);
  if (local) { subscribeToRoom(id); return local; }
  const remote = await fetchRoomById(id);
  if (remote) { saveRoom(remote, { skipPush: true }); subscribeToRoom(id); return remote; }
  return null;
}

export async function createRoom({ name, preferences, host }) {
  const id = uuid();
  const joinCode = randomCode();
  const room = {
    id,
    name,
    joinCode,
    ownerId: host.id,
    status: "lobby",
    preferences,
    members: [{ id: host.id, name: host.name, avatarUrl: host.avatarUrl || null, isHost: true, taste: emptyTaste() }],
    votes: { [host.id]: {} },
    matches: [],
    createdAt: Date.now(),
  };
  // 1. Save locally first (instant UI update for the host).
  const saved = saveRoom(room, { skipPush: true });

  // 2. Persist to backend BEFORE opening the WS subscription so the
  //    server's `handleJoinRoom` finds the row in the DB. We swallow
  //    errors here so the host can still operate offline if the API
  //    is momentarily unreachable — the next saveRoom() will retry.
  try {
    const { apiCreateRoom } = await import('./api');
    await apiCreateRoom(saved);
  } catch (e) {
    console.warn('createRoom: backend persist failed, will retry on next change', e);
  }

  // 3. Open realtime channel for live updates from joining members.
  subscribeToRoom(id);
  return saved;
}

export async function addMember(roomId, member) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  if (room.members.length >= 8) throw new Error("La sala está llena");
  // Open the realtime channel BEFORE we save: pushRoom queues the
  // `update` message and flushes it once `open` fires, so the host
  // (already subscribed on the other device) receives the broadcast.
  subscribeToRoom(roomId);
  const existing = room.members.find(m => m.id === member.id);
  if (!existing) {
    room.members = [...room.members, { id: member.id, name: member.name, avatarUrl: member.avatarUrl || null, isHost: false, taste: emptyTaste() }];
    room.votes[member.id] = room.votes[member.id] || {};
  } else if (member.avatarUrl && existing.avatarUrl !== member.avatarUrl) {
    existing.avatarUrl = member.avatarUrl;
    if (member.name && member.name !== existing.name) existing.name = member.name;
  }
  // Save locally without push first (instant UI), then await an explicit
  // upsert so we KNOW the host's backend row reflects the new member.
  // Without this the guest can land in the lobby with the host invisible
  // (their initial fire-and-forget pushRoom can silently drop on a flaky
  // network and never retry).
  const saved = saveRoom(room, { skipPush: true });
  try {
    const { apiUpsertRoom } = await import('./api');
    await apiUpsertRoom(saved);
  } catch (err) {
    // Surface the error so JoinScreen can show a message and let the user
    // retry instead of silently entering a broken state.
    throw new Error('No se pudo conectar con la sala. Comprueba tu conexión y vuelve a intentarlo.');
  }
  return saved;
}

export function startRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  room.status = "live";
  return saveRoom(room);
}

export function closeRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  room.status = "ended";
  return saveRoom(room);
}

export function recordVote(roomId, memberId, movie, vote) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  room.votes[memberId] = room.votes[memberId] || {};
  room.votes[memberId][movie.id] = vote;

  const m = room.members.find(x => x.id === memberId);
  if (m) m.taste = updateTaste(m.taste, movie, vote);

  let madeMatch = false;
  if (vote === "like") {
    const everyoneLiked = room.members.every(mem => room.votes[mem.id]?.[movie.id] === "like");
    const alreadyMatched = room.matches.some(x => x.movieId === movie.id);
    if (everyoneLiked && !alreadyMatched && room.members.length > 0) {
      room.matches = [...room.matches, { movieId: movie.id, movie, matchedAt: Date.now() }];
      madeMatch = true;
    }
  }
  saveRoom(room);
  return { room, madeMatch };
}

export function getMemberVotedIds(room, memberId) {
  const v = room?.votes?.[memberId] || {};
  return new Set(Object.keys(v).map(Number));
}

/* Películas marcadas como "ya vistas" por cualquier miembro de la sala —
   se excluyen de los swipes de TODOS los integrantes. */
export function markWatchedShared(roomId, movie) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  if (!Array.isArray(room.watchedMovies)) room.watchedMovies = [];
  if (!room.watchedMovies.some(m => m.id === movie.id)) {
    room.watchedMovies.push({ id: movie.id, title: movie.title || movie.name, watchedAt: Date.now() });
  }
  // También cuenta como un voto skip propio para no volver a verla nosotros
  if (room.votes) {
    Object.keys(room.votes).forEach(memberId => {
      room.votes[memberId] = room.votes[memberId] || {};
      if (!room.votes[memberId][movie.id]) room.votes[memberId][movie.id] = 'watched';
    });
  }
  saveRoom(room);
  return room;
}

export function getRoomWatchedIds(room) {
  if (!room?.watchedMovies) return new Set();
  return new Set(room.watchedMovies.map(m => Number(m.id)));
}

export function removeMatch(roomId, movieId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.matches = room.matches.filter(m => m.movieId !== movieId);
  return saveRoom(room);
}

/**
 * Guest-initiated request to finish the room. Persisted as
 * `room.endRequest = { memberId, memberName, requestedAt }` so it
 * propagates to the host through the existing subscribe + realtime
 * sync. The host then chooses to ignore or actually close.
 */
export function requestEndRoom(roomId, memberId, memberName) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  room.endRequest = { memberId, memberName, requestedAt: Date.now() };
  return saveRoom(room);
}
export function clearEndRequest(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.endRequest = null;
  return saveRoom(room);
}
