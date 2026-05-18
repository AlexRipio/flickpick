// Generates all PWA icon sizes from public/pwa-icon.png (white bg)
// and public/pwa-icon-transparent.png (alpha). Outputs to public/icons/.
// Re-run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const out = path.join(pub, 'icons');

const SRC_WHITE = path.join(pub, 'pwa-icon.png');
const SRC_TRANSPARENT = path.join(pub, 'pwa-icon-transparent.png');

if (!existsSync(SRC_WHITE) || !existsSync(SRC_TRANSPARENT)) {
  console.error('Missing source icons. Need both:');
  console.error('  - public/pwa-icon.png (white bg)');
  console.error('  - public/pwa-icon-transparent.png (transparent)');
  process.exit(1);
}

await mkdir(out, { recursive: true });

// Square resize from any source preserving aspect (we expect 1024 squares).
async function resize(src, size, file) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));
  console.log(`  ✓ ${file} (${size}x${size})`);
}

// Maskable: launcher applies its own mask (circle/squircle). The art must
// occupy the inner 80% "safe zone". We pad the transparent source 12.5% on
// each side and place it on a flame-brand background so any edge crop still
// looks intentional.
async function maskable(size, file, bg) {
  const inner = Math.round(size * 0.75); // 75% inner = 12.5% padding each side
  const buf = await sharp(SRC_TRANSPARENT).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: buf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));
  console.log(`  ✓ ${file} (${size}x${size}, maskable)`);
}

console.log('Generating "any" icons (transparent bg, full bleed)…');
await resize(SRC_TRANSPARENT, 192, 'icon-192.png');
await resize(SRC_TRANSPARENT, 512, 'icon-512.png');

console.log('Generating Apple touch icons (white bg, no transparency)…');
await resize(SRC_WHITE, 180, 'apple-touch-icon-180.png');
await resize(SRC_WHITE, 167, 'apple-touch-icon-167.png');
await resize(SRC_WHITE, 152, 'apple-touch-icon-152.png');
await resize(SRC_WHITE, 120, 'apple-touch-icon-120.png');

console.log('Generating favicons…');
await resize(SRC_TRANSPARENT, 32, 'favicon-32.png');
await resize(SRC_TRANSPARENT, 16, 'favicon-16.png');

console.log('Generating maskable icons (flame bg, 75% safe zone)…');
// Solid white as background — friendliest universal contrast for the gradient logo.
const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 };
await maskable(192, 'icon-maskable-192.png', WHITE_BG);
await maskable(512, 'icon-maskable-512.png', WHITE_BG);

console.log('\nDone. Icons in public/icons/');
