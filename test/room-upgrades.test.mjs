import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCatalog} from '../shop/store.mjs';
import {validateLayout,readLayout} from '../house/store.mjs';
import {homeNavigation} from '../house/navigation.mjs';
import {canManageTheme} from '../town-themes/contract.mjs';
const catalog=loadCatalog(),ownedIds=['deco-fern','deco-rug','room-modern-loft'],options={catalog,ownedIds};
test('quarter-cell placement persists, detects partial overlap and preserves legacy rooms',()=>{
 const layout={items:[{id:'deco-fern',x:3.25,y:.25}],roomId:'room-modern-loft'};
 assert.deepEqual(readLayout(JSON.stringify(validateLayout(layout,options)),options),layout);
 assert.throws(()=>validateLayout({items:[...layout.items,{id:'deco-rug',x:3,y:0}]},options));
 assert.deepEqual(validateLayout({items:[]},options),{items:[]});
 for(const roomId of ['room-moonlight-suite','pet-cat','no-room'])assert.throws(()=>validateLayout({...layout,roomId},options));
 assert.deepEqual(readLayout(JSON.stringify({...layout,roomId:'room-moonlight-suite'}),options),{...layout,roomId:'room-cottage'});
});
test('quarter-cell furniture routes have clear complete segments',()=>{
 const furniture=new Map([['sofa',{footprint:{w:3,h:2}}]]),nav=homeNavigation({cols:14,rows:9},[{id:'sofa',x:5.25,y:3.25}],furniture);
 const path=nav.path({x:3.51,y:4.01},{x:10.2,y:4.02});assert(path.length);
 for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.05)assert(!nav.blocked(path[i-1].x+(path[i].x-path[i-1].x)*t,path[i-1].y+(path[i].y-path[i-1].y)*t));
});
test('upgraded rooms have compact thumbnails and full matching canvases',()=>{
 const rooms=catalog.items.filter(i=>i.kind==='room');assert.equal(rooms.length,2);
 for(const item of rooms){
  const full=readFileSync('.'+item.art),thumb=readFileSync('.'+item.thumb);
  assert.equal(full.readUInt32BE(16),1536);assert.equal(full.readUInt32BE(20),1024);
  assert(thumb.length<65536);assert(thumb.readUInt32BE(16)<=192);assert(full.length<5*1024*1024);
 }
});
test('designated hash grants theme access only to a signed-in channel member, environment still overrides',()=>{
 const key='a'.repeat(64),other='b'.repeat(64),member={isWorkspaceAdmin:false};
 assert(canManageTheme(member,key,'',[key]));assert(!canManageTheme(null,key,'',[key]));
 assert(!canManageTheme(member,other,'',[key]));assert(!canManageTheme(member,key,other,[key]));
 assert(canManageTheme(member,key,key,[]));
 const admins=JSON.parse(readFileSync('town-themes/admins.json'));assert(admins.every(k=>/^[a-f0-9]{64}$/.test(k)));
});
test('fractional coordinates still reject coercible non-numbers',()=>{
 for(const x of ['1',null,true,NaN,Infinity])assert.throws(()=>validateLayout({items:[{id:'deco-fern',x,y:0}]},options));
});
