import test from 'node:test';
import assert from 'node:assert/strict';
import { houseLuxury, decorationLuxury, LUXURY_TIERS } from '../house/luxury.mjs';
import { loadCatalog } from '../shop/store.mjs';
import { homeOwned, starterLayout, validateLayout } from '../house/store.mjs';

const catalog=loadCatalog();
const options={catalog,ownedIds:homeOwned(catalog.items.map(item=>item.id),catalog)};
const score=items=>houseLuxury({items},options);

test('empty and starter homes begin at zero even with a full inventory',()=>{
  for(const layout of [{items:[]},starterLayout(catalog)]) {
    const result=houseLuxury(layout,options);
    assert.equal(result.score,0);assert.equal(result.tier.name,'Simple');
    assert.equal(result.progress,0);assert.equal(result.remaining,20);
  }
});

test('only owned, placed decorations count once, independent of price or client scores',()=>{
  const placed=[{id:'deco-sofa',x:0,y:0,luxury:999999},{id:'deco-sofa',x:4,y:0},{id:'pet-cat'},{id:'wear-hat'},{id:'unknown'}];
  assert.equal(score(placed).score,40);
  assert.equal(houseLuxury({items:placed},{catalog,ownedIds:[]}).score,0);
  const discounted={items:catalog.items.map(item=>({...item,price:0}))};
  assert.equal(houseLuxury({items:placed},{...options,catalog:discounted}).score,40);
});

test('moving and reloading preserve score; putting furniture away lowers score and tier',()=>{
  const layout=validateLayout({items:[{id:'deco-sofa',x:1,y:1},{id:'deco-paper-lamp',x:5,y:1}]},options);
  assert.equal(houseLuxury(layout,options).score,60);
  assert.equal(houseLuxury(layout,options).tier.name,'Charming');
  layout.items[0].x=2;
  assert.equal(houseLuxury(JSON.parse(JSON.stringify(layout)),options).score,60);
  const result=score(layout.items.slice(0,1));
  assert.equal(result.score,40);assert.equal(result.tier.name,'Cozy');
});

test('tier boundaries and progress are exact, with no next tier above Grand',()=>{
  for(const [index,tier] of LUXURY_TIERS.entries()) {
    for(const amount of [tier.min,Math.max(0,tier.min-1)]) {
      const result=houseLuxury({items:[{id:'test'}]},{ownedIds:['test'],catalog:{items:[{id:'test',kind:'decoration',luxury:amount}]}});
      assert.equal(result.tier.name,LUXURY_TIERS[amount<tier.min?index-1:index].name);
      assert(result.progress>=0&&result.progress<=100);
    }
  }
  const result=houseLuxury({items:[{id:'test'}]},{ownedIds:['test'],catalog:{items:[{id:'test',kind:'decoration',luxury:9999}]}});
  assert.equal(result.tier.name,'Grand');assert.equal(result.nextTier,null);assert.equal(result.remaining,0);assert.equal(result.progress,100);
});

test('the catalog assigns points to all purchasable decorations and zero to starters',()=>{
  for(const item of catalog.items.filter(item=>item.kind==='decoration')) {
    assert.equal(Number.isSafeInteger(item.luxury),true,item.id);
    if(item.starter)assert.equal(item.luxury,0,item.id);
    else assert(decorationLuxury(item)>0,item.id);
  }
  for(const luxury of [-1,NaN,Infinity,1.5,'10'])assert.equal(decorationLuxury({kind:'decoration',luxury}),0);
  assert.equal(decorationLuxury({kind:'decoration',starter:true,luxury:10}),0);
});
