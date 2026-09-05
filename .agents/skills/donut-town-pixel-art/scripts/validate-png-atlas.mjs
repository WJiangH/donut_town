#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function usage() {
  console.error("Usage: node validate-png-atlas.mjs <file.png> <columns> <rows>");
  process.exit(2);
}

const [, , inputPath, columnsArg, rowsArg] = process.argv;
if (!inputPath || !columnsArg || !rowsArg) usage();

const columns = Number(columnsArg);
const rows = Number(rowsArg);
if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
  fail("columns and rows must be positive integers");
}

const data = fs.readFileSync(inputPath);
if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail("file is not a PNG");

let offset = 8;
let header;
let hasTransparencyChunk = false;
const idatParts = [];

while (offset + 12 <= data.length) {
  const length = data.readUInt32BE(offset);
  const type = data.subarray(offset + 4, offset + 8).toString("ascii");
  const chunk = data.subarray(offset + 8, offset + 8 + length);
  if (type === "IHDR") {
    header = {
      width: chunk.readUInt32BE(0),
      height: chunk.readUInt32BE(4),
      bitDepth: chunk[8],
      colorType: chunk[9],
      interlace: chunk[12]
    };
  }
  if (type === "tRNS") hasTransparencyChunk = true;
  if (type === "IDAT") idatParts.push(chunk);
  offset += 12 + length;
  if (type === "IEND") break;
}

if (!header) fail("missing PNG IHDR chunk");
if (header.bitDepth !== 8) fail(`unsupported bit depth ${header.bitDepth}; expected 8`);
if (header.interlace !== 0) fail("interlaced PNGs are not supported by this validator");

const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const channels = channelsByColorType[header.colorType];
if (!channels) fail(`unsupported PNG color type ${header.colorType}`);

const carriesAlpha = header.colorType === 4 || header.colorType === 6 || hasTransparencyChunk;
if (!carriesAlpha) fail("PNG has no alpha channel or transparency chunk");

let cornerAlpha = "not sampled";
if (header.colorType === 4 || header.colorType === 6) {
  const bytesPerPixel = channels;
  const stride = header.width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rowsData = [];
  let sourceOffset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const scanline = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;
    const previous = rowsData[y - 1];

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
      const up = previous ? previous[x] : 0;
      const upLeft = previous && x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 1) scanline[x] = (scanline[x] + left) & 255;
      else if (filter === 2) scanline[x] = (scanline[x] + up) & 255;
      else if (filter === 3) scanline[x] = (scanline[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        scanline[x] = (scanline[x] + predictor) & 255;
      } else if (filter !== 0) fail(`unsupported PNG filter ${filter}`);
    }
    rowsData.push(scanline);
  }

  const alphaIndex = channels - 1;
  const alphaAt = (x, y) => rowsData[y][x * channels + alphaIndex];
  const corners = [
    alphaAt(0, 0),
    alphaAt(header.width - 1, 0),
    alphaAt(0, header.height - 1),
    alphaAt(header.width - 1, header.height - 1)
  ];
  cornerAlpha = corners.join(",");
  if (corners.some(alpha => alpha !== 0)) fail(`outer corners are not transparent: ${cornerAlpha}`);
}

const exactGrid = header.width % columns === 0 && header.height % rows === 0;
const cellWidth = header.width / columns;
const cellHeight = header.height / rows;

console.log(`PASS: ${path.basename(inputPath)}`);
console.log(`size=${header.width}x${header.height} grid=${columns}x${rows}`);
console.log(`cell=${cellWidth.toFixed(2)}x${cellHeight.toFixed(2)} exact_grid=${exactGrid}`);
console.log(`color_type=${header.colorType} alpha=yes corner_alpha=${cornerAlpha}`);
if (!exactGrid) console.warn("WARN: dimensions are not evenly divisible by the requested grid; CSS can use fractional cells, but inspect alignment visually.");
