/*
 * Attendance Pro — PWA icon generator (pure Node.js, no dependencies)
 * Produces public/icon-192.png and public/icon-512.png
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const outDir = path.join(__dirname, '..', 'public');

/* ---------- minimal PNG writer ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, pixelFn) {
  const w = size, h = size;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* rounded-rect test: inside a rounded rectangle centered (cx,cy) */
function inRounded(x, y, cx, cy, hw, hh, r) {
  let dx = Math.abs(x - cx) - (hw - r); if (dx < 0) dx = 0;
  let dy = Math.abs(y - cy) - (hh - r); if (dy < 0) dy = 0;
  return dx * dx + dy * dy <= r * r;
}

const BG = [124, 58, 237];      // purple (#7c3aed)
const WHITE = [255, 255, 255];
const GREEN = [34, 197, 94];

function draw(size) {
  return encodePng(size, (x, y) => {
    // rounded-full background within the maskable safe zone (28% margin)
    const half = size * 0.36, rad = size * 0.16;
    const ddx = Math.max(Math.abs(x - size / 2) - (half - rad), 0);
    const ddy = Math.max(Math.abs(y - size / 2) - (half - rad), 0);
    if (ddx * ddx + ddy * ddy > rad * rad) return [0, 0, 0, 0];

    // white "card" in the middle
    if (inRounded(x, y, size * 0.5, size * 0.5, size * 0.30, size * 0.26, size * 0.05)) {
      // 3 purple "text" stripes (attendance sheet)
      for (let i = 0; i < 3; i++) {
        if (inRounded(x, y, size * 0.5, size * (0.42 + i * 0.08), size * 0.20, size * 0.03, size * 0.014)) {
          return BG;
        }
      }
      // green "present" dot
      if ((x - size * 0.72) * (x - size * 0.72) + (y - size * 0.75) * (y - size * 0.75) <= (size * 0.045) ** 2) {
        return GREEN;
      }
      return WHITE;
    }
    return BG;
  });
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), draw(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), draw(512));
console.log('✓ Generated icon-192.png and icon-512.png');