import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {createLaunchToken} from '../slack/session.mjs';
const redis=process.env.TEST_CHAT_REDIS_URL;
const root=new URL('../',import.meta.url);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('HTTP: two workers share Town/Slack acceptance, protect visiting homes and isolate DMs',{skip:!redis,timeout:30000},async()=>{
 assert(['127.0.0.1','localhost'].includes(new URL(redis).hostname));
 const namespace='C'+randomUUID().replaceAll('-','').toUpperCase(),secret=randomUUID(),dir=await mkdtemp(join(tmpdir(),'town-social-test-'));
 const loader=join(dir,'fixture.mjs'),cardLog=join(dir,'cards.jsonl'),threadLog=join(dir,'threads.jsonl');
 await writeFile(loader,`import {appendFileSync} from 'node:fs';const original=fetch;globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith('https://slack.com/api/')){
   const method=String(url).split('/').pop();let data;
   if(method==='conversations.members')data={ok:true,members:['U1','U2','U3','U4','U5','U6','U7'],response_metadata:{next_cursor:''}};
   else if(method==='users.info'){const id=options.body.get('user');data={ok:true,user:{id,real_name:'Test neighbor '+id,profile:{}}};}
   else if(method==='conversations.open')data={ok:true,channel:{id:'DTEST'}};
   else if(method==='chat.postMessage'||method==='chat.update'){data={ok:true,ts:String(Date.now())};if(method==='chat.update')appendFileSync(${JSON.stringify(cardLog)},JSON.stringify(JSON.parse(options.body.get('blocks')))+'\\n');if(options.body.get('thread_ts'))appendFileSync(${JSON.stringify(threadLog)},JSON.stringify(Object.fromEntries(options.body))+'\\n');}
   else throw Error('Unexpected Slack method');
   return Response.json(data);
  }
  if(!String(url).startsWith(${JSON.stringify(redis)}))throw Error('External network forbidden');
  return original(url,options);
 };`);
 const children=[];
 try{
  const urls=[];
  for(let i=0;i<2;i++){
   const p=await port(),base='http://127.0.0.1:'+p;
   const child=spawn(process.execPath,['--import',loader,new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,PORT:String(p),HOST:'127.0.0.1',PUBLIC_BASE_URL:base,RENDER:'',STAGING_PASSWORD:'',SLACK_BOT_TOKEN:'local-test',SLACK_SIGNING_SECRET:secret,LOTTERY_SYNC_SECRET:secret,SLACK_CHANNEL_ID:namespace,SLACK_ALLOW_SEND:'true',SLACK_CLIENT_ID:'',SLACK_CLIENT_SECRET:'',SLACK_LEDGER_CHANNEL_ID:'',UPSTASH_REDIS_REST_URL:redis,UPSTASH_REDIS_REST_TOKEN:'local-test',PROFILE_API_URL:'',PROFILE_API_SECRET:''},stdio:'ignore'});
   children.push(child);urls.push(base);
   let ready=false;for(let attempt=0;attempt<80;attempt++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;await delay(50);}assert(ready,'fixture server started');
  }
  const cookies={};
  for(let i=1;i<=8;i++){
   const r=await fetch(urls[0]+'/enter?token='+createLaunchToken({userId:'U'+i,channelId:namespace,signingSecret:secret}),{redirect:'manual'});
   cookies[i]=r.headers.get('set-cookie')?.split(';')[0];assert(cookies[i]);
  }
  async function api(user,path,body,worker=0,extra={}){
   const r=await fetch(urls[worker]+path,{headers:{cookie:cookies[user],'content-type':'application/json',...extra},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
   return {status:r.status,data:await r.json()};
  }
  const threadTs=String(Math.floor(Date.now()/1000)-60)+'.000001';
  async function lottery(action,extra={},worker=0){
    const body=JSON.stringify({action,channelId:namespace,messageTs:threadTs,...extra}),timestamp=String(Math.floor(Date.now()/1000));
    const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
    const response=await fetch(urls[worker]+'/api/lottery',{method:'POST',headers:{'content-type':'application/json','x-town-timestamp':timestamp,'x-town-signature':signature},body});
    return {status:response.status,data:await response.json()};
  }
  assert.equal((await api(1,'/api/lottery',{action:'status'})).status,401,'a member session cannot act as the scheduler');
  assert.equal((await lottery('status',{channelId:'COTHER'})).status,409);
  assert.equal((await lottery('register',{closesAt:new Date(Date.now()-30000).toISOString()})).status,200);
  const roster=(await api(1,'/api/slack/members')).data.members,keys=Object.fromEntries(roster.map(m=>[Number(m.id.slice(1)),m.characterKey]));
  const balance=async user=>(await api(user,'/api/shop')).data.wallet.balance;
  const initial=await balance(1);
  const invitation=(await api(1,'/api/slack/invitations',{inviteeId:'U2'})).data.invitation;
  assert(invitation?.id);
  assert.equal((await api(3,'/api/slack/invitations/respond',{id:invitation.id,status:'accepted'},1)).status,409);
  assert.equal((await api(2,'/api/slack/invitation-states',null,1)).data.incomingInvitations.length,1);
  const accepted=await api(2,'/api/slack/invitations/respond',{id:invitation.id,status:'accepted'},1);
  assert.equal(accepted.status,200,JSON.stringify(accepted));
  let firstState;for(let i=0;i<30;i++){firstState=(await api(1,'/api/slack/invitation-states')).data.states.U1;if(firstState.status==='booked')break;await delay(50);}
  assert.equal(firstState.partnerId,'U2');
  assert.deepEqual((await lottery('pool',{},1)).data.bookedIds.sort(),['U1','U2']);
  assert.equal((await lottery('commit',{pairs:[['U1','U3'],['U4','U5']]},1)).data.error,'already_booked');
  assert.equal(await balance(1),initial+5);assert.equal(await balance(2),initial+5);
  async function slackAccept(id,user){
   const payload={type:'block_actions',user:{id:user},channel:{id:'DTEST'},actions:[{action_id:'donut_accept',value:id}]};
   const body=new URLSearchParams({payload:JSON.stringify(payload)}).toString(),timestamp=String(Math.floor(Date.now()/1000));
   const signature='v0='+createHmac('sha256',secret).update('v0:'+timestamp+':'+body).digest('hex');
   return fetch(urls[0]+'/slack/interactions',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-slack-request-timestamp':timestamp,'x-slack-signature':signature},body});
  }
  assert.equal((await slackAccept(invitation.id,'U2')).status,200);
  const second=(await api(3,'/api/slack/invitations',{inviteeId:'U4'})).data.invitation;
  assert.equal((await slackAccept(second.id,'U4')).status,200);
  let state;for(let i=0;i<40;i++){state=(await api(4,'/api/slack/invitation-states',null,1)).data.states.U4;if(state.status==='booked')break;await delay(50);}
  assert.equal(state.status,'booked');assert.equal(await balance(4),initial+5);assert.equal(await balance(2),initial+5);
  let notices=[];
  for(let i=0;i<40;i++){try{notices=(await readFile(threadLog,'utf8')).trim().split('\n').map(JSON.parse);}catch{}if(notices.length===2)break;await delay(50);}
  assert.equal(notices.length,2,'Town acceptance and Slack acceptance each announce once');
  for(const notice of notices){assert.equal(notice.channel,namespace);assert.equal(notice.thread_ts,threadTs);}
  const one=(await api(5,'/api/slack/invitations',{inviteeId:'U6'})).data.invitation;
  const two=(await api(5,'/api/slack/invitations',{inviteeId:'U7'},1)).data.invitation;
  const race=await Promise.all([api(6,'/api/slack/invitations/respond',{id:one.id,status:'accepted'}),api(7,'/api/slack/invitations/respond',{id:two.id,status:'accepted'},1)]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(await balance(5),initial+5);
  const house=await api(1,'/api/house?owner='+keys[2]);assert.equal(house.data.canDecorate,false);
  assert.equal((await api(1,'/api/house?owner='+keys[2],{layout:house.data.layout})).status,403);
  assert.equal((await api(8,'/api/house?owner='+keys[2])).status,403);
  assert.equal((await api(1,'/api/social',{home:keys[2],id:randomUUID(),kind:'donut',amount:999})).data.error,'not_enough_donuts');
  const gift={home:keys[2],id:randomUUID(),kind:'donut',amount:2};
  await Promise.all([api(1,'/api/social',gift),api(1,'/api/social',gift,1)]);
  assert.equal(await balance(1),initial+3);assert.equal(await balance(2),initial+7);
  const dm=await api(1,'/api/messages',{peer:keys[2],from:keys[3],id:randomUUID(),text:'A private hello'});
  assert.equal(dm.status,201);assert.equal((await api(2,'/api/messages?peer='+keys[1],null,1)).data.messages[0].from,keys[1]);
  assert.deepEqual((await api(3,'/api/messages?peer='+keys[2])).data.messages,[]);
  assert.equal((await api(8,'/api/messages?peer='+keys[2])).status,403);
  assert.equal((await api(1,'/api/social',{...gift,id:randomUUID()},0,{origin:'https://example.invalid'})).status,403);
  const cards=(await readFile(cardLog,'utf8')).trim().split('\n').map(JSON.parse);
  assert(cards.length>=2);assert(cards.every(blocks=>blocks.every(b=>b.type==='section')),'Answered Slack cards remove action buttons');
 }finally{
  for(const child of children)child.kill();
  await Promise.all(children.map(child=>child.exitCode!==null?null:new Promise(r=>child.once('exit',r))));
  await rm(dir,{recursive:true,force:true});
 }
});
