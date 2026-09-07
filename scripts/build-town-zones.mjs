// Derives the map tags that can be measured rather than hand-placed: open lawn,
// riverbank viewpoints and planted beds. Hand-placed furniture lives in
// town-zones.js. Run: node scripts/build-town-zones.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { CELL, readPng, classify, cellFractions } from "./lib/map-art.mjs";

const MAP_PATH = new URL("../assets/donut-town-map-v2.png", import.meta.url);
const MASK_PATH = new URL("../assets/town-walkmask.js", import.meta.url);
const OUTPUT_PATH = new URL("../assets/town-zones-auto.js", import.meta.url);

// The fenced crop blocks, which read as scenery but are walked like a garden.
const PLOTS = [
  { left: 74.0, right: 82.6, top: 7.2, bottom: 20.2, note: "farm west plots" },
  { left: 85.0, right: 92.0, top: 16.0, bottom: 25.2, note: "farm east plots" }
];

const image = readPng(readFileSync(MAP_PATH));
const cols = Math.floor(image.width / CELL);
const rows = Math.floor(image.height / CELL);
const layers = classify(image);
const lawn = cellFractions(layers.lawn, image.width, cols, rows);
const water = cellFractions(layers.water, image.width, cols, rows);
const bloom = cellFractions(layers.bloom, image.width, cols, rows);

const maskSource = readFileSync(MASK_PATH, "utf8");
const bits = Buffer.from(maskSource.match(/bits: "([^"]+)"/)[1], "base64");
const walkable = index => (bits[index >> 3] >> (index & 7)) & 1;

const x = col => Math.round(((col + 0.5) / cols) * 1000) / 10;
const y = row => Math.round(((row + 0.5) / rows) * 1000) / 10;
const inside = (px, py, shape) => px >= shape.left && px <= shape.right && py >= shape.top && py <= shape.bottom;

// Chamfer distance to the nearest cell outside the set: the middle of a meadow
// scores highest, so zones land where there is actually room to sit.
function depthMap(member) {
  const depth = new Float32Array(cols * rows);
  for (let i = 0; i < depth.length; i++) depth[i] = member[i] ? Infinity : 0;
  const sweep = (order, offsets) => {
    for (const i of order) {
      if (!member[i]) continue;
      const col = i % cols;
      const row = (i / cols) | 0;
      for (const [dx, dy, cost] of offsets) {
        const nx = col + dx;
        const ny = row + dy;
        const near = nx < 0 || ny < 0 || nx >= cols || ny >= rows ? 0 : depth[ny * cols + nx];
        depth[i] = Math.min(depth[i], near + cost);
      }
    }
  };
  const forward = [...depth.keys()];
  sweep(forward, [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]]);
  sweep(forward.reverse(), [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]]);
  return depth;
}

// Greedy farthest-point sampling: take the roomiest cell, clear its
// surroundings, repeat. Spacing is in map percent.
function sample(member, spacing, { minDepth = 1, cap = Infinity, radiusFor = null } = {}) {
  const depth = depthMap(member);
  const order = [...depth.keys()].filter(i => member[i] && depth[i] >= minDepth).sort((a, b) => depth[b] - depth[a]);
  const picked = [];
  for (const index of order) {
    if (picked.length >= cap) break;
    const px = x(index % cols);
    const py = y((index / cols) | 0);
    if (picked.some(spot => Math.hypot(spot.x - px, (spot.y - py) * 0.66) < spacing)) continue;
    const spot = { x: px, y: py };
    if (radiusFor) spot.radius = radiusFor(depth[index]);
    picked.push(spot);
  }
  return picked;
}

const isWalkable = new Uint8Array(cols * rows);
for (let i = 0; i < isWalkable.length; i++) isWalkable[i] = walkable(i);

// Open lawn: grass you can stand on, away from the paving.
const lawnCells = new Uint8Array(cols * rows);
for (let i = 0; i < lawnCells.length; i++) lawnCells[i] = isWalkable[i] && lawn[i] > 0.5 ? 1 : 0;
const lawns = sample(lawnCells, 2.8, {
  minDepth: 1.3,
  radiusFor: depth => Math.min(3.5, Math.max(1.8, Math.round(depth * 0.7 * 10) / 10))
});

// Riverbanks, pond edges and bridge decks: somewhere to stop and look.
const wetCells = new Uint8Array(cols * rows);
for (let i = 0; i < wetCells.length; i++) wetCells[i] = water[i] > 0.25 ? 1 : 0;
const bankCells = new Uint8Array(cols * rows);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const index = row * cols + col;
    if (!isWalkable[index]) continue;
    let wet = false;
    for (let dy = -2; dy <= 2 && !wet; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = col + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (wetCells[ny * cols + nx]) { wet = true; break; }
      }
    }
    bankCells[index] = wet ? 1 : 0;
  }
}
const banks = sample(bankCells, 3.8, { minDepth: 0 });

// Planted ground: the crop blocks plus every flowerbed you can walk up to.
const bedCells = new Uint8Array(cols * rows);
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const index = row * cols + col;
    if (!isWalkable[index]) continue;
    const px = x(col);
    const py = y(row);
    if (PLOTS.some(plot => inside(px, py, plot))) { bedCells[index] = 1; continue; }
    let beside = false;
    for (let dy = -2; dy <= 2 && !beside; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = col + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (bloom[ny * cols + nx] > 0.4) { beside = true; break; }
      }
    }
    bedCells[index] = beside ? 1 : 0;
  }
}
const beds = sample(bedCells, 2.2, { minDepth: 0 });

const entries = [
  ...lawns.map(spot => ({ action: "sitGrass", x: spot.x, y: spot.y, radius: spot.radius, seats: spot.radius >= 2.4 ? 4 : 2 })),
  ...banks.map(spot => ({ action: ["lookout", "fish"], x: spot.x, y: spot.y, radius: 1.9, seats: 2 })),
  ...beds.map(spot => ({ action: "garden", x: spot.x, y: spot.y, radius: 1.5, seats: 1 }))
];

writeFileSync(OUTPUT_PATH, `// Generated by scripts/build-town-zones.mjs - do not edit by hand.
// Lawn, riverbank and planted-bed tags measured off the map art.
window.TOWN_ZONES_AUTO = [
${entries.map(entry => `  { action: ${JSON.stringify(entry.action)}, scene: "town", x: ${entry.x}, y: ${entry.y}, radius: ${entry.radius}, seats: ${entry.seats} }`).join(",\n")}
];
`);
console.log(`lawn ${lawns.length}, waterside ${banks.length}, planted ${beds.length} - ${entries.length} measured tags`);
