import test from 'node:test';
import assert from 'node:assert/strict';
import {updatePet} from '../pets.mjs';
const state=(x=50,y=50)=>({x,y,trail:[],facing:'down',moving:false});
test('an exactly overlapping cat separates and settles without idle fidget',()=>{
 const pet=state(),owner={x:50,y:50,moving:false};
 for(let i=0;i<150;i++)updatePet(pet,owner,.016,()=>true);
 assert(Math.hypot(pet.x-owner.x,pet.y-owner.y)>1.8);
 const point={x:pet.x,y:pet.y};
 for(let i=0;i<600;i++)updatePet(pet,owner,.016,()=>true);
 assert.deepEqual({x:pet.x,y:pet.y},point);assert.equal(pet.moving,false);
});
test('cat follows motion without crossing blocked ground, and blocked feet do not animate walking',()=>{
 const pet=state(47,50);let owner={x:50,y:50,moving:true};
 for(let i=0;i<250;i++){owner.x+=.04;updatePet(pet,owner,.016,(x,y)=>x<55);assert(pet.x<55);}
 assert.equal(pet.moving,false);assert(Number.isFinite(pet.stillFor));
});
test('cat escapes overlap after a reversal and keeps a finite position',()=>{
 const pet=state(52.2,50),owner={x:50,y:50,moving:true};
 for(let i=0;i<100;i++){owner.x+=.025;updatePet(pet,owner,.016,()=>true);}
 owner.moving=false;
 for(let i=0;i<150;i++)updatePet(pet,owner,.016,()=>true);
 assert(Math.hypot(pet.x-owner.x,pet.y-owner.y)>1.8);
});
