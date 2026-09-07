import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUSE_GRID, validateLayout, readLayout, HouseStore } from '../house/store.mjs';
import { loadCatalog } from '../shop/store.mjs';

const catalog = loadCatalog();
const owned = ['deco-rug', 'deco-fern', 'pet-cat'];
const options = { ownedIds: owned, catalog };

// The handler for one route, from its first line to wherever the next route begins.
function routeSource(server, path) {
  const start = server.indexOf(`url.pathname === "${path}"`);
  const next = server.indexOf('url.pathname === "/api/', server.indexOf('\n', start));
  return server.slice(start, next > start ? next : undefined);
}


test('a room only holds decorations the member owns, one to a square', () => {
  assert.deepEqual(validateLayout({ items: [{ id: 'deco-rug', x: 0, y: 0 }, { id: 'deco-fern', x: 13, y: 8 }] }, options), {
    items: [{ id: 'deco-rug', x: 0, y: 0 }, { id: 'deco-fern', x: 13, y: 8 }]
  });
  for (const broken of [
    { items: [{ id: 'deco-lamp', x: 1, y: 1 }] },                                 // not owned
    { items: [{ id: 'pet-cat', x: 1, y: 1 }] },                                   // a pet is not furniture
    { items: [{ id: 'deco-rug', x: HOUSE_GRID.cols, y: 0 }] },                    // off the floor
    { items: [{ id: 'deco-rug', x: 0, y: -1 }] },
    { items: [{ id: 'deco-rug', x: 1.5, y: 0 }] },                                // between squares
    { items: [{ id: 'deco-rug', x: 2, y: 2 }, { id: 'deco-fern', x: 2, y: 2 }] }, // stacked
    { items: [{ id: 'deco-rug', x: 1, y: 1 }, { id: 'deco-rug', x: 2, y: 2 }] },  // cloned
    { items: 'everything' },
    {}
  ]) {
    assert.throws(() => validateLayout(broken, options), /invalid_layout/);
  }
});

test('a sold or unknown piece quietly leaves the room instead of breaking it', () => {
  const stored = JSON.stringify({ items: [{ id: 'deco-rug', x: 3, y: 3 }, { id: 'deco-lamp', x: 4, y: 4 }] });
  assert.deepEqual(readLayout(stored, options), { items: [{ id: 'deco-rug', x: 3, y: 3 }] });
  assert.deepEqual(readLayout('not json', options), { items: [] });
  assert.deepEqual(readLayout(null, options), { items: [] });
});

test('the house store will not read or write without a member key', async () => {
  const store = new HouseStore({ url: 'https://example.invalid', token: 'x', fetchImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(() => store.load('nope', options), /invalid_member_key/);
  await assert.rejects(() => store.save('nope', { items: [] }), /invalid_member_key/);
});

test('every house refusal the server can send has words for the member', () => {
  const client = readFileSync(new URL('../house.mjs', import.meta.url), 'utf8');
  const messages = client.slice(client.indexOf('const MESSAGES'), client.indexOf('};', client.indexOf('const MESSAGES')));
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const route = routeSource(server, '/api/house');
  const codes = [...route.matchAll(/error: "(\w+)"/g)].map(match => match[1]);
  assert.ok(codes.length >= 4);
  for (const code of codes) {
    if (code === 'method_not_allowed') continue;
    assert.ok(messages.includes(`${code}:`), `no message for ${code}`);
  }
});

test('all new homes get the same free furniture, while an intentionally empty saved room stays empty', async () => {
  const {homeOwned,starterLayout}=await import('../house/store.mjs');
  const full={ownedIds:homeOwned([],catalog),catalog};
  assert.equal(full.ownedIds.length,3);
  assert.equal(validateLayout(starterLayout(catalog),full).items.length,3);
  const make=raw=>new HouseStore({url:'https://example.invalid',token:'x',fetchImpl:async()=>({ok:true,json:async()=>({result:raw})})});
  assert.deepEqual(await make(null).load('a'.repeat(64),full),starterLayout(catalog));
  assert.deepEqual(await make('{"items":[]}').load('a'.repeat(64),full),{items:[]});
});

test('furniture footprint rejects overlap and clipping at room edges',()=>{
  const opts={ownedIds:['deco-christmas-tree','deco-pumpkin'],catalog};
  assert.throws(()=>validateLayout({items:[{id:'deco-christmas-tree',x:13,y:8}]},opts));
  assert.throws(()=>validateLayout({items:[{id:'deco-christmas-tree',x:2,y:2},{id:'deco-pumpkin',x:3,y:3}]},opts));
  assert.equal(validateLayout({items:[{id:'deco-christmas-tree',x:2,y:2},{id:'deco-pumpkin',x:4,y:3}]},opts).items.length,2);
});
