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

// Placeholder pets: a three frame side-on walk each, in the shop's own colours,
// so the follower can be built before the real sprites are drawn. Replace the
// files, keep the frame layout, and nothing else has to change.
const PETS = {
  "pet-cat": { body: [216, 162, 92, 255], dark: [150, 100, 48, 255], ears: "pointed", tail: "up", height: 11 },
  "pet-duck": { body: [240, 196, 83, 255], dark: [186, 138, 40, 255], ears: "bill", tail: "flat", height: 10 },
  "pet-frog": { body: [127, 176, 105, 255], dark: [82, 122, 66, 255], ears: "eyes", tail: "none", height: 9 }
};
const PET_OUTLINE = [58, 38, 24, 255];
const PET_FRAME = 24;

function petFrame(spec, step) {
  const pixels = new Array(PET_FRAME * PET_FRAME).fill(null);
  const put = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= PET_FRAME || y >= PET_FRAME) return;
    pixels[y * PET_FRAME + x] = colour;
  };
  const floor = PET_FRAME - 4;
  const bodyTop = floor - spec.height;
  const bodyLeft = 5;
  const bodyRight = 16;
  // Body: a rounded loaf, outlined.
  for (let y = bodyTop; y <= floor; y++) {
    for (let x = bodyLeft; x <= bodyRight; x++) {
      const edgeX = x === bodyLeft || x === bodyRight;
      const edgeY = y === bodyTop || y === floor;
      const corner = (x === bodyLeft || x === bodyRight) && (y === bodyTop || y === floor);
      if (corner) continue;
      put(x, y, edgeX || edgeY ? PET_OUTLINE : y > floor - 3 ? spec.dark : spec.body);
    }
  }
  // Head, sat forward.
  const headTop = bodyTop - 6;
  for (let y = headTop; y < bodyTop + 1; y++) {
    for (let x = 13; x <= 19; x++) {
      const edge = y === headTop || x === 13 || x === 19;
      if ((x === 13 || x === 19) && y === headTop) continue;
      put(x, y, edge ? PET_OUTLINE : spec.body);
    }
  }
  put(17, headTop + 3, PET_OUTLINE);
  if (spec.ears === "pointed") {
    put(14, headTop - 1, PET_OUTLINE); put(15, headTop - 1, spec.body);
    put(18, headTop - 1, PET_OUTLINE); put(17, headTop - 1, spec.body);
  } else if (spec.ears === "bill") {
    put(20, headTop + 3, PET_OUTLINE); put(21, headTop + 3, PET_OUTLINE); put(21, headTop + 4, PET_OUTLINE);
  } else {
    put(15, headTop - 1, PET_OUTLINE); put(18, headTop - 1, PET_OUTLINE);
  }
  if (spec.tail === "up") {
    for (let y = bodyTop - 4; y < bodyTop; y++) put(4, y, PET_OUTLINE);
    put(4, bodyTop - 4, spec.body);
  } else if (spec.tail === "flat") {
    put(3, bodyTop + 2, PET_OUTLINE); put(4, bodyTop + 2, spec.dark);
  }
  // Legs, swinging with the step.
  const swing = [[6, 13], [7, 12], [5, 14]][step % 3];
  for (const x of swing) {
    put(x, floor + 1, PET_OUTLINE);
    put(x, floor + 2, PET_OUTLINE);
  }
  return pixels;
}

function petStrip(spec) {
  const width = PET_FRAME * 3;
  const strip = new Array(width * PET_FRAME).fill(null);
  for (let step = 0; step < 3; step++) {
    const frame = petFrame(spec, step);
    for (let y = 0; y < PET_FRAME; y++) {
      for (let x = 0; x < PET_FRAME; x++) strip[y * width + step * PET_FRAME + x] = frame[y * PET_FRAME + x];
    }
  }
  return { width, height: PET_FRAME, pixels: strip };
}

function writeStrip(file, { width, height, pixels }) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixels[y * width + x] || [0, 0, 0, 0];
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
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32]) {
  writePng(new URL(`donut-${size}.png`, OUT_DIR), size, donut(size));
  console.log(`assets/ui/donut-${size}.png`);
}
const PET_DIR = new URL("../assets/pets/", import.meta.url);
mkdirSync(PET_DIR, { recursive: true });
for (const [id, spec] of Object.entries(PETS)) {
  writeStrip(new URL(`${id}-placeholder-v1.png`, PET_DIR), petStrip(spec));
  console.log(`assets/pets/${id}-placeholder-v1.png`);
}
