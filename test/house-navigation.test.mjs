import test from 'node:test';
import assert from 'node:assert/strict';
import {homeNavigation} from '../house/navigation.mjs';
import {loadCatalog,walletFor,checkPurchase} from '../shop/store.mjs';
import {grantedDonuts,validateGrants} from '../shop/grants.mjs';
import {readFileSync} from 'node:fs';
const furniture=new Map([['sofa',{footprint:{w:3,h:2}}],['starter-rug',{footprint:{w:2,h:2}}]]);
test('home route goes around furniture, walks over rugs and stays inside floor',()=>{
 const nav=homeNavigation({cols:14,rows:9},[{id:'sofa',x:5,y:3},{id:'starter-rug',x:2,y:2}],furniture);
 assert(nav.blocked(5.5,3.5));assert(!nav.blocked(2.5,2.5));assert(nav.blocked(-.1,4));assert(nav.blocked(14,4));
 const path=nav.path({x:3.5,y:3.5},{x:10.5,y:3.5});assert(path.length>8);
 assert(path.every(p=>!nav.blocked(p.x,p.y)));assert.deepEqual(path.at(-1),{x:10.5,y:3.5});
 for(let i=1;i<path.length;i++)assert(Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y)<=.26);
 assert.deepEqual(nav.path({x:3.5,y:3.5},{x:6.5,y:3.5}),[]);
 assert(!nav.blocked(...Object.values(nav.nearest({x:6.5,y:3.5}))));
});
test('home cannot route through a sealed wall and handles a completely furnished floor',()=>{
 const wall=new Map([['wall',{footprint:{w:1,h:9}}]]);
 const nav=homeNavigation({cols:14,rows:9},[{id:'wall',x:7,y:0}],wall);
 assert.deepEqual(nav.path({x:6.5,y:4.5},{x:8.5,y:4.5}),[]);
 assert.equal(homeNavigation({cols:1,rows:1},[{id:'sofa',x:0,y:0}],furniture).nearest({x:0,y:0}),null);
});
test('fixed test credit applies to its exact HMAC only and does not replenish spent donuts',()=>{
 const grants=JSON.parse(readFileSync('shop/grants.json'));
 for(const [key,amount] of Object.entries(grants))assert.equal(grantedDonuts(key),amount);assert.equal(grantedDonuts('unknown'),0);
 const key=Object.keys(grants)[0]||'unknown';
 const item=loadCatalog().items.find(i=>i.id==='pet-cat');const earned=6+grantedDonuts(key);
 assert(checkPurchase({item,purse:{owned:[]},earned}).ok);
 const purse={owned:[{id:item.id,price:item.price}]};
 assert.deepEqual(walletFor({earned,purse}),walletFor({earned:6+grantedDonuts(key),purse}));
 assert.equal(walletFor({earned,purse}).balance,earned-item.price);
 assert.equal(checkPurchase({item,purse,earned}).error,'already_owned');
 for(const value of [[],null,{'raw-member-id':100},{['a'.repeat(64)]:-1},{['a'.repeat(64)]:1.1}])assert.throws(()=>validateGrants(value));
});
