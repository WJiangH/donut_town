import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {accessoryGeometry} from '../characters/head-accessories.mjs';
const sample=JSON.parse(readFileSync(new URL('../prototypes/hat-fit-sample.json',import.meta.url)));
test('sampled hat anchors match their exact source images and cover all declared frames',()=>{
 assert.equal(new Set(sample.items.map(item=>item.id)).size,6);
 for(const item of sample.items){
  const ch=JSON.parse(readFileSync(new URL(`../characters/${item.id}.json`,import.meta.url)));
  for(const [url,sha] of Object.entries(item.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(new URL('..'+url,import.meta.url))).digest('hex'),sha,item.id);
  for(const [key,source] of [['walk',ch],...Object.entries(ch.actions)]){
   assert.equal(item.heads[key].length,source.frames.length,item.id);
   source.frames.forEach((f,i)=>{const g=accessoryGeometry(ch,i,key==='walk'?null:key,item.heads);assert(g);assert(g.x>=0&&g.x<=f[2]);assert(g.y>=0&&g.y<=f[3]);assert(g.headWidth>0&&g.headWidth<=f[2])});
  }
  assert.equal(accessoryGeometry(ch,0),null,'sample does not silently enable an unapproved production rig');
 }
});
