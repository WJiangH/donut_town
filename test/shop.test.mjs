import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog, walletFor, ownedIds, checkPurchase, equippedPet, ShopStore } from '../shop/store.mjs';

const catalog = loadCatalog();

// The handler for one route, from its first line to wherever the next route begins.
function routeSource(server, path) {
  const start = server.indexOf(`url.pathname === "${path}"`);
  const next = server.indexOf('url.pathname === "/api/', server.indexOf('\n', start));
  return server.slice(start, next > start ? next : undefined);
}


test('the shelves are a valid catalogue', () => {
  assert.ok(catalog.items.length >= 6);
  assert.ok(catalog.items.some(item => item.kind === 'pet'));
  assert.ok(catalog.items.some(item => item.kind === 'decoration'));
  for (const item of catalog.items) {
    assert.match(item.id, /^[a-z0-9-]{3,40}$/);
    assert.ok(Number.isInteger(item.price) && item.price >= 0);
    assert.ok(item.name && item.blurb);
  }
});

test('a broken catalogue is refused rather than half loaded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shop-'));
  const write = body => {
    const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(body));
    return new URL(`file://${file}`);
  };
  const good = { id: 'deco-x', kind: 'decoration', name: 'X', price: 1 };
  for (const broken of [
    { items: [{ ...good, id: 'NOPE' }] },
    { items: [{ ...good, kind: 'spaceship' }] },
    { items: [{ ...good, price: -1 }] },
    { items: [{ ...good, price: 1.5 }] },
    { items: [{ ...good, name: '' }] },
    { items: [good, good] }
  ]) {
    assert.throws(() => loadCatalog(write(broken)));
  }
});

test('a wallet is what you earned less what you spent', () => {
  const purse = { owned: [{ id: 'deco-rug', price: 2 }, { id: 'pet-frog', price: 4 }] };
  assert.deepEqual(walletFor({ earned: 10, purse }), { earned: 10, spent: 6, balance: 4 });
  assert.deepEqual(ownedIds(purse), ['deco-rug', 'pet-frog']);
  assert.deepEqual(walletFor({ earned: 3, purse: null }), { earned: 3, spent: 0, balance: 3 });
});

test('you cannot buy twice, buy air, or spend donuts you do not have', () => {
  const cat = catalog.items.find(item => item.id === 'pet-cat');
  assert.equal(checkPurchase({ item: undefined, purse: { owned: [] }, earned: 99 }).error, 'item_not_found');
  assert.equal(checkPurchase({ item: cat, purse: { owned: [{ id: 'pet-cat', price: 6 }] }, earned: 99 }).error, 'already_owned');
  assert.equal(checkPurchase({ item: cat, purse: { owned: [] }, earned: cat.price - 1 }).error, 'not_enough_donuts');
  const verdict = checkPurchase({ item: cat, purse: { owned: [] }, earned: cat.price });
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.wallet, { earned: cat.price, spent: cat.price, balance: 0 });
});

test('a purse keeps the price that was paid and drops anything unknown', () => {
  const purse = ShopStore.validPurse({
    owned: [
      { id: 'deco-rug', price: 9 },
      { id: 'deco-rug', price: 2 },
      { id: 'not-a-thing', price: 1 },
      { id: 'pet-duck' }
    ]
  }, catalog);
  assert.deepEqual(purse.owned.map(entry => [entry.id, entry.price]), [['deco-rug', 9], ['pet-duck', 5]]);
});

test('the shop refuses to touch the store without a member key', async () => {
  const store = new ShopStore({ url: 'https://example.invalid', token: 'x', fetchImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(() => store.purse('nope', catalog), /invalid_member_key/);
  await assert.rejects(() => store.buy('nope', catalog.items[0], { owned: [] }), /invalid_member_key/);
});

test('every shop refusal the server can send has words for the member', () => {
  const client = readFileSync(new URL('../shop-panel.mjs', import.meta.url), 'utf8');
  const messages = client.slice(client.indexOf('SHOP_MESSAGES = {'), client.indexOf('};', client.indexOf('SHOP_MESSAGES = {')));
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const route = routeSource(server, '/api/shop') + routeSource(server, '/api/shop/purchase');
  const codes = new Set([...route.matchAll(/error: "(\w+)"/g)].map(match => match[1]));
  codes.add('not_enough_donuts');
  codes.add('already_owned');
  codes.add('item_not_found');
  assert.ok(codes.size >= 5);
  for (const code of codes) {
    if (code === 'method_not_allowed') continue;
    assert.ok(messages.includes(`${code}:`), `no message for ${code}`);
  }
});

test('only a pet you have bought can be out with you', () => {
  const purse = { owned: [{ id: 'pet-duck', price: 5 }, { id: 'deco-rug', price: 2 }] };
  assert.equal(equippedPet({ ...purse, pet: 'pet-duck' }, catalog), 'pet-duck');
  assert.equal(equippedPet({ ...purse, pet: 'pet-cat' }, catalog), null, 'not owned');
  assert.equal(equippedPet({ ...purse, pet: 'deco-rug' }, catalog), null, 'a rug is not a pet');
  assert.equal(equippedPet({ ...purse, pet: null }, catalog), null);
  assert.equal(equippedPet(null, catalog), null);
});

test('a purse remembers which pet is out, and forgets a forged one', () => {
  assert.equal(ShopStore.validPurse({ owned: [{ id: 'pet-frog', price: 4 }], pet: 'pet-frog' }, catalog).pet, 'pet-frog');
  assert.equal(ShopStore.validPurse({ owned: [], pet: 42 }, catalog).pet, null);
  // A pet nobody owns is stored but never equipped.
  const purse = ShopStore.validPurse({ owned: [], pet: 'pet-cat' }, catalog);
  assert.equal(equippedPet(purse, catalog), null);
});
