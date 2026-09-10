import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import WebSocket from 'ws';
import {createSessionToken} from '../slack/session.mjs';

const root=new URL('../',import.meta.url);
const fixture={NODE_ENV:'production',RENDER:'',RENDER_EXTERNAL_HOSTNAME:'',PORT:'0',HOST:'',
 PUBLIC_BASE_URL:'https://fixture.ondigitalocean.app',STAGING_PASSWORD:'fixture-admin',
 SLACK_BOT_TOKEN:'fixture-bot',SLACK_SIGNING_SECRET:'fixture-signing-secret',SLACK_CHANNEL_ID:'CFIXTURE',
 SLACK_CLIENT_ID:'fixture-client',SLACK_CLIENT_SECRET:'fixture-client-secret',SLACK_ALLOW_SEND:'false',
 UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',SLACK_LEDGER_CHANNEL_ID:'',LOTTERY_SYNC_SECRET:'',
 PROFILE_API_URL:'',PROFILE_API_SECRET:'',TOWN_ADMIN_KEYS:''};

test('production rejects missing protection and incorrect public origins before listening', {timeout:15000}, async()=>{
 for(const [override,expected] of [
  [{STAGING_PASSWORD:''},/STAGING_PASSWORD is required/],
  [{SLACK_SIGNING_SECRET:''},/SLACK_SIGNING_SECRET/],
  [{PUBLIC_BASE_URL:''},/Production requires PUBLIC_BASE_URL/],
  [{PUBLIC_BASE_URL:'http://fixture.ondigitalocean.app'},/Production requires PUBLIC_BASE_URL/],
  [{PUBLIC_BASE_URL:'https://fixture.ondigitalocean.app/auth/slack/start'},/Production requires PUBLIC_BASE_URL/]
 ]) {
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,...fixture,...override},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  const [code]=await once(child,'exit');assert.notEqual(code,0);assert.match(output,expected);
 }
});

test('App Platform production binds publicly, protects members, uses new OAuth origin and serves authenticated WebSockets', {timeout:15000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'town-app-platform-'));
 const loader=join(dir,'fixture.mjs');
 await writeFile(loader,`globalThis.fetch=async url=>{if(String(url)==='https://slack.com/api/auth.test')return Response.json({ok:true,team_id:'TFIXTURE'});throw Error('Unexpected external request');};`);
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const child=spawn(process.execPath,['--import',loader,'server.mjs'],{cwd:root,env:{...process.env,...fixture,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 let socket;
 try {
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error(output);
   if(output.includes('Donut Town is running on'))break;
   await new Promise(resolve=>setTimeout(resolve,30));
  }
  assert(output.includes(`Donut Town is running on 0.0.0.0:${port}`),'production listens on all interfaces');
  const base='http://127.0.0.1:'+port;
  assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
  assert.equal((await fetch(base+'/api/slack/members')).status,401);
  const login=await fetch(base+'/auth/slack/start',{redirect:'manual'});
  assert.equal(login.status,302);
  assert.equal(new URL(login.headers.get('location')).searchParams.get('redirect_uri'),fixture.PUBLIC_BASE_URL+'/auth/slack/callback');
  assert.match(login.headers.get('set-cookie'),/Secure; SameSite=None/);
  const session=createSessionToken({userId:'UFIXTURE',channelId:fixture.SLACK_CHANNEL_ID,signingSecret:fixture.SLACK_SIGNING_SECRET});
  socket=new WebSocket(base.replace('http:','ws:')+'/realtime',{origin:base,headers:{cookie:'donut_town_session='+session}});
  const [raw]=await once(socket,'message');assert.equal(JSON.parse(String(raw)).type,'ready');
 } finally {
  socket?.terminate();child.kill();if(child.exitCode===null)await once(child,'exit');await rm(dir,{recursive:true,force:true});
 }
});
