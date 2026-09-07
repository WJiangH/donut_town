// A member's own room: which decorations they have put down, and where.
// The grid is the room's own coordinate system, not the map's percentages.
export const HOUSE_GRID = Object.freeze({ cols: 14, rows: 9 });

export function validateLayout(input, { ownedIds = [], catalog }) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.items)) throw new Error('invalid_layout');
  if (input.items.length > HOUSE_GRID.cols * HOUSE_GRID.rows) throw new Error('invalid_layout');
  const placeable = new Set(catalog.items.filter(item => item.kind === 'decoration' && ownedIds.includes(item.id)).map(item => item.id));
  const items = [];
  const seenIds = new Set();
  const seenCells = new Set();
  for (const entry of input.items) {
    if (!entry || typeof entry !== 'object') throw new Error('invalid_layout');
    const { id, x, y } = entry;
    // You can only put down what you own, once, on a cell of your own floor.
    if (!placeable.has(id) || seenIds.has(id)) throw new Error('invalid_layout');
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('invalid_layout');
    if (x < 0 || y < 0 || x >= HOUSE_GRID.cols || y >= HOUSE_GRID.rows) throw new Error('invalid_layout');
    const cell = `${x},${y}`;
    if (seenCells.has(cell)) throw new Error('invalid_layout');
    seenIds.add(id);
    seenCells.add(cell);
    items.push({ id, x, y });
  }
  return { items };
}

// Anything the member no longer owns quietly leaves the room rather than
// breaking the whole layout.
export function readLayout(raw, { ownedIds = [], catalog }) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { items: [] }; }
  const kept = (parsed?.items || []).filter(entry => ownedIds.includes(entry?.id));
  try { return validateLayout({ items: kept }, { ownedIds, catalog }); } catch { return { items: [] }; }
}

export class HouseStore {
  constructor({ url = '', token = '', fetchImpl = fetch, key = 'donut-town:house:v1' } = {}) {
    this.url = url; this.token = token; this.fetch = fetchImpl; this.key = key;
  }
  get configured() { return Boolean(this.url && this.token); }
  async command(args, attempt = 0) {
    if (!this.configured) throw new Error('house_store_unavailable');
    try {
      return await this.send(args);
    } catch (error) {
      if (attempt > 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
      return this.command(args, attempt + 1);
    }
  }
  async send(args) {
    const response = await this.fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('house_store_unavailable');
    const result = await response.json();
    if (result.error) throw new Error('house_store_unavailable');
    return result.result;
  }
  async load(key, options) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    if (!this.configured) return { items: [] };
    return readLayout(await this.command(['HGET', this.key, key]), options);
  }
  async save(key, layout) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    await this.command(['HSET', this.key, key, JSON.stringify(layout)]);
    return layout;
  }
}
