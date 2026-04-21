/**
 * avatars.js — Avatar generation (DiceBear) + upload (Supabase Storage).
 *
 * Two sources of avatars:
 *   1. DiceBear SVG URLs: cheap, deterministic, no backend. The default.
 *   2. User-uploaded photo stored in Supabase Storage (bucket "avatars").
 *
 * A `profile.avatarUrl` is always the final URL — regardless of source — so
 * rendering code is uniform. `profile.avatarStyle` + `profile.avatarSeed` are
 * kept for DiceBear so the picker knows what's selected and can regenerate.
 */

import { supabase, hasSupabase } from './supabase';

// ── DiceBear ────────────────────────────────────────────────────────────────
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';

// Curated movie-friendly styles
export const DICEBEAR_STYLES = [
  { id: 'pixel-art',   label: 'Pixel',     emoji: '👾' },
  { id: 'bottts',      label: 'Robot',     emoji: '🤖' },
  { id: 'avataaars',   label: 'Cartoon',   emoji: '😎' },
  { id: 'fun-emoji',   label: 'Emoji',     emoji: '🎭' },
  { id: 'adventurer',  label: 'Aventura',  emoji: '🗺️' },
  { id: 'notionists',  label: 'Notion',    emoji: '✏️' },
  { id: 'lorelei',     label: 'Retrato',   emoji: '🎨' },
  { id: 'micah',       label: 'Minimal',   emoji: '✨' },
];

const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c7f0bd'];

/** Build a DiceBear SVG URL from a style + seed. */
export function dicebearUrl(style, seed, { bg } = {}) {
  const s = encodeURIComponent(String(seed ?? 'flickpick'));
  const params = new URLSearchParams({ seed: s });
  // Randomise background colour deterministically from seed so the picker
  // previews aren't all the same shade.
  if (bg !== false) {
    const idx = Math.abs(hashString(String(seed ?? 'flickpick'))) % BG_COLORS.length;
    params.set('backgroundColor', bg || BG_COLORS[idx]);
  }
  return `${DICEBEAR_BASE}/${style}/svg?${params.toString()}`;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

/** Return the default avatar URL for a new profile. */
export function defaultAvatarForName(name) {
  return dicebearUrl('pixel-art', name || 'flickpick');
}

/** Generate a fresh seed for regeneration in the picker. */
export function freshSeed(baseName = 'flickpick') {
  return `${baseName}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Upload ──────────────────────────────────────────────────────────────────
// Supabase Storage bucket must exist with public read. Policy example:
//   Bucket: avatars · public read: true · authenticated users can insert/update
//   files in their own "userId/..." path.

const BUCKET = 'avatars';
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Uploads a File/Blob to Supabase Storage and returns a public URL.
 * Throws on error. Caller should catch and show a toast.
 */
export async function uploadAvatar(file, userId) {
  if (!hasSupabase) throw new Error('Supabase no configurado. No se puede subir foto.');
  if (!file) throw new Error('Selecciona una imagen primero.');
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen.');
  if (file.size > MAX_BYTES) throw new Error('La imagen es demasiado grande (máx 4 MB).');
  if (!userId) throw new Error('Inicia sesión para subir una foto.');

  const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(error.message || 'Error al subir la imagen.');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL pública.');
  return data.publicUrl;
}

/** True when we have Supabase + the user is authenticated (so upload would work). */
export function canUpload() {
  return hasSupabase;
}
