import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { townChats, recentRounds, chatProfile } from '../chats/history.mjs';
import { ChatStore } from '../chats/store.mjs';
import { ChatService } from '../chats/service.mjs';
import { UpstashInvitationStore } from '../slack/upstash-store.mjs';
const keyFor=id=>createHash('sha256').update(id).digest('hex');
const members=[{id:'UALICE',displayName:'Alice'},{id:'UBOB',displayName:'Bob'},{id:'UEVE',displayName:'Eve'}];
const invite={id:'one',inviterId:'UALICE',inviteeId:'UBOB',status:'accepted',createdAt:'2026-09-01T12:00:00Z',answeredAt:'2026-09-02T12:00:00Z'};
const round={roundId:'week:2026-08-31',snapshots:[{inviterId:'UALICE',invitations:[invite]}]};
const record=townChats([round],keyFor)[0];

test('accepted matches are not completed chats; duplicates and opposite invitations count once',()=>{
  const duplicates={...round,snapshots:[...round.snapshots,{inviterId:'UBOB',invitations:[{...invite,inviterId:'UBOB',inviteeId:'UALICE'}]}]};
  const chats=townChats([round,duplicates],keyFor);
  assert.equal(chats.length,1);assert.equal(chats[0].completedAt,null);
  assert.equal(townChats([{...round,roundId:'week:2026-09-07'},round],keyFor).length,2);
  for(const invalid of [{status:'pending'},{status:'declined'},{selfTest:true},{inviteeId:'UALICE'},{inviterId:'UEVE'},{answeredAt:'bad date'}]) {
    assert.equal(townChats([{...round,snapshots:[{inviterId:'UALICE',invitations:[{...invite,...invalid}]}]}],keyFor).length,0);
  }
  assert(!JSON.stringify(chats).includes('UALICE'),'stored records contain digests, not Slack IDs');
});

test('history and friendships are scoped to the signed-in member and distinguish confirmation states',()=>{
  const args={memberKey:keyFor('UALICE'),members,keyFor,matches:[record],stored:[],friendships:{},hasOlder:false};
  assert.equal(chatProfile(args).history[0].status,'matched');
  const waiting={...record,confirmations:{[keyFor('UALICE')]:'2026-09-03T00:00:00Z'}};
  assert.equal(chatProfile({...args,stored:[waiting]}).history[0].status,'waiting');
  const complete={...waiting,completedAt:'2026-09-04T00:00:00Z'};
  const data=chatProfile({...args,stored:[complete],friendships:{[keyFor('UBOB')]:3}});
  assert.equal(data.history[0].status,'completed');assert.equal(data.completed,3);assert.equal(data.friends[0].score,30);
  assert.equal(data.history[0].partner.name,'Bob');assert.equal(data.connections,1);
  assert.equal(chatProfile({...args,memberKey:keyFor('UEVE')}).history.length,0);
  assert(!JSON.stringify(data).includes('UALICE'));
  assert.equal(data.coverage.lotteryConnected,false);
});

test('the past 52 rounds are bounded and loaded in one Redis call',async()=>{
  const ids=recentRounds(new Date('2026-09-06T12:00:00Z'));
  assert.equal(ids.length,52);assert.equal(ids[0],'week:2026-08-31');assert.equal(new Set(ids).size,52);
  let command;
  const store=new UpstashInvitationStore({url:'https://redis.invalid',token:'test',fetchImpl:async(_url,init)=>{command=JSON.parse(init.body);return {ok:true,json:async()=>({result:ids.map((id,i)=>i?null:JSON.stringify({version:1,...round,roundId:id}))})}}});
  assert.equal((await store.loadRecent(ids)).length,1);assert.equal(command[0],'MGET');assert.equal(command.length,53);
});

test('history storage failures remain failures rather than a fabricated empty history',async()=>{
  const store=new ChatStore({url:'https://redis.invalid',token:'test',fetchImpl:async()=>({ok:false})});
  await assert.rejects(()=>store.list(keyFor('UALICE')),/chat_history_unavailable/);
  await assert.rejects(()=>store.list('UALICE'),/invalid_member_key/);
  await assert.rejects(()=>store.confirm(record,keyFor('UEVE')),/chat_not_found/);
});

test('stored history reads are capped while friendship totals retain older confirmations',async()=>{
  const seen=[];
  const ids=Array.from({length:51},(_,i)=>keyFor('record'+i));
  const store=new ChatStore({url:'https://redis.invalid',token:'test',fetchImpl:async(_url,init)=>{
    const args=JSON.parse(init.body);seen.push(args);
    const result=args[0]==='ZREVRANGE'?ids:args[0]==='HGETALL'?[keyFor('UBOB'),'80']:args.slice(1).map(()=>JSON.stringify(record));
    return {ok:true,json:async()=>({result})};
  }});
  const data=await store.list(keyFor('UALICE'));
  assert.equal(data.hasOlder,true);assert.equal(data.records.length,50);assert.equal(data.friendships[keyFor('UBOB')],80);
  assert.equal(seen.find(args=>args[0]==='MGET').length,51);
});

test('the service cannot confirm a guessed chat ID or another member\'s match',async()=>{
  let writes=0;
  const service=new ChatService({invitationStore:{loadRecent:async()=>[round]},store:{list:async()=>({records:[],friendships:{}}),confirm:async()=>{writes++}},keyFor,currentRound:()=>({...round,snapshots:[]})});
  await assert.rejects(()=>service.confirm('UEVE',record.id,members),/chat_not_found/);
  await assert.rejects(()=>service.confirm('UALICE',keyFor('invented'),members),/chat_not_found/);
  await assert.rejects(()=>service.profile('UOUTSIDER',members),/member_not_found/);
  assert.equal(writes,0);
});
