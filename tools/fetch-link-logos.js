// Pulls the Auto Roll Tables mark straight from that site and writes it as the
// small alpha mask the "More" links in the sidebar use.
//
// Why a mask and not the image itself: their file is a soft blue-grey d20 on
// transparency, which would be the only coloured thing in a rail of monochrome
// line icons, and would wash out against the parchment theme. Painting
// currentColor through its alpha keeps their shape exactly, seams and all,
// while the mark still takes the rail's colour like every icon beside it.
//
// Run by hand:  node tools/fetch-link-logos.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");

const SOURCE = "https://autorolltables.github.io/img/d20-icon-192.png";
const OUT = path.join(__dirname, "..", "assets", "logo-autorolltables.png");
const TARGET_H = 96;             // ample for an 18px icon on a high-density screen

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} for ${url}`));
      const parts = [];
      res.on("data", d => parts.push(d));
      res.on("end", () => resolve(Buffer.concat(parts)));
    }).on("error", reject);
  });
}

// --- PNG read: 8-bit RGBA/RGB/grey(+alpha)/palette, which covers what we fetch ---
function decode(buf) {
  let p = 8, w, h, bd, ct, plte, trns, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString("ascii", p + 4, p + 8);
    if (t === "IHDR") { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); bd = buf[p + 16]; ct = buf[p + 17]; }
    if (t === "PLTE") plte = buf.slice(p + 8, p + 8 + len);
    if (t === "tRNS") trns = buf.slice(p + 8, p + 8 + len);
    if (t === "IDAT") idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (bd !== 8) throw new Error(`expected an 8-bit source, got ${bd}-bit`);
  const samples = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1;
  const stride = ct === 3 ? w : w * samples;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= samples ? out[y * stride + x - samples] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= samples && y > 0) ? out[(y - 1) * stride + x - samples] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 255;
    }
  }
  const alpha = (x, y) => {
    if (ct === 3) { const i = out[y * stride + x]; return trns && i < trns.length ? trns[i] : 255; }
    if (ct === 6) return out[y * stride + x * 4 + 3];
    if (ct === 4) return out[y * stride + x * 2 + 1];
    return 255;                                   // no alpha channel: fully opaque
  };
  return { w, h, alpha };
}

// --- PNG write: 8-bit greyscale + alpha, white throughout, so only alpha matters ---
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return b => { let c = -1; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}
function encodeGreyAlpha(w, h, alpha) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 4;                       // 8-bit greyscale + alpha
  const raw = Buffer.alloc(h * (w * 2 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 2 + 1)] = 0;                     // filter: none
    for (let x = 0; x < w; x++) {
      raw[y * (w * 2 + 1) + 1 + x * 2] = 255;
      raw[y * (w * 2 + 1) + 2 + x * 2] = alpha[y * w + x];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

(async () => {
  const src = decode(await get(SOURCE));

  // Their canvas carries about 11% padding, which would leave the mark small
  // beside the 18px line icons. Crop to the ink and let the CSS do the spacing.
  let minX = src.w, maxX = -1, minY = src.h, maxY = -1;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (src.alpha(x, y) > 8) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const cw = maxX - minX + 1, chh = maxY - minY + 1;

  const H = TARGET_H, W = Math.max(1, Math.round(cw * H / chh));
  const dst = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // box filter over the source rectangle this pixel covers
      const x0 = minX + x * cw / W, x1 = minX + (x + 1) * cw / W;
      const y0 = minY + y * chh / H, y1 = minY + (y + 1) * chh / H;
      let sum = 0, n = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          sum += src.alpha(Math.min(sx, src.w - 1), Math.min(sy, src.h - 1)); n++;
        }
      }
      dst[y * W + x] = n ? Math.round(sum / n) : 0;
    }
  }

  fs.writeFileSync(OUT, encodeGreyAlpha(W, H, dst));
  console.log(`${path.basename(OUT)}  ${W}x${H}  ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
  console.log(`cropped from ${src.w}x${src.h} (ink ${cw}x${chh} at ${minX},${minY})`);
})().catch(e => { console.error(e.message); process.exit(1); });
