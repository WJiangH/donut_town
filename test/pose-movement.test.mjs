import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const loop=source.slice(source.indexOf('function gameLoop('),source.indexOf('\nfunction openResident('));
function game({click=false,storageFails=false}={}) {
 const removed=[],presence=[];let pickerUpdates=0;
 const context={chosenPose:'sit',playerAction:'sit',currentUser:{character:{actions:{sit:{facing:'down'}}}},pressedKeys:new Set(),clickPath:[],player:{x:50,y:50},lastGameTime:0,lastFrameChange:0,playerFrame:1,playerDirection:'down',currentScene:'town',residentPosesAnimate:false,
 window:{localStorage:{removeItem:key=>{if(storageFails)throw Error('blocked');removed.push(key)}},TownZones:{reset(){},ready:false},requestAnimationFrame(){}},
 renderPosePicker(){pickerUpdates++},isWalkable:()=>true,setPlayerDirection(){},rememberPosition(){},updatePlayerElement(){},updateTownCamera(){},updatePetFollowers(){},renderLivePlayers(){},publishPresence(force,moving){presence.push({moving,action:context.playerAction})}};
 vm.createContext(context);vm.runInContext(loop,context);
 context.gameLoop(16);assert.equal(context.chosenPose,'sit','idle keeps chosen pose');
 if(click)context.clickPath=[{x:52,y:50}];else context.pressedKeys.add('w');
 return {context,removed,presence,pickerUpdates:()=>pickerUpdates};
}
for(const click of [false,true])test(`${click?'click-to-walk':'keyboard movement'} clears the held pose permanently`,()=>{
 const g=game({click});g.context.gameLoop(32);
 assert.equal(g.context.chosenPose,null);assert.equal(g.context.playerAction,null);assert.deepEqual(g.removed,['donut-town:pose']);assert.equal(g.pickerUpdates(),1);
 assert.deepEqual(g.presence.at(-1),{moving:true,action:null});
 g.context.pressedKeys.clear();g.context.clickPath=[];g.context.gameLoop(48);
 assert.equal(g.context.playerAction,null,'stopping does not restore the old pose');assert.equal(g.pickerUpdates(),1);
});
test('movement clears poses even if local storage is unavailable',()=>{const g=game({storageFails:true});g.context.gameLoop(32);assert.equal(g.context.chosenPose,null);assert.equal(g.context.playerAction,null)});
