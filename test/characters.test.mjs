import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { characterForMember, memberCharacterKey, createCharacterResolver } from '../characters/catalog.mjs';

test('member bindings require the right ID and server secret, with domain separation', () => {
  const member = 'example-member-a';
  const secret = 'test-only-server-key';
  const descriptor = { url: '/assets/residents/example/walk-v1.png' };
  const digest = createHmac('sha256', secret).update('donut-town:character:v1\0' + member).digest('hex');
  assert.equal(memberCharacterKey(member, secret), digest);
  assert.notEqual(memberCharacterKey(member, secret), createHmac('sha256', secret).update(member).digest('hex'));
  const resolve = createCharacterResolver(new Map([[digest, 'example']]), new Map([['example', descriptor]]));
  assert.equal(resolve(member, secret), descriptor);
  assert.equal(resolve('example-member-b', secret), null);
  assert.equal(resolve(member, 'wrong-key'), null);
  assert.equal(resolve(member, ''), null);
  assert.equal(resolve(undefined, secret), null);
  assert.equal(characterForMember(member, secret), null);
});

test('public bindings contain only digests and existing transparent character assets', () => {
  const bindings = JSON.parse(readFileSync(new URL('../characters/assignments.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(bindings).length);
  for (const [key, id] of Object.entries(bindings)) {
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.match(id, /^r-[a-z0-9-]+$/);
    const art = JSON.parse(readFileSync(new URL(`../characters/${id}.json`, import.meta.url), 'utf8'));
    const bytes = readFileSync(new URL(`..${art.url}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), art.imageWidth);
    assert.equal(bytes.readUInt32BE(20), art.imageHeight);
    assert.equal(bytes[25], 6);
    assert.equal(art.frames.length, 9);
    assert.ok(art.frames.every(([x,y,w,h]) => x>=0 && y>=0 && w>0 && h>0 && x+w<=art.imageWidth && y+h<=art.imageHeight));
    assert.equal(art.sourceDesignSha256, undefined);
  }
});
