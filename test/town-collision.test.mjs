import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The collision module is a browser script, so give it the globals it expects.
function loadCollision() {
  const scope = {window: {location: {search: ''}}, document: {addEventListener() {}}, atob};
  scope.window.window = scope.window;
  for (const file of ['../assets/town-walkmask.js', '../town-collision.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    new Function('window', 'document', 'atob', source)(scope.window, scope.document, atob);
  }
  return scope.window.TownCollision;
}

const collision = loadCollision();

test('the walk mask covers the painted roads and keeps the scenery solid', () => {
  assert.equal(collision.ready, true);
  const walkable = [[51, 20], [44, 44], [50, 50], [50, 59], [19.5, 80], [83.6, 84], [13, 31], [86, 60]];
  for (const [x, y] of walkable) assert.ok(collision.isWalkable(x, y), `expected ground at ${x},${y}`);
  // Fountain basin, cottage roofs, the river and the fenced farm plots.
  const blocked = [[50, 44], [22, 42], [69, 39], [93, 42], [88, 12], [4, 6]];
  for (const [x, y] of blocked) assert.ok(!collision.isWalkable(x, y), `expected an obstacle at ${x},${y}`);
});

test('every walkable cell belongs to one island, so nothing is stranded', () => {
  const {cols, rows} = collision;
  let start = null;
  const walkableCells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!collision.isWalkable(((col + 0.5) / cols) * 100, ((row + 0.5) / rows) * 100)) continue;
      walkableCells.push(row * cols + col);
      start ??= row * cols + col;
    }
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const index = queue.pop();
    const col = index % cols;
    const row = (index / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nextCol = col + dx;
        const nextRow = row + dy;
        if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) continue;
        const next = nextRow * cols + nextCol;
        if (seen.has(next)) continue;
        if (!collision.isWalkable(((nextCol + 0.5) / cols) * 100, ((nextRow + 0.5) / rows) * 100)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, walkableCells.length);
});

test('routes across town stay on ground the whole way, bridges included', () => {
  const start = {x: 50, y: 59};
  for (const goal of [{x: 20, y: 80}, {x: 13, y: 31}, {x: 83.6, y: 84}, {x: 50.3, y: 7.4}, {x: 92, y: 72}]) {
    const path = collision.findPath(start, goal);
    assert.ok(path.length, `no route to ${goal.x},${goal.y}`);
    let previous = start;
    for (const point of path) {
      const steps = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / 0.2);
      for (let step = 0; step <= steps; step++) {
        const x = previous.x + ((point.x - previous.x) * step) / steps;
        const y = previous.y + ((point.y - previous.y) * step) / steps;
        assert.ok(collision.isWalkable(x, y), `route to ${goal.x},${goal.y} crosses ${x.toFixed(1)},${y.toFixed(1)}`);
      }
      previous = point;
    }
    assert.ok(Math.hypot(previous.x - goal.x, previous.y - goal.y) < 2);
  }
});

test('spots inside buildings snap out to the nearest ground', () => {
  for (const [x, y] of [[22, 42], [50, 41], [88, 12]]) {
    const spot = collision.nearestWalkable(x, y);
    assert.ok(collision.isWalkable(spot.x, spot.y));
    assert.ok(Math.hypot(spot.x - x, spot.y - y) < 12);
  }
});
