import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {LotteryBridge,verifyLotteryRequest} from '../lottery/bridge.mjs';
import {ShopStore} from '../shop/store.mjs';
import {SocialStore} from '../social/store.mjs';
import {UpstashInvitationStore} from '../slack/upstash-store.mjs';
import {activeRoundId} from '../slack/invitations.mjs';

test('Lottery service authentication binds timestamp, body and dedicated secret',()=>{
  const now=Date.now(),timestamp=String(Math.floor(now/1000)),secret='test-only-secret-'.repeat(3),body='{"action":"status"}';
  const headers={'x-town-timestamp':timestamp,'x-town-signature':createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex')};
  assert(verifyLotteryRequest(secret,headers,body,now));
  assert(!verifyLotteryRequest('',headers,body,now));
  assert(!verifyLotteryRequest(secret,headers,body+' ',now));
  assert(!verifyLotteryRequest(secret,headers,body,now+301000));
  assert(!verifyLotteryRequest(secret,{...headers,'x-town-signature':'bad'},body,now));
});

test('Lottery and Town share atomic bookings, rewards and retryable thread announcements',{skip:!process.env.TEST_CHAT_REDIS_URL},async()=>{
  const url=process.env.TEST_CHAT_REDIS_URL;assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
  const channelId='C'+randomUUID().replaceAll('-','').toUpperCase();
  const shop=new ShopStore({url,token:'local-test'}),social=new SocialStore(shop,channelId);
  const now=new Date('2026-09-08T12:00:00Z'),roundId=activeRoundId(now),messageTs=String(Date.parse('2026-09-07T10:00:00Z')/1000)+'.000001';
  const keyFor=id=>channelId+':'+id,deliveries=[];
  let failDelivery=true;
  const options={social,channelId,keyFor,now:()=>now,allowSend:true,
    members:async()=>Array.from({length:10},(_,i)=>({id:'U'+(i+1)})),
    slack:{postMessage:async(channel,payload)=>{if(failDelivery)throw Error('simulated Slack outage');deliveries.push({channel,payload});}}
  };
  const bridge=new LotteryBridge(options),other=new LotteryBridge(options);
  const call=(action,data={})=>bridge.handle({channelId,messageTs,action,...data});
  const add=(id,a,b)=>social.invitation('add',{id,inviterId:a,inviteeId:b,priority:1,status:'pending'},roundId);
  const accept=(id,a,b)=>social.invitation('answer',{id,inviter:a,responder:b,status:'accepted'},roundId,[keyFor(a),keyFor(b)]);
  const credits=async id=>JSON.parse(await shop.command(['HGET',shop.key,keyFor(id)])||'{}').credits||0;
  await assert.rejects(call('pool'),{code:'round_not_registered'});
  const registration={closesAt:'2026-09-08T10:00:00Z'};
  await call('register',registration);await call('register',registration);
  await assert.rejects(call('register',{closesAt:'2026-09-14T10:00:00Z'}),{code:'invalid_round_window'});
  await assert.rejects(call('register',{messageTs:messageTs.replace('000001','000002'),...registration}),{code:'round_conflict'});
  await add('direct','U7','U8');await accept('direct','U7','U8');
  assert.deepEqual((await call('pool')).bookedIds.sort(),['U7','U8']);
  assert.equal((await bridge.notify()).pending,true);
  assert.equal(await credits('U7'),5,'Slack failure never undoes a confirmed booking');
  await assert.rejects(call('commit',{pairs:[['U1','U2'],['U3','U7']]}),{code:'already_booked'});
  assert.equal(await credits('U1'),0,'no partial batch when a later pair conflicts');
  await add('race','U1','U2');
  const race=await Promise.allSettled([accept('race','U1','U2'),call('commit',{pairs:[['U1','U3'],['U4','U5']],leftover:'U6'})]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await credits('U1'),5);
  const batch=(await call('pool')).committed;
  if(batch){await call('commit',{pairs:batch.pairs,leftover:batch.leftover});assert.equal(await credits('U4'),5);}
  else {
    assert.equal(await credits('U4'),0);
    await call('commit',{pairs:[['U3','U4']],leftover:'U5'});
    await call('commit',{pairs:[['U4','U3']],leftover:'U5'});
    assert.equal(await credits('U4'),5,'reordered retry credits exactly once');
  }
  await assert.rejects(call('commit',{pairs:[]}),{code:'lottery_already_committed'});
  await assert.rejects(call('commit',{pairs:[['U9','U9']]}),{code:'invalid_pairs'});
  const data=await bridge.records(roundId),lotteryPair=data.invitations.find(i=>i.source==='lottery');
  await assert.rejects(add('blocked',lotteryPair.inviteeId,'U10'),{code:'already_booked'});
  failDelivery=false;
  await Promise.all([bridge.notify(),other.notify()]);
  const count=deliveries.length;assert.equal(count,data.invitations.filter(i=>i.status==='accepted'&&i.source!=='lottery').length,'only Town pairs get bridge reminders; the Sheet announces random results');
  await bridge.notify();assert.equal(deliveries.length,count,'sent thread notices are not posted again');
  for(const {channel,payload} of deliveries){assert.equal(channel,channelId);assert.equal(payload.thread_ts,messageTs);assert.equal(payload.reply_broadcast,false);}
  const fresh=new SocialStore(shop,channelId+'X'),empty=new LotteryBridge({...options,social:fresh,channelId:channelId+'X'});
  await empty.handle({action:'register',channelId:channelId+'X',messageTs,...registration});
  await empty.handle({action:'commit',channelId:channelId+'X',messageTs,pairs:[],leftover:'U9'});
  const persisted=await new UpstashInvitationStore({url,token:'local-test',namespace:channelId+'X'}).load(roundId);
  assert.deepEqual(persisted,[],'empty pools remain a readable weekly invitation record');
  // A separate canonical round models the opposite ordering: scheduler wins first.
  const scheduledSocial=new SocialStore(shop,channelId+'Y'),scheduled=new LotteryBridge({...options,social:scheduledSocial,channelId:channelId+'Y'});
  await scheduled.handle({action:'register',channelId:channelId+'Y',messageTs,...registration});
  await scheduledSocial.invitation('add',{id:'late',inviterId:'U9',inviteeId:'U10',priority:1,status:'pending'},roundId);
  await scheduled.handle({action:'commit',channelId:channelId+'Y',messageTs,pairs:[['U9','U10']]});
  await assert.rejects(scheduledSocial.invitation('answer',{id:'late',inviter:'U9',responder:'U10',status:'accepted'},roundId,[keyFor('U9'),keyFor('U10')]),{code:'invitation_not_active'});
  assert.equal(await credits('U9'),5);
});
