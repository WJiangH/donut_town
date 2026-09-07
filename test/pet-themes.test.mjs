import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {collisionFor} from '../scripts/validate-map-themes.mjs';
import {updatePet,petSpawn,petSpace} from '../pets-motion.mjs';
const catalog=JSON.parse(readFileSync('content/themes/catalog.json'));
function simulate(theme,fps,goal){
 const c=collisionFor(theme),geometry={width:theme.worldWidth,height:theme.worldWidth*theme.imageSize.height/theme.imageSize.width,lineIsClear:c.lineIsClear,findPath:c.findPath};
 const owner={...c.nearestWalkable(theme.spawn.x,theme.spawn.y),moving:true},pet={...petSpawn(owner,c.isWalkable,geometry),trail:[],facing:'down'},route=c.findPath(owner,goal),m=petSpace(geometry);
 let missedStops=0,positionBefore;
 for(let i=0;i<fps*65&&route.length;i++){
  const p=route[0],d=Math.hypot(owner.x-p.x,owner.y-p.y),step=Math.min(5/fps,d);if(d<1e-7){route.shift();continue;}
  owner.x+=(p.x-owner.x)*step/d;owner.y+=(p.y-owner.y)*step/d;
  positionBefore={x:pet.x,y:pet.y};updatePet(pet,owner,1/fps,c.isWalkable,geometry);
  assert.equal(pet.stillFor,0,'a walking owner never enters the idle branch');
  assert(c.lineIsClear(positionBefore,pet),'pet cannot cut blocked corners');
  if(!pet.moving)missedStops++;
 }
 assert.equal(route.length,0,'fixture owner reaches destination');owner.moving=false;
 for(let i=0;i<fps*8;i++)updatePet(pet,owner,1/fps,c.isWalkable,geometry);
 assert(m.distance(pet,owner)<120,'companion reaches the owner after the walk');
 const settled={x:pet.x,y:pet.y,facing:pet.facing};
 for(let i=0;i<fps*3;i++)updatePet(pet,owner,1/fps,c.isWalkable,geometry);
 assert.deepEqual({x:pet.x,y:pet.y,facing:pet.facing},settled,'idle target and facing stay fixed');assert.equal(pet.moving,false);
 return missedStops;
}
for(const entry of catalog){
 const theme=JSON.parse(readFileSync('.'+entry.manifest));
 for(const fps of [30,60,120,144])test(`${entry.id}: follow, corners and settled pose at ${fps}Hz`,()=>{
  const goals=theme.zones.filter((_,i)=>i%Math.max(1,Math.floor(theme.zones.length/8))===0).slice(0,10).map(z=>z.anchor);
  for(const goal of goals)simulate(theme,fps,goal);
 });
}
test('new map sizes and aspect ratios use the same follower contract',()=>{
 for(const [width,height] of [[1024,1024],[4096,1536],[1536,4096],[8192,4096]])for(const fps of [30,144]){
  const geometry={width,height},m=petSpace(geometry),owner={x:35,y:45,moving:true},pet={...petSpawn(owner,()=>true,geometry),trail:[]};
  for(let i=0;i<fps*3;i++){owner.x+=150/(width/100)/fps;updatePet(pet,owner,1/fps,()=>true,geometry);assert.equal(pet.stillFor,0);}
  owner.moving=false;for(let i=0;i<fps*5;i++)updatePet(pet,owner,1/fps,()=>true,geometry);
  assert(m.distance(pet,owner)>60&&m.distance(pet,owner)<78);assert(!pet.moving);
 }
});
