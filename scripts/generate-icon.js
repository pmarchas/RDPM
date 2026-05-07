/**
 * Generates RDPM app icons from SVG using sharp.
 * Produces: PNG sizes, Windows .ico (multi-size), macOS .icns
 * Run with: node scripts/generate-icon.js
 */
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const ROOT   = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const PUBLIC = path.join(ROOT, 'public');

fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(PUBLIC, { recursive: true });

// ─── Icon SVG ────────────────────────────────────────────────────────────────
const SVG = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0d1f3c"/>
      <stop offset="100%" stop-color="#1a3a6b"/>
    </linearGradient>
    <linearGradient id="hub" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="200" fill="none" stroke="#3b82f6" stroke-width="6" stroke-opacity="0.25"/>
  <line x1="512" y1="290" x2="260" y2="460" stroke="#3b82f6" stroke-width="18" stroke-linecap="round" stroke-opacity="0.55"/>
  <line x1="512" y1="290" x2="512" y2="480" stroke="#8b5cf6" stroke-width="18" stroke-linecap="round" stroke-opacity="0.55"/>
  <line x1="512" y1="290" x2="764" y2="460" stroke="#10b981" stroke-width="18" stroke-linecap="round" stroke-opacity="0.55"/>
  <circle cx="512" cy="290" r="62" fill="url(#hub)" filter="url(#glow)"/>
  <circle cx="512" cy="290" r="38" fill="#1e40af"/>
  <rect x="493" y="272" width="38" height="26" rx="5" fill="none" stroke="white" stroke-width="5"/>
  <line x1="512" y1="298" x2="512" y2="308" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="504" y1="308" x2="520" y2="308" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <circle cx="260" cy="460" r="38" fill="#1d4ed8" filter="url(#glow)"/>
  <text x="260" y="469" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="900" fill="white" text-anchor="middle">RDP</text>
  <circle cx="512" cy="480" r="38" fill="#6d28d9" filter="url(#glow)"/>
  <text x="512" y="489" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="900" fill="white" text-anchor="middle">VNC</text>
  <circle cx="764" cy="460" r="38" fill="#047857" filter="url(#glow)"/>
  <text x="764" y="469" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="900" fill="white" text-anchor="middle">SSH</text>
  <text x="516" y="784" font-family="'Arial Black','Impact',Arial,Helvetica,sans-serif" font-size="248" font-weight="900" fill="#000000" fill-opacity="0.35" text-anchor="middle" letter-spacing="-8">RDPM</text>
  <text x="512" y="778" font-family="'Arial Black','Impact',Arial,Helvetica,sans-serif" font-size="248" font-weight="900" fill="white" text-anchor="middle" letter-spacing="-8">RDPM</text>
  <rect x="182" y="800" width="660" height="16" rx="8" fill="#3b82f6" opacity="0.8"/>
</svg>
`;

// ─── ICO encoder (PNG-in-ICO, supported Win Vista+) ─────────────────────────
function buildIco(entries) {
  // entries: [{ size, pngData }]
  const count  = entries.length;
  const dirOff = 6 + count * 16;
  let imageOff = dirOff;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(count, 4); // image count

  const dirs   = [];
  const images = [];
  for (const { size, pngData } of entries) {
    const dir = Buffer.alloc(16);
    const s   = size >= 256 ? 0 : size;   // 0 encodes 256
    dir.writeUInt8(s, 0);          // width
    dir.writeUInt8(s, 1);          // height
    dir.writeUInt8(0, 2);          // color count
    dir.writeUInt8(0, 3);          // reserved
    dir.writeUInt16LE(1,  4);      // color planes
    dir.writeUInt16LE(32, 6);      // bits per pixel
    dir.writeUInt32LE(pngData.length, 8);  // bytes in image
    dir.writeUInt32LE(imageOff,    12);    // offset
    imageOff += pngData.length;
    dirs.push(dir);
    images.push(pngData);
  }
  return Buffer.concat([header, ...dirs, ...images]);
}

// ─── ICNS encoder (PNG inside ICNS, supported macOS 10.7+) ──────────────────
// Type codes: https://en.wikipedia.org/wiki/Apple_Icon_Image_format
const ICNS_TYPES = {
  16:   'icp4',
  32:   'icp5',
  64:   'icp6',
  128:  'ic07',
  256:  'ic08',
  512:  'ic09',
  1024: 'ic10',
};

function buildIcns(entries) {
  // entries: [{ size, pngData }]
  const chunks = entries
    .filter(e => ICNS_TYPES[e.size])
    .map(({ size, pngData }) => {
      const type    = ICNS_TYPES[size];
      const chunk   = Buffer.alloc(8 + pngData.length);
      chunk.write(type, 0, 'ascii');
      chunk.writeUInt32BE(8 + pngData.length, 4);
      pngData.copy(chunk, 8);
      return chunk;
    });

  const body     = Buffer.concat(chunks);
  const header   = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  const buf = Buffer.from(SVG);

  // 1. Generate all PNG sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngMap = {};

  for (const s of sizes) {
    const out  = path.join(ASSETS, `icon-${s}.png`);
    const data = await sharp(buf).resize(s, s).png().toBuffer();
    fs.writeFileSync(out, data);
    pngMap[s]  = data;
    console.log(`  ✓ assets/icon-${s}.png`);
  }

  // 2. Master PNG (512 px) used by electron-builder for Linux + fallback
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), pngMap[512]);
  console.log('  ✓ assets/icon.png  (512×512 master)');

  // 3. Public favicon sizes for the app UI
  fs.writeFileSync(path.join(PUBLIC, 'icon-256.png'), pngMap[256]);
  fs.writeFileSync(path.join(PUBLIC, 'icon-48.png'),  pngMap[48]);
  fs.writeFileSync(path.join(PUBLIC, 'icon-32.png'),  pngMap[32]);
  console.log('  ✓ public/icon-*.png');

  // 4. Windows .ico  (16, 32, 48, 64, 128, 256)
  const icoEntries = [16, 32, 48, 64, 128, 256].map(s => ({ size: s, pngData: pngMap[s] }));
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), buildIco(icoEntries));
  console.log('  ✓ assets/icon.ico  (multi-size: 16/32/48/64/128/256)');

  // 5. macOS .icns (16 → 1024)
  const icnsEntries = sizes.map(s => ({ size: s, pngData: pngMap[s] }));
  fs.writeFileSync(path.join(ASSETS, 'icon.icns'), buildIcns(icnsEntries));
  console.log('  ✓ assets/icon.icns (16 → 1024)');

  console.log('\n✅  All icons generated in assets/ and public/');
}

run().catch(err => { console.error(err); process.exit(1); });
