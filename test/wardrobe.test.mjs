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

test('every wardrobe refusal the server can send has words for the member', () => {
  const client = readFileSync(new URL('../profile-wardrobe.mjs', import.meta.url), 'utf8');
  const messages = client.slice(client.indexOf('const SAVE_MESSAGES'), client.indexOf('};', client.indexOf('const SAVE_MESSAGES')));
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const wardrobeRoute = server.slice(server.indexOf('/api/wardrobe'), server.indexOf('/api/shop'));
  const codes = [...wardrobeRoute.matchAll(/error: "(\w+)"/g)].map(match => match[1]);
  assert.ok(codes.length >= 4);
  for (const code of codes) {
    if (code === 'method_not_allowed') continue;
    assert.ok(messages.includes(`${code}:`), `no message for ${code}`);
  }
});

test('a look is only worn once it is saved', () => {
  const client = readFileSync(new URL('../profile-wardrobe.mjs', import.meta.url), 'utf8');
  // Picking an item must not post anything by itself.
  const pick = client.slice(client.indexOf("group.querySelectorAll('[data-item]')"), client.indexOf("root.querySelectorAll('[data-dir]')"));
  assert.ok(!pick.includes('save()'), 'choosing an item should not save on its own');
  assert.ok(client.includes("root.querySelector('[data-action=\"save\"]')"), 'there should be a save button');
  const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(markup, /data-action="save"/);
  assert.match(markup, /data-action="revert"/);
});

test('the donut icon is pixel art with transparency, not a css circle', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.mini-donut[^}]*image-rendering: pixelated/s);
  for (const [file, size] of [['donut-16.png', 16], ['donut-32.png', 32]]) {
    const bytes = readFileSync(new URL(`../assets/ui/${file}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
    assert.equal(bytes[25], 6, 'the icon needs an alpha channel');
  }
});
