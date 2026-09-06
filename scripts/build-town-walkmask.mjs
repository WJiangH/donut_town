// Bakes the town collision mask straight out of the map art.
// Run: node scripts/build-town-walkmask.mjs [--preview scratch/walkmask.png]
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const MAP_PATH = new URL("../assets/donut-town-map-v2.png", import.meta.url);
const OUTPUT_PATH = new URL("../assets/town-walkmask.js", import.meta.url);
// One mask cell per 8x8 art pixels: fine enough for the narrowest garden path.
const CELL = 8;

// Bridges and shaded crossings the colour pass cannot see, in map percentages.
const ALLOW_SEGMENTS = [
  { from: [10.0, 30.0], to: [18.2, 33.8], width: 1.0, note: "west river footbridge" },
  { from: [76.6, 62.2], to: [85.4, 59.4], width: 1.0, note: "east stone arch bridge" },
  { from: [57.6, 73.6], to: [66.4, 70.6], width: 1.0, note: "south-east plank bridge" }
];
// Places the art reads as walkable but the world should not let you stand on.
const BLOCK_SHAPES = [];

function readPng(buffer) {
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("Interlaced PNGs are not supported");
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    offset += length + 12;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: depth ${bitDepth}, colour type ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const target = y * stride;
    const previous = target - stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[target + x - channels] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }
      pixels[target + x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

// Surface classes, tuned against the v2 map art.
function classify({ width, height, channels, pixels }) {
  const size = width * height;
  const path = new Uint8Array(size);
  const lawn = new Uint8Array(size);
  const water = new Uint8Array(size);
  const veryDark = new Uint8Array(size);
  const scenery = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const r = pixels[i * channels];
    const g = pixels[i * channels + 1];
    const b = pixels[i * channels + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const isWater = b > r + 25 && b > 80;
    const isPath = !isWater && r > 150 && r - b > 40 && r >= g && g > b;
    const isGrass = !isWater && !isPath && g > r && g > b + 35;
    water[i] = isWater ? 1 : 0;
    path[i] = isPath ? 1 : 0;
    lawn[i] = isGrass && luma >= 112 ? 1 : 0;
    veryDark[i] = !isWater && luma < 80 ? 1 : 0;
    // Roofs, walls, fences, stone: anything that is neither ground nor water.
    scenery[i] = !isWater && !isPath && !isGrass ? 1 : 0;
  }
  return { path, lawn, water, veryDark, scenery };
}

function cellFractions(layer, width, cols, rows) {
  const out = new Float32Array(cols * rows);
  const area = CELL * CELL;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      for (let y = 0; y < CELL; y++) {
        const base = (row * CELL + y) * width + col * CELL;
        for (let x = 0; x < CELL; x++) sum += layer[base + x];
      }
      out[row * cols + col] = sum / area;
    }
  }
  return out;
}

function label(mask, cols, rows) {
  const labels = new Int32Array(cols * rows).fill(-1);
  const sizes = [];
  const queue = new Int32Array(cols * rows);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    let count = 0;
    while (head < tail) {
      const index = queue[head++];
      count++;
      const col = index % cols;
      const row = (index / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = col + dx;
          const ny = row + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const next = ny * cols + nx;
          if (!mask[next] || labels[next] !== -1) continue;
          labels[next] = id;
          queue[tail++] = next;
        }
      }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}

function dropSmall(mask, cols, rows, minimum) {
  const { labels, sizes } = label(mask, cols, rows);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = labels[i] >= 0 && sizes[labels[i]] >= minimum ? 1 : 0;
  return out;
}

function morph(mask, cols, rows, grow) {
  const out = new Uint8Array(mask.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let hit = grow ? 0 : 1;
      for (let dy = -1; dy <= 1 && hit === (grow ? 0 : 1); dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = col + dx;
          const ny = row + dy;
          const outside = nx < 0 || ny < 0 || nx >= cols || ny >= rows;
          const value = outside ? 0 : mask[ny * cols + nx];
          if (grow && value) { hit = 1; break; }
          if (!grow && !value) { hit = 0; break; }
        }
      }
      out[row * cols + col] = hit;
    }
  }
  return out;
}

function fillSmallHoles(mask, cols, rows, maximum) {
  const holes = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) holes[i] = mask[i] ? 0 : 1;
  const { labels, sizes } = label(holes, cols, rows);
  // Anything touching the border is open space, never a hole.
  const border = new Set();
  for (let col = 0; col < cols; col++) {
    if (labels[col] >= 0) border.add(labels[col]);
    if (labels[(rows - 1) * cols + col] >= 0) border.add(labels[(rows - 1) * cols + col]);
  }
  for (let row = 0; row < rows; row++) {
    if (labels[row * cols] >= 0) border.add(labels[row * cols]);
    if (labels[row * cols + cols - 1] >= 0) border.add(labels[row * cols + cols - 1]);
  }
  const out = Uint8Array.from(mask);
  for (let i = 0; i < mask.length; i++) {
    const id = labels[i];
    if (id >= 0 && !border.has(id) && sizes[id] <= maximum) out[i] = 1;
  }
  return out;
}

