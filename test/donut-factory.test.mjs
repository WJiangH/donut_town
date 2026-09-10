import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizePresenceState} from '../realtime/presence.mjs';
const ctx=vm.createContext({window:{location:{search:''}},document:{addEventListener(){}},btoa,atob,URLSearchParams});
for(const file of ['donut-factory.js','town-collision.js'])vm.runInContext(readFileSync(file,'utf8'),ctx);
const {DonutFactory:factory,FactoryCollision:collision}=ctx.window;
const sample=n=>Array.from({length:n},(_,i)=>[{id:`a${i}`,partnerId:`b${i}`},{id:`b${i}`,partnerId:`a${i}`}].map(p=>({...p,pairId:`pair${i}`,status:'booked'}))).flat();

test('two factories hold twelve whole pairs each; overflow uses shifts without duplicate seats',()=>{
 for(const count of [0,1,12,13,24,25,32]){
  const pairs=factory.pairsFor(sample(count));
  assert.equal(pairs.length,count);
  const seats=new Set();
  for(const pair of pairs){
   assert(pair.page%2===0 || pair.page%2===1);
   for(const spot of [pair.station.left,pair.station.right])seats.add(`${pair.page}:${spot.x}:${spot.y}`);
  }
  assert.equal(seats.size,count*2);
  for(const page of new Set(pairs.map(p=>p.page)))assert(pairs.filter(p=>p.page===page).length<=12);
  assert.deepEqual(factory.pairsFor(sample(count).reverse()).map(p=>p.pairId),pairs.map(p=>p.pairId));
 }
});

test('pending, partial, self, duplicated and nonreciprocal matches do not reserve a table',()=>{
 const valid=sample(1);
 for(const people of [[valid[0]],[...valid,valid[0]],valid.map(p=>({...p,status:'pending'})),[valid[0],{...valid[1],partnerId:'outsider'}],[valid[0],{...valid[1],id:'a0'}]])assert.equal(factory.pairsFor(people).length,0);
 const residents=valid.map(p=>({...p,slackId:p.id,id:99}));
 assert.equal(factory.pairsFor(residents).length,1,'identity comes from Slack, not numeric rendering IDs');
});

test('all twenty-four standing spots are reachable from the door without crossing any table',()=>{
 assert(collision.ready);
 const start={x:50,y:88};
 for(const goal of factory.stations.flatMap(s=>[s.left,s.right])){
  assert(collision.isWalkable(goal.x,goal.y));
  const path=collision.findPath(start,goal);assert(path.length);
  let previous=start;
  for(const p of path){
   const steps=Math.ceil(Math.hypot(p.x-previous.x,p.y-previous.y)/.1);
   for(let i=0;i<=steps;i++)assert(collision.isWalkable(previous.x+(p.x-previous.x)*i/steps,previous.y+(p.y-previous.y)*i/steps));
   previous=p;
  }
 }
 for(const table of factory.stations)assert(!collision.isWalkable(table.x,table.y+3));
 for(const [x,y] of [[50,22],[7,53],[93,54]])assert(!collision.isWalkable(x,y));
});

test('factory presence carries an isolated workshop and rejects malformed indices',()=>{
 const base={type:'state',scene:'donutFactory',x:50,y:88};
 for(const page of [0,1,2,3,999])assert.equal(normalizePresenceState({...base,workshop:page}).workshop,page);
 for(const page of [-1,1.5,1000,'1',null])assert.equal(normalizePresenceState({...base,workshop:page}).workshop,0);
 assert.equal(normalizePresenceState({...base,scene:'town',workshop:1}).workshop,undefined);
});

