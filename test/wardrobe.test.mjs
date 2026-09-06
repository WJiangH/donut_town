import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outfitFor, layerUrls} from '../characters/wardrobe/renderer.mjs';

import { readdirSync } from 'node:fs';

const wardrobeDir = new URL('../characters/wardrobe/', import.meta.url);
const manifests = readdirSync(wardrobeDir).filter(name => /^r-[a-z0-9-]+\.json$/.test(name)).map(name => {
  const id = name.slice(0, -5);
  return { id, manifest: JSON.parse(readFileSync(new URL(name, wardrobeDir))) };
});

test('invalid or stale selections cannot remove required clothing or inject asset URLs', () => {
  const {manifest} = manifests.find(entry => entry.id === 'r-7f3a2c');
  assert.deepEqual(outfitFor(manifest, {jacket:'none', shoes:'/unexpected.png', eyewear:'smoke', extra:'value'}),
    {jacket:'original', shoes:'original', eyewear:'smoke'});
  assert.equal(layerUrls(manifest, {eyewear:'none'}).length, 3);
  assert.equal(layerUrls(manifest, {eyewear:'smoke'}).at(-1), manifest.slots.eyewear.items.smoke);
});

test('every selectable layer uses the same atlas geometry as its character rig', () => {
  assert.ok(manifests.length >= 2);
  for (const {id, manifest} of manifests) {
    for (const slot of Object.values(manifest.slots)) {
      assert.ok(Object.hasOwn(slot.items, slot.default));
      if (slot.required) assert.ok(slot.items[slot.default]);
    }
    const urls = [manifest.base, ...Object.values(manifest.slots).flatMap(slot => Object.values(slot.items)).filter(Boolean)];
    for (const url of urls) {
      assert.match(url, new RegExp(`^/assets/residents/${id}/wardrobe-v1/[a-z-]+\\.png$`));
      const bytes = readFileSync(new URL('..'+url, import.meta.url));
      assert.equal(bytes.readUInt32BE(16), manifest.imageWidth);
      assert.equal(bytes.readUInt32BE(20), manifest.imageHeight);
      assert.equal(bytes[25], 6);
    }
  }
});
