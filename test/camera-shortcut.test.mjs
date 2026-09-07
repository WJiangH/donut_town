import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Space switches town views once, without stealing typing or button activation',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf('document.addEventListener("keydown", event => {'),source.indexOf('document.addEventListener("keyup"'));
  let onKey,changes=0;
  const context={window:{},currentScene:'town',cameraMode:'overview',pressedKeys:new Set(),drawer:{classList:{contains:()=>false}},
    document:{addEventListener:(_,fn)=>onKey=fn,querySelector:()=>({classList:{contains:()=>false}})},
    setCameraMode:mode=>{context.cameraMode=mode;changes++;}};
  vm.runInNewContext(handler,context);
  function space(target='map',repeat=false,modifiers={}){
    let prevented=false;
    onKey({...modifiers,code:'Space',key:' ',repeat,preventDefault(){prevented=true},target:{closest:selector=>target==='input'?selector.startsWith('input'):target==='button'?selector.startsWith('button'):false}});
    return prevented;
  }
  assert(space());assert.equal(context.cameraMode,'follow');
  assert(space('map',true));assert.equal(changes,1);
  assert(space());assert.equal(context.cameraMode,'overview');
  assert(!space('input'));assert(!space('button'));assert(!space('map',false,{ctrlKey:true}));assert.equal(changes,2);
  for(const mode of ['townHouseOpen','townSettingsOpen']){context.window[mode]=true;assert(!space());context.window[mode]=false;}
  context.currentScene='donutShop';assert(!space());assert.equal(changes,2);
});
