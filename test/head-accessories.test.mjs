import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEADS,accessoryGeometry,cleanBanner,drawAccessory} from '../characters/head-accessories.mjs';
const ch=JSON.parse(readFileSync(new URL('../characters/r-7f3a2c.json',import.meta.url)));
test('head anchors cover every walking and action frame, including low grass poses',()=>{
 for(const [id,source] of [['walk',ch],...Object.entries(ch.actions)]){
  assert.equal(HEADS[id].length,source.frames.length,id);
  source.frames.forEach((frame,i)=>{const g=accessoryGeometry(ch,i,id==='walk'?null:id);assert(g);assert(g.x>=0&&g.x<=frame[2],id);assert(g.y>=0&&g.y<=frame[3],id)});
 }
 assert.equal(accessoryGeometry({...ch,url:'/different-rig.png'},0),null);
 assert.equal(accessoryGeometry(ch,999),null);
 assert.equal(accessoryGeometry(ch,0,'unknown'),null);
});
test('banner is bounded plain text and drops control and directional override characters',()=>{
 assert.equal(cleanBanner('HI\nTEAM\u202e'),'HITEAM');
 assert.equal(Array.from(cleanBanner('🍩'.repeat(20))).length,12);
 assert.equal(cleanBanner('<img onerror=x>'),'<img onerror');
});
test('left-facing banner counter-mirrors only its text',()=>{
 const calls=[];const c={imageSmoothingEnabled:true,fillRect(){},save(){calls.push('save')},restore(){calls.push('restore')},translate(){calls.push('translate')},scale(){calls.push('scale')},fillText(t){calls.push(t)}};
 drawAccessory({getContext:()=>c},{hat:true,banner:'HI TEAM'},'left');
 assert.deepEqual(calls,['save','translate','scale','HI TEAM','restore']);
});
test('felt hat selects the front, side, mirrored side and back sprite correctly',()=>{
 const spec=JSON.parse(readFileSync(new URL('../assets/accessories/felt-hat-v1.json',import.meta.url)));
 for(const [facing,key] of [['down','front'],['right','side'],['left','side'],['up','back']]){
  let drawn;const canvas={getContext:()=>({drawImage(...args){drawn=args},fillRect(){}})};
  drawAccessory(canvas,{hat:true},facing,{...spec,image:'loaded-image'});
  assert.deepEqual(drawn.slice(1,5),spec.frames[key]);
  assert(Math.abs(drawn[7]/drawn[8]-spec.frames[key][2]/spec.frames[key][3])<1e-12);
 }
 const data=readFileSync(new URL('..'+spec.url,import.meta.url));
 assert.equal(data.length,spec.bytes);assert(data.length<=65536);
 assert.equal(data.readUInt32BE(16),spec.width);assert.equal(data.readUInt32BE(20),spec.height);assert.equal(data[25],6);
});