function distanceToSegment(x, y, [x1, y1], [x2, y2]) {
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
}

function writePreview(file, { width, height, channels, pixels }, mask, cols, rows) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * channels;
      const walkable = mask[Math.min(rows - 1, (y / CELL) | 0) * cols + Math.min(cols - 1, (x / CELL) | 0)];
      const target = y * stride + 1 + x * 3;
      const tint = walkable ? [40, 255, 120] : [200, 20, 20];
      for (let c = 0; c < 3; c++) raw[target + c] = Math.round(pixels[source + c] * 0.55 + tint[c] * 0.45);
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
  header[9] = 2;
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

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

const image = readPng(readFileSync(MAP_PATH));
const cols = Math.floor(image.width / CELL);
const rows = Math.floor(image.height / CELL);
const layers = classify(image);
const fraction = Object.fromEntries(
  Object.entries(layers).map(([name, layer]) => [name, cellFractions(layer, image.width, cols, rows)])
);

const ground = new Float32Array(cols * rows);
for (let i = 0; i < ground.length; i++) ground[i] = fraction.path[i] + fraction.lawn[i];

// Strict cells are unmistakable ground; loose cells extend them under tree shade.
const strict = new Uint8Array(cols * rows);
const loose = new Uint8Array(cols * rows);
for (let i = 0; i < strict.length; i++) {
  strict[i] = ground[i] > 0.72 && fraction.veryDark[i] < 0.06 && fraction.water[i] < 0.01 && fraction.scenery[i] < 0.12 ? 1 : 0;
  loose[i] = ground[i] > 0.45 && fraction.veryDark[i] < 0.18 && fraction.water[i] < 0.02 && fraction.scenery[i] < 0.30 ? 1 : 0;
}

const anchors = dropSmall(strict, cols, rows, 8);
const { labels: looseLabels } = label(loose, cols, rows);
const anchored = new Set();
for (let i = 0; i < loose.length; i++) if (anchors[i] && looseLabels[i] >= 0) anchored.add(looseLabels[i]);
let mask = new Uint8Array(cols * rows);
for (let i = 0; i < mask.length; i++) mask[i] = looseLabels[i] >= 0 && anchored.has(looseLabels[i]) ? 1 : 0;

for (const segment of ALLOW_SEGMENTS) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 100;
      const y = ((row + 0.5) / rows) * 100;
      if (distanceToSegment(x, y, segment.from, segment.to) <= segment.width) mask[row * cols + col] = 1;
    }
  }
}

mask = morph(morph(mask, cols, rows, true), cols, rows, false);
mask = fillSmallHoles(mask, cols, rows, 20);

for (const shape of BLOCK_SHAPES) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 100;
      const y = ((row + 0.5) / rows) * 100;
      if (x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom) mask[row * cols + col] = 0;
    }
  }
}

// The town is one place: keep only what you can actually walk to.
const { labels: finalLabels, sizes: finalSizes } = label(mask, cols, rows);
const main = finalSizes.indexOf(Math.max(...finalSizes));
const dropped = [];
for (let id = 0; id < finalSizes.length; id++) {
  if (id === main) continue;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < mask.length; i++) {
    if (finalLabels[i] !== id) continue;
    sumX += (i % cols) / cols * 100;
    sumY += ((i / cols) | 0) / rows * 100;
  }
  dropped.push({ size: finalSizes[id], x: (sumX / finalSizes[id]).toFixed(1), y: (sumY / finalSizes[id]).toFixed(1) });
}
for (let i = 0; i < mask.length; i++) mask[i] = finalLabels[i] === main ? 1 : 0;

const bytes = Buffer.alloc(Math.ceil(mask.length / 8));
for (let i = 0; i < mask.length; i++) if (mask[i]) bytes[i >> 3] |= 1 << (i & 7);

writeFileSync(OUTPUT_PATH, `// Generated by scripts/build-town-walkmask.mjs - do not edit by hand.
window.TOWN_WALK_MASK = {
  cols: ${cols},
  rows: ${rows},
  bits: "${bytes.toString("base64")}"
};
`);

const previewIndex = process.argv.indexOf("--preview");
if (previewIndex > -1 && process.argv[previewIndex + 1]) {
  writePreview(process.argv[previewIndex + 1], image, mask, cols, rows);
}

const walkable = mask.reduce((total, value) => total + value, 0);
console.log(`grid ${cols}x${rows} cells, walkable ${(100 * walkable / mask.length).toFixed(1)}%, ${bytes.length} bytes`);
console.log(`dropped ${dropped.length} unreachable island(s)`, dropped.slice(0, 8));
