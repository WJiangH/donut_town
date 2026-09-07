#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {validateTheme} from '../town-themes/contract.mjs';

export function collisionFor(theme) {
  const window={location:{search:''}};
  vm.runInNewContext(readFileSync(new URL('../town-collision.js',import.meta.url),'utf8'),{window,atob,URLSearchParams});
  return window.createTownCollision(theme.walkMask);
}
export function auditTheme(theme) {
  validateTheme(theme);
  const art=readFileSync('.'+theme.image);
  assert.equal(createHash('sha256').update(art).digest('hex'),theme.imageSha256,'Art changed; remeasure geometry and update provenance');
  assert.equal(art.readUInt32BE(16),theme.imageSize.width);
  assert.equal(art.readUInt32BE(20),theme.imageSize.height);
  const c=collisionFor(theme);
  const points=[theme.spawn,...Object.values(theme.entrances).map(p=>p.landing),...theme.zones.map(z=>z.anchor),...theme.stations.flatMap(s=>[s,s.left,s.right])];
  for (const p of points) {
    assert(c.isWalkable(p.x,p.y),`Blocked gameplay anchor ${p.x},${p.y}`);
    assert(c.findPath(theme.spawn,p).length,`Unreachable gameplay anchor ${p.x},${p.y}`);
  }
  const spread=c.spreadPoints(160,4.2);
  assert.equal(spread.length,160,'Must fit the existing resident capacity');
  for (const p of spread) assert(c.findPath(theme.spawn,p).length,'Disconnected resident spawn');
  const actions=new Set(theme.zones.flatMap(z=>[z.action].flat()));
  for (const action of ['sitChair','sitGrass','coffee','read','garden','lookout']) assert(actions.has(action),'Missing '+action);
  return {id:theme.id,zones:theme.zones.length,spawnSlots:spread.length,artBytes:art.length};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const catalog=JSON.parse(readFileSync('content/themes/catalog.json'));
  assert.equal(new Set(catalog.map(t=>t.id)).size,catalog.length);
  for (const entry of catalog) {
    assert(statSync('.'+entry.thumbnail).size<150000,'Use a small theme thumbnail');
    const theme=JSON.parse(readFileSync('.'+entry.manifest));
    assert.equal(theme.id,entry.id);
    console.log(JSON.stringify(auditTheme(theme)));
  }
}
