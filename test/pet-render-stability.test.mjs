import test from 'node:test';import assert from 'node:assert/strict';
import {loadPetSprites,updatePets,forgetPets}from'../pets.mjs';
test('same pet keeps one DOM node and two decoded atlases through repeated frames',async()=>{
 const oldDoc=globalThis.document,oldImage=globalThis.Image;let created=0,removed=0,decoded=0,requests=0;
 const frame=[0,0,12,12],sheet={frames:Array(9).fill(frame),frameHeight:12,imageWidth:36,imageHeight:36};
 const fetchImpl=async url=>{
  requests++;
  return {json:async()=>url==='/pets/index.json'
    ? {items:[{id:'cat',manifest:'/cat.json',walk:'/walk.png',sit:'/sit.png'}]}
    : {walk:sheet,sit:{...sheet,frames:Array(3).fill(frame)}}};
 };
 const layer={appendChild(pin){pin.parentElement=this;}};
 globalThis.document={createElement(){created++;return{dataset:{},style:{},firstElementChild:{dataset:{},style:{},classList:{toggle(){}}},setAttribute(){},remove(){removed++;this.parentElement=null;}};}};
 globalThis.Image=class{async decode(){decoded++;}};
 try{
  const a=loadPetSprites(fetchImpl),b=loadPetSprites(fetchImpl);assert.equal(a,b);await a;
  const owners=[{id:'owner',pet:'cat',scene:'town',x:50,y:50,moving:false}];
  const options={deltaSeconds:1/120,layerFor:()=>layer,isWalkable:()=>true,geometryFor:()=>({key:'theme-a'})};
  updatePets(owners,options);await new Promise(resolve=>setImmediate(resolve));
  for(let i=0;i<1200;i++)updatePets(owners,options);
  assert.equal(created,1);assert.equal(removed,0);assert.equal(decoded,2);assert.equal(requests,2);
 }finally{forgetPets();globalThis.document=oldDoc;globalThis.Image=oldImage;}
});
