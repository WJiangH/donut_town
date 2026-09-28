import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCatalog, checkPurchase } from '../shop/store.mjs';

const root = new URL('../', import.meta.url);
const petIndex = JSON.parse(readFileSync(new URL('pets/index.json', root)));

function pngSize(path) {
  const png = readFileSync(fileURLToPath(new URL(path.slice(1), root)));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test('named photo pets are purchasable for 20 donuts and have complete game art', () => {
  const catalog = loadCatalog();
  for (const [id, name] of [
    ['pet-princess-leia', 'Princess Leia'],
    ['pet-dasher', 'Dasher'],
    ['pet-chewy', 'Chewy']
  ]) {
    const item = catalog.items.find(entry => entry.id === id);
    const index = petIndex.items.find(entry => entry.id === id);
    assert.deepEqual([item?.name, item?.price, item?.kind, item?.category], [name, 20, 'pet', 'pets']);
    assert.equal(index?.name, name);
    const manifest = JSON.parse(readFileSync(new URL(index.manifest.slice(1), root)));
    assert.deepEqual([manifest.id, manifest.name, manifest.price], [id, name, 20]);
    assert.equal(manifest.walk.frames.length, 9);
    assert.equal(manifest.sit.frames.length, 3);
    for (const [asset, expectedWidth, expectedHeight] of [
      [index.walk, manifest.walk.imageWidth, manifest.walk.imageHeight],
      [index.sit, manifest.sit.imageWidth, manifest.sit.imageHeight],
      [index.portrait, manifest.portrait.imageWidth, manifest.portrait.imageHeight]
    ]) assert.deepEqual(pngSize(asset), [expectedWidth, expectedHeight]);
    assert.equal(checkPurchase({ item, purse: { owned: [] }, earned: 19 }).error, 'not_enough_donuts');
    assert.equal(checkPurchase({ item, purse: { owned: [] }, earned: 20 }).ok, true);
  }
});
