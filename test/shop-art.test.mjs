import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadCatalog} from '../shop/store.mjs';
import {itemArt,itemSprite} from '../shop/item-art.mjs';
const catalog=loadCatalog();

test('all decoration and preview stock uses a real transparent PNG',()=>{
 const stock=catalog.items.filter(item=>item.kind!=='pet');
 assert(stock.length>=16);
 for(const item of stock){
  assert.match(item.art,/^\/assets\/shop\/.+\.png$/);
  const file=new URL('..'+item.art,import.meta.url);
  const data=readFileSync(file);
  assert.equal(data.readUInt32BE(16),item.artFrame.canvasW,item.id);
  assert.equal(data.readUInt32BE(20),item.artFrame.canvasH,item.id);
  const output=execFileSync(process.execPath,['.agents/skills/donut-town-pixel-art/scripts/validate-png-atlas.mjs',file.pathname,'1','1'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.match(output,/corner_alpha=0,0,0,0/,item.id);
  assert(!item.placeholder,item.id);
  assert(Math.max(item.artFrame.canvasW,item.artFrame.canvasH)<=260,item.id);
  assert(data.length<=131072,item.id);
  const thumb=readFileSync(new URL('..'+item.thumb,import.meta.url));
  assert(Math.max(thumb.readUInt32BE(16),thumb.readUInt32BE(20))<=100,item.id);
  assert(thumb.length<=32768,item.id);
 }
});

test('rendered furniture uses its measured silhouette and keeps preview stock unavailable',()=>{
 const chair=catalog.items.find(x=>x.id==='starter-chair');
 assert.match(itemSprite(chair),new RegExp(`viewBox="${chair.artFrame.x} ${chair.artFrame.y} ${chair.artFrame.w} ${chair.artFrame.h}"`));
 for(const item of catalog.items.filter(x=>x.kind==='wardrobe'))assert.equal(item.available,false);
 const sample={art:'/assets/object.png',thumb:'/assets/thumb.png'};
 assert.equal(itemArt(sample),sample.art);assert.equal(itemArt(sample,true),sample.thumb);
});
