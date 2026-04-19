// Extract the __bundler/manifest + template from a standalone HTML export
// and write each asset under ./unpacked/ with its relative path.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const input = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, '..', 'unpacked');
const html = fs.readFileSync(input, 'utf8');

function extract(type) {
  const re = new RegExp(`<script[^>]+type="__bundler/${type}"[^>]*>([\\s\\S]*?)</script>`);
  const m = html.match(re);
  if (!m) throw new Error('missing ' + type);
  return JSON.parse(m[1]);
}

const manifest = extract('manifest');
const template = extract('template');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_template.json'), JSON.stringify(template, null, 2));

const byUuid = {};
for (const [uuid, entry] of Object.entries(manifest)) {
  const buf = Buffer.from(entry.data, 'base64');
  const final = entry.compressed ? zlib.gunzipSync(buf) : buf;
  byUuid[uuid] = { entry, bytes: final };
}

const listing = [];
for (const [uuid, { entry, bytes }] of Object.entries(byUuid)) {
  const rel = entry.path || entry.name || (uuid + (entry.mime === 'text/html' ? '.html' : ''));
  const full = path.join(outDir, rel.replace(/^\/+/, ''));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, bytes);
  listing.push({ uuid, rel, size: bytes.length, mime: entry.mime });
}

fs.writeFileSync(path.join(outDir, '_listing.json'), JSON.stringify(listing, null, 2));
console.log('Wrote', listing.length, 'files to', outDir);
console.log(listing.map(l => `${l.rel} (${l.size}B, ${l.mime})`).join('\n'));
