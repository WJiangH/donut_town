import test from 'node:test';
import assert from 'node:assert/strict';
import {OutfitStore, validateOutfit, equippedCharacter} from '../characters/wardrobe/store.mjs';
const look={jacket:'navy',shoes:'cream',eyewear:'smoke'};
const key='a'.repeat(64);
test('outfits accept only complete known item choices',()=>{
 assert.deepEqual(validateOutfit(look),look);
 for(const invalid of [null,[],{}, {...look,memberId:'other'}, {...look,shoes:'/custom.png'}, {...look,jacket:'none'}])assert.throws(()=>validateOutfit(invalid));
 assert.equal(equippedCharacter(null,look),null);
});
test('saved outfit survives a fresh store instance and stores only a hash field',async()=>{
 const data=new Map();const fetchImpl=async(_url,options)=>{
 const [cmd,namespace,field,value]=JSON.parse(options.body);
 assert.equal(namespace,'donut-town:wardrobe:v1');
 if(cmd==='HSET'){assert.equal(field,key);data.set(field,value);return {ok:true,json:async()=>({result:1})};}
 return {ok:true,json:async()=>({result:[...data].flat()})};
 };
 const config={url:'https://test.invalid',token:'test',fetchImpl};
 const store=new OutfitStore(config);await store.list();await store.save(key,look);
 assert.deepEqual((await store.list())[key],look);
 assert.deepEqual((await new OutfitStore(config).list())[key],look);
 await assert.rejects(store.save('raw-member-id',look));
});
test('failed save does not overwrite last confirmed outfit',async()=>{
 let fail=false;
 const store=new OutfitStore({url:'https://test.invalid',token:'test',fetchImpl:async()=>({ok:!fail,json:async()=>({result:[]})})});
 await store.save(key,look);fail=true;
 await assert.rejects(store.save(key,{...look,jacket:'olive'}));
 assert.deepEqual(store.cache[key],look);
});
