import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outfitFor, layerUrls} from '../characters/wardrobe/renderer.mjs';

const manifest = JSON.parse(readFileSync(new URL('../characters/wardrobe/r-7f3a2c.json', import.meta.url)));
test('invalid or stale selections cannot remove required clothing or inject asset URLs', () => {
  assert.deepEqual(outfitFor(manifest, {jacket:'none', shoes:'/unexpected.png', eyewear:'smoke', extra:'value'}),
    {jacket:'original', shoes:'original', eyewear:'smoke'});
  assert.equal(layerUrls(manifest, {eyewear:'none'}).length, 3);
  assert.equal(layerUrls(manifest, {eyewear:'smoke'}).at(-1), manifest.slots.eyewear.items.smoke);
});

test('every selectable layer uses the same atlas geometry as its character rig', () => {
  for (const slot of Object.values(manifest.slots)) {
    assert.ok(Object.hasOwn(slot.items, slot.default));
    if (slot.required) assert.ok(slot.items[slot.default]);
  }
  const urls = [manifest.base, ...Object.values(manifest.slots).flatMap(slot => Object.values(slot.items)).filter(Boolean)];
  for (const url of urls) {
    assert.match(url, /^\/assets\/residents\/r-7f3a2c\/wardrobe-v1\/[a-z-]+\.png$/);
    const bytes = readFileSync(new URL('..'+url, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), manifest.imageWidth);
    assert.equal(bytes.readUInt32BE(20), manifest.imageHeight);
    assert.equal(bytes[25], 6);
  }
});
