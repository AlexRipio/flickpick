/**
 * Multi-device room sync via Supabase Realtime.
 * No-op if Supabase env vars are not configured (local BroadcastChannel is enough).
 *
 * Expects a Supabase table `rooms` (see schema.sql in repo root):
 *   id uuid primary key
 *   join_code text unique
 *   owner_id text
 *   status text
 *   data jsonb            -- full room object
 *   updated_at timestamptz default now()
 *
 * RLS: open for anon insert/update/select (demo usage). Tighten as needed.
 */
import { supabase, hasSupabase } from './supabase';

const SUBSCRIBED = new Map(); // roomId -> channel

let onRemoteUpdate = null;
export function setOnRemoteUpdate(cb) { onRemoteUpdate = cb; }

// ── Push local room → cloud ─────────────────────────────────────────
export async function pushRoom(room) {
  if (!hasSupabase || !room) return;
  try {
    await supabase.from('rooms').upsert({
      id: room.id,
      join_code: room.joinCode,
      owner_id: room.ownerId,
      status: room.status,
      data: room,
      updated_at: new Date().toISOString(),
    });
  } catch (e) { /* non-fatal */ }
}

// ── Pull cloud room by code → returns the room data ─────────────────
export async function fetchRoomByCode(code) {
  if (!hasSupabase) return null;
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('data')
      .eq('join_code', code)
      .maybeSingle();
    if (error) return null;
    return data?.data || null;
  } catch { return null; }
}

export async function fetchRoomById(id) {
  if (!hasSupabase) return null;
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return data?.data || null;
  } catch { return null; }
}

// ── Subscribe to realtime changes for a single room ─────────────────
export function subscribeToRoom(roomId) {
  if (!hasSupabase || !roomId) return () => {};
  if (SUBSCRIBED.has(roomId)) return () => {};
  const channel = supabase
    .channel(`rooms:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const next = payload.new?.data;
        if (next && typeof onRemoteUpdate === 'function') onRemoteUpdate(next);
      },
    )
    .subscribe();
  SUBSCRIBED.set(roomId, channel);
  return () => {
    try { supabase.removeChannel(channel); } catch {}
    SUBSCRIBED.delete(roomId);
  };
}

export { hasSupabase };