test('match refresh moves residents into factories and cancellation restores their original scene',()=>{
 const source=readFileSync('app.js','utf8');
 const body=source.slice(source.indexOf('function layoutBookedPairs()'),source.indexOf('function applyPairPreview()'));
 const residents=sample(1).map((p,i)=>({...p,slackId:p.id,id:i,baseX:20+i,baseY:60,homeScene:'chemPod'}));
 const scope=vm.createContext({residents,window:ctx.window,currentUser:null,factoryPairs:[],factoryPage:0,currentPairId:null,document:{querySelector:()=>({})},refreshResidentPoses(){}});
 vm.runInContext(body+';layoutBookedPairs()',scope);
 assert(residents.every(p=>p.scene==='donutFactory'));
 residents.forEach(p=>Object.assign(p,{status:'open',pairId:null,partnerId:null}));
 vm.runInContext('layoutBookedPairs()',scope);
 assert(residents.every(p=>p.scene==='chemPod'&&p.x===p.baseX&&p.y===60));
});

test('live workshop transitions repaint once; repeated movement does not rebuild residents',()=>{
 const source=readFileSync('app.js','utf8');
 const body=source.slice(source.indexOf('function upsertRemotePlayer('),source.indexOf('function renderLivePlayers('));
 let renders=0;
 const remotes=new Map();
 const scope=vm.createContext({currentUser:{id:'self'},activeThemeId:'classic',remotePlayers:remotes,renderCurrentScene(){renders++;},removeRemotePlayer(id){remotes.delete(id);}});
 vm.runInContext(body,scope);
 const send=state=>{scope.state=state;vm.runInContext('upsertRemotePlayer(state)',scope);};
 const base={userId:'visitor',scene:'donutFactory',themeId:'halloween',workshop:0,x:20,y:52};
 send(base);assert.equal(renders,1);assert(remotes.has('visitor'),'interiors share visitors across outdoor themes');
 send({...base,x:21});assert.equal(renders,1);
 send({...base,workshop:1,x:79,y:73});assert.equal(renders,2);assert.equal(remotes.get('visitor').x,79);
 send({...base,scene:'town'});assert(!remotes.has('visitor'),'outdoor positions belong only to their own theme');
});

test('a roster change moves a reserved player with their pair, but never teleports a walking player',()=>{
 const source=readFileSync('app.js','utf8'),body=source.slice(source.indexOf('function layoutBookedPairs()'),source.indexOf('function applyPairPreview()'));
 const people=sample(2),currentUser=people.pop(),residents=people.map(p=>({...p,baseX:20,baseY:60}));
 const scope=vm.createContext({residents,currentUser,currentScene:'donutFactory',player:{x:50,y:88},scenePlayerPositions:{},clickPath:[],window:ctx.window,factoryPairs:[],factoryPage:0,currentPairId:null,document:{querySelector:()=>({})},refreshResidentPoses(){}});
 vm.runInContext(body+';layoutBookedPairs()',scope);
 const before={...scope.player};
 residents[0].status=residents[1].status='open';
 vm.runInContext('layoutBookedPairs()',scope);assert.notEqual(scope.player.x,before.x);
 Object.assign(scope.player,{x:50,y:88});residents[0].status=residents[1].status='booked';
 vm.runInContext('layoutBookedPairs()',scope);assert.equal(scope.player.x,50);assert.equal(scope.player.y,88);
});


test('twelve distinct stations keep partners side by side, and baking follows their own reserved spot',()=>{
 assert.equal(factory.stations.length,12);
 assert.equal(new Set(factory.stations.map(s=>s.variant)).size,12);
 const pairs=factory.pairsFor(sample(25));
 for(const pair of pairs){
  assert.equal(pair.station.left.y,pair.station.right.y);
  assert(pair.station.right.x-pair.station.left.x<6);
  for(const [side,spot] of [pair.station.left,pair.station.right].entries()){
   const id=pair.members[side].id;
   assert.equal(factory.stationFor(pairs,id,pair.page,spot).side,side);
   assert.equal(factory.stationFor(pairs,id,pair.page,spot,true),null);
   assert.equal(factory.stationFor(pairs,id,pair.page+1,spot),null);
   assert.equal(factory.stationFor(pairs,id,pair.page,{x:50,y:88}),null);
  }
 }
 assert.equal(factory.stationFor(pairs,'visitor',0,pairs[0].station.left),null);
});
