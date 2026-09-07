// Draws the small pixel-art icons the UI needs, so they match the town art
// instead of being CSS circles. Run: node scripts/build-pixel-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT_DIR = new URL("../assets/ui/", import.meta.url);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}
function writePng(file, size, pixels) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixels[y * size + x] || [0, 0, 0, 0];
      raw.set([r, g, b, a], y * stride + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

// Town palette: the fountain donut, at icon size.
const OUTLINE = [74, 43, 30, 255];
const DOUGH = [226, 166, 92, 255];
const DOUGH_SHADE = [193, 126, 62, 255];
const ICING = [244, 160, 186, 255];
const ICING_SHADE = [219, 122, 154, 255];
const ICING_LIGHT = [252, 200, 216, 255];
const SPRINKLES = [[251, 243, 214, 255], [143, 211, 168, 255], [246, 211, 101, 255]];

function donut(size) {
  const pixels = new Array(size * size).fill(null);
  const centre = (size - 1) / 2;
  const outer = size * 0.47;
  const inner = size * 0.15;
  const sprinkleAt = new Map([
    [`${Math.round(size * 0.3)},${Math.round(size * 0.28)}`, 0],
    [`${Math.round(size * 0.62)},${Math.round(size * 0.24)}`, 1],
    [`${Math.round(size * 0.74)},${Math.round(size * 0.44)}`, 2],
    [`${Math.round(size * 0.24)},${Math.round(size * 0.5)}`, 1],
    [`${Math.round(size * 0.48)},${Math.round(size * 0.18)}`, 2]
  ]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      if (distance > outer + 0.5 || distance < inner - 0.5) continue;
      const edge = distance > outer - 0.9 || distance < inner + 0.9;
      // The icing runs over the top with a drip along its lower edge.
      const dripline = centre + size * 0.1 + Math.sin((x / size) * 24) * size * 0.06;
      const iced = y <= dripline;
      let colour;
      if (edge) colour = OUTLINE;
      else if (iced) colour = y < centre - size * 0.18 && x < centre ? ICING_LIGHT : y > dripline - 1.4 ? ICING_SHADE : ICING;
      else colour = y > centre + size * 0.28 ? DOUGH_SHADE : DOUGH;
      if (!edge && iced) {
        const sprinkle = sprinkleAt.get(`${x},${y}`);
        if (sprinkle !== undefined) colour = SPRINKLES[sprinkle];
      }
      pixels[y * size + x] = colour;
    }
  }
  return pixels;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32]) {
  writePng(new URL(`donut-${size}.png`, OUT_DIR), size, donut(size));
  console.log(`assets/ui/donut-${size}.png`);
}
