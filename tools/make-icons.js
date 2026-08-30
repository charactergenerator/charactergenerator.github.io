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
// Every icon this writes now sits on the opaque plate above, so the mark never
// has to survive a light tab strip and there is no reason to dim it. The
// dimmer green that used to be here was chosen back when the tab icons were
// transparent; against the plate it manages about 5:1, where the accent
// manages about 8.5:1. Listboard's yellow on its own near-black plate is
// roughly 10:1, which is the relationship being matched.

// The mark, in the 40x40 space favicon.svg uses. Same points and stroke as
// the polygon in favicon.svg; keep the two in step.
const HEX = [[20,2],[35.6,11],[35.6,29],[20,38],[4.4,29],[4.4,11]];

// The sizes inside favicon.ico, the same three Listboard ships.
const ICO_SIZES = [16, 32, 48];
// Listboard's large icons cover 26% of the tile with mark; ours covered 20%
// at stroke 4, which is a thinner line to lose when a browser downscales a
// 180 or 512 icon into a tab slot. 5.2 brings the two into line.
const STROKE = 5.2;

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

// inside the hexagon, for the filled small mark
function insideHex(px, py) {
  let inside = false;
  for (let i = 0, j = HEX.length - 1; i < HEX.length; j = i++) {
    const [xi, yi] = HEX[i], [xj, yj] = HEX[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// inside a rounded rectangle covering the whole canvas, in pixel space
function insideRound(x, y, size, r) {
  if (r <= 0) return x >= 0 && y >= 0 && x <= size && y <= size;
  const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// One icon. `markScale` is how much of the canvas the mark fills, leaving the
// rest as padding: maskable icons need their content inside a safe circle.
//
// `opts.filled` fills the die instead of stroking its outline, and
// `opts.radius` rounds the opaque plate, as a fraction of the canvas. Both
// exist for the small sizes inside favicon.ico. Left off, every pixel of this
// function behaves exactly as it did, so the install icons are unchanged.
function render(size, markScale, transparentBg, ink, opts) {
  const MARK = ink || ACCENT;
  const filled = !!(opts && opts.filled);
  const radius = (opts && opts.radius) ? opts.radius * size : 0;
  const SS = 4;                        // supersample for smooth edges
  const px = Buffer.alloc(size * size * 4);
  const span = 40 / markScale;         // world units across the canvas
  const originX = 20 - span/2, originY = 20 - span/2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0, plate = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const sxp = x + (sx+0.5)/SS, syp = y + (sy+0.5)/SS;
          const wx = originX + (sxp / size) * span;
          const wy = originY + (syp / size) * span;
          // on the die's outline, or anywhere inside it when filled
          if (filled ? insideHex(wx, wy) : distHex(wx, wy) <= STROKE/2) hit++;
          if (insideRound(sxp, syp, size, radius)) plate++;
        }
      }
      let a = hit / (SS*SS);
      const p = plate / (SS*SS);
      if (!transparentBg) a = Math.min(a, p);   // the mark cannot spill off the plate
      const i = (y*size + x) * 4;
      // composite the accent mark over the background
      for (let ch = 0; ch < 3; ch++) px[i+ch] = Math.round(MARK[ch]*a + BG[ch]*(1-a));
      px[i+3] = transparentBg ? Math.round(255*a) : Math.round(255*p);
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
  // No transparent tab PNGs. Nothing links them: the tab icon is favicon.svg
  // and favicon.ico, the way Listboard does it.
];
JOBS.forEach(([name, size, scale, transparent, ink, opts]) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, png(size, render(size, scale, transparent, ink, opts)));
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(fs.statSync(file).size/1024).toFixed(1)} KB`);
});

// ---- favicon.ico -------------------------------------------------------
// This is the file an iPad actually draws in a tab: Safari ignores an SVG
// favicon, and the sibling Listboard site, which does render on an iPad,
// links nothing else. An .ico is a small header plus one directory entry per
// size, each holding a whole PNG. Listboard's is built exactly that way, so
// the PNG payload is not the problem it was once written up as.
//
// The art is what makes it legible. Listboard fills its mark solid at these
// sizes because an outline "collapses into three yellow smudges" at 16px, and
// ours had the same trouble: a 16px die outline is a 1px ring, about a quarter
// of the tile covered at all. So the small sizes get the die filled. They stay
// transparent around it, like DM Screen's, which render on an iPad.
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // 1 = icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((e, i) => {
    const at = i * 16;
    dir[at]     = e.size >= 256 ? 0 : e.size;   // 0 means 256
    dir[at + 1] = e.size >= 256 ? 0 : e.size;
    dir[at + 2] = 0;                            // palette size
    dir[at + 3] = 0;                            // reserved
    dir.writeUInt16LE(0, at + 4);               // colour planes, 0 like Listboard's
    dir.writeUInt16LE(32, at + 6);              // bits per pixel
    dir.writeUInt32LE(e.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir, ...entries.map(e => e.data)]);
}

// Filled die on a transparent ground, so the tab strip shows through around
// the mark. The plate that used to be here was added on the theory that an
// iPad needs one; the sibling DM Screen site's tab icons are transparent and
// render there, so it does not. What does matter is that the mark is filled:
// the version that showed nothing was a hairline outline, not a transparent
// background.
const SMALL = { filled: true };
const ROOT = path.join(__dirname, "..");
const icoFile = path.join(ROOT, "favicon.ico");
fs.writeFileSync(icoFile, ico(ICO_SIZES.map(size => ({
  size, data: png(size, render(size, 0.78, true, ACCENT, SMALL))
}))));
console.log(`${"favicon.ico".padEnd(24)} ${ICO_SIZES.join("+")}  ${(fs.statSync(icoFile).size/1024).toFixed(1)} KB`);
