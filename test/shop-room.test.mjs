import test from 'node:test';
import assert from 'node:assert/strict';
import {mountShopRoom} from '../shop-room.mjs';
// Minimal DOM probe: count destructive shelf writes, independent of frame/image timing.
function rootProbe(){
 const nodes=new Map();
 function node(selector){if(!nodes.has(selector)){let html='';const el={writes:0,textContent:'',hidden:false,style:{},querySelectorAll:()=>[],querySelector:selector=>node(selector)};Object.defineProperty(el,'innerHTML',{get:()=>html,set:value=>{html=value;el.writes++;}});nodes.set(selector,el);}return nodes.get(selector);}
 return {querySelector:node,contains:()=>false,shelf:node('[data-shop="shelves"]')};
}
test('shop coalesces concurrent loads, keeps unchanged shelves and updates changed balance',async()=>{
 const oldFetch=globalThis.fetch,oldDocument=globalThis.document;let requests=0,release,balance=106;
 globalThis.document={activeElement:null};
 globalThis.fetch=async()=>{requests++;await new Promise(resolve=>{release=resolve;});return {ok:true,json:async()=>({items:[{id:'pet-cat',name:'Cat',kind:'pet',price:6}],owned:[],pet:null,wallet:{balance}})};};
 try{
  const root=rootProbe(),shop=mountShopRoom(root);const first=shop.load(),duplicate=shop.load();assert.equal(requests,1);release();await Promise.all([first,duplicate]);assert.equal(root.shelf.writes,1);
  const refresh=shop.load();release();await refresh;assert.equal(root.shelf.writes,1,'unchanged data preserves image nodes');
  balance=100;const changed=shop.load();release();await changed;assert.equal(root.querySelector('[data-shop="wallet"]').textContent,'100 🍩');
 }finally{globalThis.fetch=oldFetch;globalThis.document=oldDocument;}
});
