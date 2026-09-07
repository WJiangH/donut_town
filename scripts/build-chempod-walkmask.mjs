// Bakes the Chem Pod floor out of the interior art, the same way the town
// walk mask is baked. Run: node scripts/build-chempod-walkmask.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { CELL, readPng } from "./lib/map-art.mjs";

const ART_PATH = new URL("../assets/chem-pod-interior-v2.png", import.meta.url);
const OUTPUT_PATH = new URL("../assets/chempod-walkmask.js", import.meta.url);
// The doorway at the bottom of the room: the floor is whatever you can reach.
const DOOR = { x: 50, y: 86 };
// The rug reads as cloth rather than tile, but you walk on it all the same.
const ALLOW_SHAPES = [{ left: 21.5, right: 50, top: 68.5, bottom: 83, note: "reading rug" }];
// What stands on the rug stays solid.
const BLOCK_SHAPES = [
  { left: 26, right: 46.5, top: 66, bottom: 82.5, note: "round table and chairs" },
  // Wall tops share the floor's stone: nobody should be standing on them.
  { left: 6, right: 34, top: 83, bottom: 88, note: "front parapet, left of the door" },
  { left: 0, right: 11.5, top: 52, bottom: 88, note: "west wall rim" },
  { left: 83, right: 100, top: 34, bottom: 66, note: "east counter top" },
  { left: 32.5, right: 63.5, top: 42, bottom: 63, note: "central lab bench" }
];

const image = readPng(readFileSync(ART_PATH));
const { width, height, channels, pixels } = image;
const cols = Math.floor(width / CELL);
const rows = Math.floor(height / CELL);

// Warm stone tiles, and the rug woven into them, read as floor; the counters,
// cabinets, benches and walls do not.
const floor = new Uint8Array(width * height);
for (let i = 0; i < floor.length; i++) {
  const r = pixels[i * channels];
  const g = pixels[i * channels + 1];
  const b = pixels[i * channels + 2];
  floor[i] = r > 150 && r < 245 && g > 115 && g < 205 && b > 75 && b < 175 && r - b > 40 && r - b < 115 && g - b > 20 ? 1 : 0;
}

const open = new Uint8Array(cols * rows);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    let sum = 0;
    for (let y = 0; y < CELL; y++) {
      const base = (row * CELL + y) * width + col * CELL;
      for (let x = 0; x < CELL; x++) sum += floor[base + x];
    }
    open[row * cols + col] = sum / (CELL * CELL) > 0.25 ? 1 : 0;
  }
}

for (const shape of ALLOW_SHAPES) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 100;
      const y = ((row + 0.5) / rows) * 100;
      if (x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom) open[row * cols + col] = 1;
    }
  }
}
for (const shape of BLOCK_SHAPES) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 100;
      const y = ((row + 0.5) / rows) * 100;
      if (x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom) open[row * cols + col] = 0;
    }
  }
}

// Flood from the doorway: counter tops share the floor's colour but not its ground.
// Tile seams and shadows break the aisles into fragments; close them first:
// grow twice to bridge the seams, shrink twice to give the furniture back.
function morph(cells, grow) {
  const out = new Uint8Array(cells.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let hit = grow ? 0 : 1;
      for (let dy = -1; dy <= 1 && hit === (grow ? 0 : 1); dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = col + dx;
          const ny = row + dy;
          const outside = nx < 0 || ny < 0 || nx >= cols || ny >= rows;
          const value = outside ? 0 : cells[ny * cols + nx];
          if (grow && value) { hit = 1; break; }
          if (!grow && !value) { hit = 0; break; }
        }
      }
      out[row * cols + col] = hit;
    }
  }
  return out;
}
let closedOpen = morph(morph(open, true), true);
closedOpen = morph(morph(closedOpen, false), false);
open.set(closedOpen);

const start = Math.floor((DOOR.y / 100) * rows) * cols + Math.floor((DOOR.x / 100) * cols);
const mask = new Uint8Array(cols * rows);
const queue = [start];
mask[start] = 1;
while (queue.length) {
  const index = queue.pop();
  const col = index % cols;
  const row = (index / cols) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = col + dx;
    const ny = row + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    const next = ny * cols + nx;
    if (mask[next] || !open[next]) continue;
    mask[next] = 1;
    queue.push(next);
  }
}

// Close the gaps the tile seams leave behind, then fill the small holes.
const grow = new Uint8Array(mask.length);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    let hit = 0;
    for (let dy = -1; dy <= 1 && !hit; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = col + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (mask[ny * cols + nx]) { hit = 1; break; }
      }
    }
    grow[row * cols + col] = hit;
  }
}
const closed = new Uint8Array(mask.length);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    let all = 1;
    for (let dy = -1; dy <= 1 && all; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = col + dx;
        const ny = row + dy;
        const value = nx < 0 || ny < 0 || nx >= cols || ny >= rows ? 0 : grow[ny * cols + nx];
        if (!value) { all = 0; break; }
      }
    }
    closed[row * cols + col] = all;
  }
}

const bytes = Buffer.alloc(Math.ceil(closed.length / 8));
for (let i = 0; i < closed.length; i++) if (closed[i]) bytes[i >> 3] |= 1 << (i & 7);

writeFileSync(OUTPUT_PATH, `// Generated by scripts/build-chempod-walkmask.mjs - do not edit by hand.
window.CHEMPOD_WALK_MASK = {
  cols: ${cols},
  rows: ${rows},
  bits: "${bytes.toString("base64")}"
};
`);

const walkable = closed.reduce((total, value) => total + value, 0);
let minX = 100, maxX = 0, minY = 100, maxY = 0;
for (let i = 0; i < closed.length; i++) {
  if (!closed[i]) continue;
  const x = ((i % cols) / cols) * 100;
  const y = (((i / cols) | 0) / rows) * 100;
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
console.log(`grid ${cols}x${rows}, floor ${(100 * walkable / closed.length).toFixed(1)}% of the art`);
console.log(`floor spans x ${minX.toFixed(1)}-${maxX.toFixed(1)}%, y ${minY.toFixed(1)}-${maxY.toFixed(1)}%`);
