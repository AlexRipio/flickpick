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
  const all = readAll();
  all[room.id] = room;
  writeAll(all);
  const codes = readCodes();
  codes[room.joinCode] = room.id;
  writeCodes(codes);
  broadcast(room.id);
  if (!skipPush) pushRoom(room);
  return room;
}

// Remote updates (Supabase Realtime) are mirrored into the local store.
setOnRemoteUpdate((remote) => {
  if (!remote || !remote.id) return;
  const local = getRoom(remote.id);
  // Last-write-wins; timestamp cheap collision guard
  if (!local || (remote.createdAt || 0) >= (local.createdAt || 0)) {
    saveRoom(remote, { skipPush: true });
  }
});

/** Hydrate a room from the cloud if we don't have it locally. */
export async function hydrateRoomByCode(code) {
  const local = findRoomByCode(code);
  if (local) return local;
  const remote = await fetchRoomByCode(code);
  if (remote) { saveRoom(remote, { skipPush: true }); return remote; }
  return null;
}

export async function hydrateRoomById(id) {
  const local = getRoom(id);
  if (local) { subscribeToRoom(id); return local; }
  const remote = await fetchRoomById(id);
  if (remote) { saveRoom(remote, { skipPush: true }); subscribeToRoom(id); return remote; }
  return null;
}

export function createRoom({ name, preferences, host }) {
  const id = uuid();
  const joinCode = randomCode();
  const room = {
    id,
    name,
    joinCode,
    ownerId: host.id,
    status: "lobby",
    preferences,
    members: [{ id: host.id, name: host.name, isHost: true, taste: emptyTaste() }],
    votes: { [host.id]: {} },
    matches: [],
    createdAt: Date.now(),
  };
  const saved = saveRoom(room);
  subscribeToRoom(id);
  return saved;
}

export function addMember(roomId, member) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  if (room.members.length >= 8) throw new Error("La sala está llena");
  if (!room.members.some(m => m.id === member.id)) {
    room.members = [...room.members, { id: member.id, name: member.name, isHost: false, taste: emptyTaste() }];
    room.votes[member.id] = room.votes[member.id] || {};
    saveRoom(room);
  }
  return room;
}

export function startRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Sala no encontrada");
  room.status = "live";
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
