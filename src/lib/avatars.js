/**
 * avatars.js — Avatar generation (DiceBear) + upload (client-side data URL).
 *
 * Two sources of avatars:
 *   1. DiceBear SVG URLs: cheap, deterministic, no backend. The default.
 *   2. User-uploaded photo: resized client-side to a square data URL and
 *      stored directly in the profile record (PostgreSQL via JWT API).
 *
 * Supabase has been fully removed. Uploads no longer require external storage:
 * the image is resized to ≤512px and saved as a base64 data URL inside the
 * profile JSON. A `profile.avatarUrl` is always the final URL — regardless of
 * source — so rendering code stays uniform.
 */

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

// ── Upload (client-side resize → data URL) ──────────────────────────────────
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB raw input
const MAX_SIDE  = 512;             // px — square output edge
const JPEG_Q    = 0.85;

/**
 * Resize an image File to a square ≤MAX_SIDE and return a data URL (JPEG).
 * Center-crop preserves face/subject in most photos.
 * Keeps the avatar payload small (~30–150KB) so it fits in the profile JSON.
 */
function resizeToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Imagen inválida.'));
      img.onload = () => {
        try {
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth  - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          const out = Math.min(MAX_SIDE, side);
          const canvas = document.createElement('canvas');
          canvas.width = out;
          canvas.height = out;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_Q);
          resolve(dataUrl);
        } catch (e) { reject(e); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Process a File for avatar use. Returns a data URL ready to be stored on
 * the profile (no external storage required). Throws on invalid input.
 */
export async function uploadAvatar(file /*, userId */) {
  if (!file) throw new Error('Selecciona una imagen primero.');
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen.');
  if (file.size > MAX_BYTES) throw new Error('La imagen es demasiado grande (máx 4 MB).');
  return resizeToDataUrl(file);
}

/**
 * True when the user has a connected account (email present from magic link
 * or Google OAuth). Guest profiles created locally (sin email) cannot persist
 * an uploaded photo across devices, so the picker shows a soft warning.
 */
export function canUpload(profile) {
  return !!profile?.email;
}
