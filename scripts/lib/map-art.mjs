// Shared reading of the town map art: PNG decode, surface classes, cell sums.
import { inflateSync } from "node:zlib";

// One mask cell per 8x8 art pixels: fine enough for the narrowest garden path.
export const CELL = 8;

export function readPng(buffer) {
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
export function classify({ width, height, channels, pixels }) {
  const size = width * height;
  const path = new Uint8Array(size);
  const lawn = new Uint8Array(size);
  const water = new Uint8Array(size);
  const veryDark = new Uint8Array(size);
  const scenery = new Uint8Array(size);
  const bloom = new Uint8Array(size);
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
    // Blossoms and ripe crops: saturated colour that is neither grass nor paving.
    const span = Math.max(r, g, b) - Math.min(r, g, b);
    bloom[i] = !isWater && !isPath && !isGrass && span > 55 && luma > 95 && luma < 235 && b < r + 40 ? 1 : 0;
  }
  return { path, lawn, water, veryDark, scenery, bloom };
}

export function cellFractions(layer, width, cols, rows) {
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

