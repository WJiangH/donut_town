import test from 'node:test';
import assert from 'node:assert/strict';
import {roomFrame} from '../interior-camera.mjs';
test('filled room covers wide and portrait viewports without distorting its art',()=>{
 for(const [w,h] of [[2048,1008],[1280,648],[390,844]])for(const x of [0,.5,1])for(const y of [0,.62,1]){
  const f=roomFrame(w,h,{x,y});assert.equal(f.width/f.height,1.5);
  assert(f.width>=w&&f.height>=h);assert(f.x<=0&&f.y<=0);assert(f.x+f.width>=w&&f.y+f.height>=h);
 }
});
test('overview keeps all walls and the door reachable on every screen',()=>{
 for(const [w,h] of [[2048,1008],[1280,648],[390,844]]){
  const f=roomFrame(w,h,{overview:true});assert(f.x>=0&&f.y>=0);assert(f.x+f.width<=w&&f.y+f.height<=h);assert.equal(f.width/f.height,1.5);
 }
});
