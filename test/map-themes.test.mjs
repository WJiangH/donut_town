import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {auditTheme,collisionFor} from '../scripts/validate-map-themes.mjs';
import {validateTheme,canManageTheme} from '../town-themes/contract.mjs';
import {ThemeService} from '../town-themes/service.mjs';
import {ThemeStore} from '../town-themes/store.mjs';
const catalog=JSON.parse(readFileSync('content/themes/catalog.json'));

for (const entry of catalog) test(`${entry.id}: art identity, entrances, interactions and 160 resident slots stay navigable`,()=>{
  const theme=JSON.parse(readFileSync('.'+entry.manifest));
  assert.equal(auditTheme(theme).id,entry.id);
});
test('Halloween scenery blocks are respected and baseline theme remains unchanged',()=>{
  const base=JSON.parse(readFileSync('content/themes/classic.json'));
  const theme=JSON.parse(readFileSync('content/themes/halloween.json'));
  assert.notEqual(base.walkMask.bits,theme.walkMask.bits);
  assert.equal(theme.navigation.base,null,'New layouts must not inherit Classic geometry');
  assert.notDeepEqual(theme.entrances,base.entrances);
  for(const p of [{x:50,y:52},{x:50,y:83},{x:22,y:65},{x:83.7,y:53.7}])assert(collisionFor(theme).isWalkable(p.x,p.y));
  assert.equal(new ThemeStore().configured,false);
  const c=collisionFor(theme);
  for (const [x,y] of [[50,18],[12,36],[85,40],[13,70],[60,86],[35.5,46]]) assert(!c.isWalkable(x,y));
  const malformed=structuredClone(theme);malformed.image='https://untrusted.example/image.png';
  assert.throws(()=>validateTheme(malformed),/invalid_theme/);
  malformed.image=theme.image;malformed.walkMask.bits='AAAA';
  assert.throws(()=>validateTheme(malformed),/invalid_theme/);
});
test('only channel admins or exact configured character keys may change the shared theme',async()=>{
  const hash='a'.repeat(64),other='b'.repeat(64);
  assert(canManageTheme({isWorkspaceAdmin:true},other));
  assert(!canManageTheme({isWorkspaceAdmin:'true'},other));
  assert(!canManageTheme(null,hash,hash));
  assert(canManageTheme({},hash,hash));
  assert(!canManageTheme({isWorkspaceAdmin:true},other,hash));
  assert(!canManageTheme({isWorkspaceAdmin:true},other,'invalid-configuration'));
  let state={id:'classic',revision:'initial'},writes=0,notifications=0,reads=0;
  const service=new ThemeService({catalog,store:{configured:true,load:async()=>{reads++;return state;},save:async(id,revision)=>{assert.equal(revision,state.revision);writes++;return state={id,revision:'saved'};}},memberFor:async id=>id==='admin'?{isWorkspaceAdmin:true}:id==='member'?{}:null,keyFor:()=>other,onChanged:()=>notifications++});
  for (const [id,error] of [[undefined,'slack_login_required'],['member','town_admin_required'],['outsider','town_admin_required']]) await assert.rejects(()=>service.change(id,{id:'halloween',revision:'initial'}),new RegExp(error));
  await assert.rejects(()=>service.change('admin',{id:'../secret',revision:'initial'}),/invalid_theme/);
  assert.equal(writes,0);
  await service.view('admin');assert.equal(writes,0,'preview/settings read never changes the theme');
  await Promise.all(Array.from({length:64},()=>service.view('member')));
  assert.equal(reads,1,'visitors share a short-lived state read');
  assert.equal((await service.change('admin',{id:'halloween',revision:'initial'})).id,'halloween');
  assert.equal((await service.view('member')).current.id,'halloween');
  assert.equal(notifications,1);
});
test('storage outage fails closed; no silent Classic fallback after a saved theme',async()=>{
  const store=new ThemeStore({url:'http://127.0.0.1',token:'test',fetchImpl:async()=>{throw new Error('offline');}});
  await assert.rejects(()=>store.load(),/offline/);
  assert.deepEqual(await new ThemeStore().load(),{id:'classic',revision:'initial'});
  await assert.rejects(()=>new ThemeStore().save('halloween','initial'),/theme_store_unavailable/);
});
const url=process.env.TEST_CHAT_REDIS_URL;
test('theme survives a new store instance and stale administrators cannot overwrite a newer choice',{skip:!url},async()=>{
  assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
  const config={url,token:'local-test',namespace:'theme-test-'+randomUUID()};
  const a=new ThemeStore(config),b=new ThemeStore(config);
  assert.equal((await a.load()).id,'classic');
  const first=await a.save('halloween','initial');
  assert.deepEqual(await b.load(),first);
  await assert.rejects(()=>b.save('classic','initial'),/theme_conflict/);
  assert.equal((await new ThemeStore(config).load()).id,'halloween');
  await b.save('classic',first.revision);
  assert.equal((await a.load()).id,'classic');
});

test('every Halloween activity-to-activity route can actually be walked without clipping a blocked corner',()=>{
 const theme=JSON.parse(readFileSync('content/themes/halloween.json')),c=collisionFor(theme);
 const points=[theme.spawn,...theme.zones.map(z=>z.anchor),...Object.values(theme.entrances).map(e=>e.landing)];
 for(const start of points)for(const goal of points){
  const route=c.findPath(start,goal);assert(route.length);let from=start;
  for(const to of route){
   const steps=Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/.025);
   for(let i=1;i<=steps;i++){const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;assert(c.isWalkable(x,y),`Blocked route ${JSON.stringify(start)} -> ${JSON.stringify(goal)} at ${x},${y}`);}
   from=to;
  }
 }
});
