import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('entry loads equipped layers once; actions are deferred and failures keep the character',async()=>{
  const pending=[];let paints=0;
  const context={Map,WeakMap,Promise,setTimeout,clearTimeout,
    Image:class {set src(url){this.url=url;pending.push(this)}},
    paintResidentCharacters:()=>paints++,sceneLayer:()=>null,layer:{}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const characterImages ='),source.indexOf('function wardrobeManifestUrl')),context);
  const root='/assets/residents/r-test/';
  const action={url:root+'actions-v1.png',imageWidth:20,imageHeight:30};
  const character={url:root+'walk-v1.png',layers:[root+'wardrobe-v1/base.png',root+'wardrobe-v1/shoes.png'],imageWidth:10,imageHeight:10,actions:{sit:action}};
  const first=context.loadCharacterArt(character),second=context.loadCharacterArt(character);
  assert.deepEqual(pending.map(i=>i.url),character.layers);
  for(const image of pending){image.naturalWidth=10;image.naturalHeight=10;image.onload();}
  assert.equal(await first,character);assert.equal(await second,character);
  assert.equal(context.characterActionReady(action),false);
  assert.equal(context.characterActionReady(action),false);
  assert.equal(pending.length,3);
  pending[2].naturalWidth=20;pending[2].naturalHeight=30;pending[2].onload();
  await new Promise(setImmediate);
  assert.equal(context.characterActionReady(action),true);assert.equal(paints,1);
  const failed={...action,url:root+'bad.png'};
  assert.equal(context.characterActionReady(failed),false);pending[3].onerror();
  await new Promise(setImmediate);
  assert.equal(context.characterActionReady(failed),false);assert.equal(pending.length,4);
  assert.equal(await context.loadCharacterArt({...character,actions:{bad:{url:'https://example.com/bad.png'}}}),null);
});

test('member fetch overlaps map setup but residents wait for the map',async()=>{
  let finishMap,finishMembers,placed=0,opened=false;
  const response={ok:true};
  const context={Promise,AbortSignal,URLSearchParams,location:{search:''},setTimeout:()=>1,clearTimeout(){},
    assignTownActivities(){},applyTownTheme(){},themeController:null,
    mountThemes:()=>new Promise(resolve=>finishMap=resolve),
    fetch:()=>new Promise(resolve=>finishMembers=resolve),
    syncSlackResidents:async r=>{assert.equal(r,response);assert(context.themeController);placed++;return false},
    document:{querySelector:()=>({hidden:false,textContent:'',classList:{add(){opened=true}}})}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function startTown()'),source.indexOf('document.querySelector("#retryTown").addEventListener')).replace("await import('./town-themes/client.mjs')",'({mountThemes:globalThis.mountThemes})'),context);
  const entry=context.startTown();
  assert.equal(typeof finishMembers,'function');assert.equal(typeof finishMap,'function');
  finishMembers(response);await new Promise(setImmediate);assert.equal(placed,0);
  finishMap({check(){}});await entry;assert.equal(placed,1);assert.equal(opened,false);
});

test('neighbor avatar uses native lazy loading and falls back to initials on failure',()=>{
  let error;
  const image={addEventListener:(_,fn)=>error=fn,set src(value){assert.equal(this.loading,'lazy');assert.equal(this.referrerPolicy,'no-referrer');this.url=value}};
  const element={replaceChildren(){},classList:{toggle(){},remove(){}},append(img){assert.equal(img,image)}};
  const context={document:{createElement:()=>image}};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function initialsFor('),source.indexOf('function slackFacts(')),context);
  context.setSlackAvatar(element,{name:'Test Neighbor',avatarUrl:'https://example.com/avatar.png'},true);
  assert.equal(image.url,'https://example.com/avatar.png');assert.equal(image.decoding,'async');
  error();assert.equal(element.textContent,'TN');
  context.setSlackAvatar(element,{name:'Other Neighbor'},true);assert.equal(element.textContent,'ON');
});
