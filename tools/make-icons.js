// Renders the app icons from the same d20 mark used by favicon.svg and the
// sidebar brand: the die drawn as an open outline in the accent colour.
// The plate behind it stays opaque here, unlike the favicon: Android masks
// a maskable icon to a shape and iOS composites the home-screen icon on
// black, so a transparent install icon comes out sitting on a dark plate
// either way. Better to choose the plate than inherit one.
// Run by hand:  node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });

const ACCENT = [0x22, 0xc5, 0x5e];   // --accent in dark mode
const BG     = [0x0e, 0x0f, 0x11];   // --bg in dark mode
// A tab favicon is a flat PNG and cannot follow the page theme the way
// favicon.svg does, so it needs one green that survives both a light and a
// dark tab strip. The dark theme's accent is too pale on white and the light
// theme's is too dim on charcoal; this sits between them at roughly 3.5:1
// against white and 3.2:1 against a dark strip.
const TAB    = [0x1a, 0x9c, 0x4a];

// The mark, in the 40x40 space favicon.svg uses. Same points and stroke as
// the polygon in favicon.svg; keep the two in step.
const HEX = [[20,2],[35.6,11],[35.6,29],[20,38],[4.4,29],[4.4,11]];
const STROKE = 4;

// distance from a point to a line segment
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx*dx + dy*dy;
  let t = len2 ? ((px-ax)*dx + (py-ay)*dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t*dx, cy = ay + t*dy;
  return Math.hypot(px-cx, py-cy);
}
// distance to the hexagon outline (its closest edge)
function distHex(px, py) {
  let d = Infinity;
  for (let i = 0; i < HEX.length; i++) {
    const a = HEX[i], b = HEX[(i+1) % HEX.length];
    d = Math.min(d, distSeg(px, py, a[0], a[1], b[0], b[1]));
  }
  return d;
}

// One icon. `markScale` is how much of the canvas the mark fills, leaving the
// rest as padding: maskable icons need their content inside a safe circle.
function render(size, markScale, transparentBg, ink) {
  const MARK = ink || ACCENT;
  const SS = 4;                        // supersample for smooth edges
  const px = Buffer.alloc(size * size * 4);
  const span = 40 / markScale;         // world units across the canvas
  const originX = 20 - span/2, originY = 20 - span/2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const wx = originX + ((x + (sx+0.5)/SS) / size) * span;
          const wy = originY + ((y + (sy+0.5)/SS) / size) * span;
          if (distHex(wx, wy) <= STROKE/2) hit++;   // on the die's outline
        }
      }
      const a = hit / (SS*SS);
      const i = (y*size + x) * 4;
      // composite the accent mark over the background
      for (let ch = 0; ch < 3; ch++) px[i+ch] = Math.round(MARK[ch]*a + BG[ch]*(1-a));
      px[i+3] = transparentBg ? Math.round(255*a) : 255;
      if (transparentBg && a > 0) for (let ch = 0; ch < 3; ch++) px[i+ch] = MARK[ch];
    }
  }
  return px;
}

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(size * (size*4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y*(size*4+1)] = 0;                                              // filter: none
    rgba.copy(raw, y*(size*4+1) + 1, y*size*4, (y+1)*size*4);
  }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const JOBS = [
  // name,                  size, mark scale, transparent, ink
  ["icon-192.png",           192, 0.86, false],
  ["icon-512.png",           512, 0.86, false],
  ["icon-maskable-512.png",  512, 0.62, false],   // mark inside the safe circle
  ["apple-touch-icon.png",   180, 0.86, false],   // iOS draws its own rounding
  // Tab favicons, transparent so they sit on whatever the browser paints
  // behind them. Named tab-N rather than favicon-N because Safari remembers a
  // page's icon per URL, including a failure, and would not re-ask under the
  // old names.
  ["tab-16.png",              16, 0.94, true, TAB],
  ["tab-32.png",              32, 0.94, true, TAB],
  ["tab-48.png",              48, 0.94, true, TAB],
  // Larger transparent renders for the same tab-icon list. The install icons
  // at these sizes carry an opaque plate on purpose, and a browser that picked
  // one of those for a tab would draw a dark square in a light tab strip.
  ["tab-192.png",            192, 0.94, true, TAB],
  ["tab-512.png",            512, 0.94, true, TAB]
];
JOBS.forEach(([name, size, scale, transparent, ink]) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, png(size, render(size, scale, transparent, ink)));
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(fs.statSync(file).size/1024).toFixed(1)} KB`);
});

// No favicon.ico. The sibling DM Screen site, which renders on an iPad, does
// not ship one, and ours drew nothing in Safari: every entry inside an .ico
// built here is a PNG, which Safari's .ico path does not draw. Browsers that
// ask for /favicon.ico unprompted simply get a 404 and fall back to the linked
// PNGs.
