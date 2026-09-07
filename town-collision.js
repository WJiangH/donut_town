// Town collision: the baked walk mask plus the navigation helpers built on it.
// The mask comes from assets/town-walkmask.js (see scripts/build-town-walkmask.mjs).
(function () {
  function buildCollision(data) {
    const collision = { ready: false, cols: 0, rows: 0 };
    if (!data || !data.bits) return collision;

  const binary = atob(data.bits);
  const bits = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bits[i] = binary.charCodeAt(i);
  const { cols, rows } = data;
  Object.assign(collision, { ready: true, cols, rows });

  const cellAt = index => (bits[index >> 3] >> (index & 7)) & 1;
  const colOf = x => Math.floor((x / 100) * cols);
  const rowOf = y => Math.floor((y / 100) * rows);
  const centerX = col => ((col + 0.5) / cols) * 100;
  const centerY = row => ((row + 0.5) / rows) * 100;

  function isWalkableCell(col, row) {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
    return cellAt(row * cols + col) === 1;
  }

  collision.isWalkable = function (x, y) {
    return isWalkableCell(colOf(x), rowOf(y));
  };

  // Spiral outward until we land on ground: used for spawns and click targets.
  collision.nearestWalkable = function (x, y, fallback) {
    const col = Math.max(0, Math.min(cols - 1, colOf(x)));
    const row = Math.max(0, Math.min(rows - 1, rowOf(y)));
    if (isWalkableCell(col, row)) return { x, y };
    let best = null;
    let bestDistance = Infinity;
    for (let radius = 1; radius < Math.max(cols, rows); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (!isWalkableCell(col + dx, row + dy)) continue;
          const px = centerX(col + dx);
          const py = centerY(row + dy);
          const distance = (px - x) ** 2 + (py - y) ** 2;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { x: px, y: py };
          }
        }
      }
      if (best) return best;
    }
    return fallback ? { x: fallback.x, y: fallback.y } : { x, y };
  };

  function lineIsClear(fromX, fromY, toX, toY) {
    const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 0.25);
    for (let step = 1; step < steps; step++) {
      const x = fromX + ((toX - fromX) * step) / steps;
      const y = fromY + ((toY - fromY) * step) / steps;
      if (!collision.isWalkable(x, y)) return false;
    }
    return true;
  }

  // A* across the mask, then pull the corners straight so walking looks natural.
  collision.findPath = function (start, goal) {
    const from = collision.nearestWalkable(start.x, start.y);
    const to = collision.nearestWalkable(goal.x, goal.y);
    const startIndex = rowOf(from.y) * cols + colOf(from.x);
    const goalIndex = rowOf(to.y) * cols + colOf(to.x);
    if (startIndex === goalIndex) return [{ x: to.x, y: to.y }];

    const cost = new Float32Array(cols * rows).fill(Infinity);
    const cameFrom = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const open = [{ index: startIndex, score: 0 }];
    cost[startIndex] = 0;
    const heuristic = index => {
      const dx = Math.abs((index % cols) - (goalIndex % cols));
      const dy = Math.abs(((index / cols) | 0) - ((goalIndex / cols) | 0));
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };

    let found = false;
    while (open.length) {
      let bestSlot = 0;
      for (let i = 1; i < open.length; i++) if (open[i].score < open[bestSlot].score) bestSlot = i;
      const current = open.splice(bestSlot, 1)[0].index;
      if (current === goalIndex) { found = true; break; }
      if (closed[current]) continue;
      closed[current] = 1;
      const col = current % cols;
      const row = (current / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nextCol = col + dx;
          const nextRow = row + dy;
          if (!isWalkableCell(nextCol, nextRow)) continue;
          // Never squeeze diagonally between two blocked cells.
          if (dx && dy && (!isWalkableCell(col + dx, row) || !isWalkableCell(col, row + dy))) continue;
          const next = nextRow * cols + nextCol;
          if (closed[next]) continue;
          const step = dx && dy ? 1.414 : 1;
          const nextCost = cost[current] + step;
          if (nextCost >= cost[next]) continue;
          cost[next] = nextCost;
          cameFrom[next] = current;
          open.push({ index: next, score: nextCost + heuristic(next) });
        }
      }
    }
    if (!found) return [];

    const cells = [];
    for (let index = goalIndex; index !== -1 && index !== startIndex; index = cameFrom[index]) cells.push(index);
    cells.reverse();
    const points = cells.map(index => ({ x: centerX(index % cols), y: centerY((index / cols) | 0) }));
    if (points.length) points[points.length - 1] = { x: to.x, y: to.y };

    const smoothed = [];
    let anchor = from;
    for (let i = 0; i < points.length; i++) {
      const next = points[i + 1];
      if (next && lineIsClear(anchor.x, anchor.y, next.x, next.y)) continue;
      smoothed.push(points[i]);
      anchor = points[i];
    }
    return smoothed;
  };

  // Even spacing over the whole floor, so a crowd is not all in one square.
  // The order is fixed, so the same neighbour lands in the same place twice.
  collision.spreadPoints = function (count, minSpacing = 3) {
    const open = [];
    for (let row = 1; row < rows - 1; row++) {
      for (let col = 1; col < cols - 1; col++) {
        if (!isWalkableCell(col, row)) continue;
        if (!isWalkableCell(col - 1, row) || !isWalkableCell(col + 1, row)) continue;
        if (!isWalkableCell(col, row - 1) || !isWalkableCell(col, row + 1)) continue;
        // A fixed scramble of the grid: neighbouring cells are considered far
        // apart in time, which spreads the early picks over the whole map.
        const key = ((col * 73856093) ^ (row * 19349663)) >>> 0;
        open.push({ x: centerX(col), y: centerY(row), key });
      }
    }
    open.sort((left, right) => left.key - right.key);
    const picked = [];
    for (let spacing = minSpacing; spacing > 0.6 && picked.length < count; spacing *= 0.8) {
      for (const spot of open) {
        if (picked.length >= count) break;
        if (picked.some(taken => Math.hypot(taken.x - spot.x, (taken.y - spot.y) * 0.7) < spacing)) continue;
        picked.push({ x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10 });
      }
    }
    return picked;
  };

  // ?collision=1 paints the walkable mask over the map so it can be eyeballed.
  collision.showOverlay = function (worldSelector = "#mapWorld") {
    const world = document.querySelector(worldSelector);
    if (!world || world.querySelector(".collision-overlay")) return;
    const canvas = document.createElement("canvas");
    canvas.className = "collision-overlay";
    canvas.width = cols;
    canvas.height = rows;
    Object.assign(canvas.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      pointerEvents: "none", opacity: "0.55", zIndex: "5", imageRendering: "pixelated"
    });
    const context = canvas.getContext("2d");
    const image = context.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      const walkable = cellAt(i) === 1;
      image.data.set(walkable ? [40, 255, 120, 0] : [220, 30, 30, 255], i * 4);
    }
    context.putImageData(image, 0, 0);
    world.appendChild(canvas);
  };

    return collision;
  }

  window.TownCollision = buildCollision(window.TOWN_WALK_MASK);
  window.ChemPodCollision = buildCollision(window.CHEMPOD_WALK_MASK);

  if (new URLSearchParams(window.location.search).get("collision") === "1") {
    document.addEventListener("DOMContentLoaded", () => {
      window.TownCollision.showOverlay?.("#mapWorld");
      window.ChemPodCollision.showOverlay?.("#chemPodWorld");
    });
  }
})();
