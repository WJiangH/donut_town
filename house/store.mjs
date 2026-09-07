// A member's own room: which decorations they have put down, and where.
// The grid is the room's own coordinate system, not the map's percentages.
export const HOUSE_GRID = Object.freeze({ cols: 14, rows: 9 });

export function homeOwned(owned, catalog) {
  return [...new Set([...owned, ...catalog.items.filter(item => item.starter && item.kind === 'decoration').map(item => item.id)])];
}
export function starterLayout(catalog) {
  const slots = [{id:'starter-chair',x:3,y:2},{id:'starter-lamp',x:6,y:2},{id:'starter-rug',x:7,y:5}];
  return {items:slots.filter(slot => catalog.items.some(item => item.id === slot.id && item.starter))};
}

export function validateLayout(input, { ownedIds = [], catalog }) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.items)) throw new Error('invalid_layout');
  if (input.items.length > HOUSE_GRID.cols * HOUSE_GRID.rows) throw new Error('invalid_layout');
  const placeable = new Set(catalog.items.filter(item => item.kind === 'decoration' && ownedIds.includes(item.id)).map(item => item.id));
  const items = [];
  const seenIds = new Set();
  const occupied = [];
  for (const entry of input.items) {
    if (!entry || typeof entry !== 'object') throw new Error('invalid_layout');
    const { id, x, y } = entry;
    // You can only put down what you own, once, on a cell of your own floor.
    if (!placeable.has(id) || seenIds.has(id)) throw new Error('invalid_layout');
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x*4) || !Number.isInteger(y*4)) throw new Error('invalid_layout');
    if (x < 0 || y < 0 || x >= HOUSE_GRID.cols || y >= HOUSE_GRID.rows) throw new Error('invalid_layout');
    const item = catalog.items.find(item => item.id === id);
    const {w = 1, h = 1} = item.footprint || {};
    if (x+w > HOUSE_GRID.cols || y+h > HOUSE_GRID.rows) throw new Error('invalid_layout');
    if (occupied.some(b => x<b.x+b.w && x+w>b.x && y<b.y+b.h && y+h>b.y)) throw new Error('invalid_layout');
    occupied.push({x,y,w,h});
    seenIds.add(id);
    items.push({ id, x, y });
  }
  if (input.roomId !== undefined) {
    if (input.roomId !== 'room-cottage' && !catalog.items.some(item => item.kind === 'room' && item.id === input.roomId && ownedIds.includes(item.id))) throw new Error('invalid_layout');
    return {items, roomId:input.roomId};
  }
  return { items };
}

// Anything the member no longer owns quietly leaves the room rather than
// breaking the whole layout.
export function readLayout(raw, { ownedIds = [], catalog }) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { items: [] }; }
  const kept = (Array.isArray(parsed?.items) ? parsed.items : []).filter(entry => ownedIds.includes(entry?.id));
  const roomId = parsed?.roomId === undefined ? undefined : catalog.items.some(item=>item.kind==='room' && item.id===parsed.roomId && ownedIds.includes(item.id)) ? parsed.roomId : 'room-cottage';
  try { return validateLayout({ items: kept, ...(roomId ? {roomId} : {}) }, { ownedIds, catalog }); } catch { return { items: [] }; }
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
    const raw = await this.command(['HGET', this.key, key]);
    return raw === null ? validateLayout(starterLayout(options.catalog), options) : readLayout(raw, options);
  }
  async save(key, layout) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw new Error('invalid_member_key');
    await this.command(['HSET', this.key, key, JSON.stringify(layout)]);
    return layout;
  }
}
