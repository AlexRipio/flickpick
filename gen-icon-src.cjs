// One-off: build the @capacitor/assets source images from the FlickPick mark.
// Produces assets/icon-only.png, icon-foreground.png, icon-background.png (1024²).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = __dirname;
  const out = path.join(root, 'assets');
  fs.mkdirSync(out, { recursive: true });

  // Transparent flame+film mark.
  const mark = path.join(root, 'public', 'pwa-icon-transparent.png');
  const BG = { r: 255, g: 255, b: 255, alpha: 1 }; // white background
  const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
  const S = 1024;

  const blank = (bg) => sharp({ create: { width: S, height: S, channels: 4, background: bg } });

  // Trim the transparent margin around the mark first so it actually fills
  // the icon instead of floating small in the middle.
  const trimmed = await sharp(mark).trim().png().toBuffer();

  // Foreground for adaptive icon: big mark (~92%).
  const fg = await sharp(trimmed).resize(820, 820, { fit: 'contain', background: TRANSPARENT }).toBuffer();
  await blank(TRANSPARENT).composite([{ input: fg, gravity: 'center' }]).png().toFile(path.join(out, 'icon-foreground.png'));

  // Background for adaptive icon: solid white.
  await blank(BG).png().toFile(path.join(out, 'icon-background.png'));

  // Full icon (legacy Android + iOS): near full-bleed on white.
  const only = await sharp(trimmed).resize(900, 900, { fit: 'contain', background: TRANSPARENT }).toBuffer();
  await blank(BG).composite([{ input: only, gravity: 'center' }]).png().toFile(path.join(out, 'icon-only.png'));

  console.log('icon sources generated in', out);
})().catch((e) => { console.error(e); process.exit(1); });
