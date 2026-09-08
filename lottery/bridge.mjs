import {createHash, createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
import {activeRoundId} from '../slack/invitations.mjs';
import {keyForRound} from '../slack/upstash-store.mjs';

export function verifyLotteryRequest(secret, headers, body, now=Date.now()) {
  const timestamp=headers['x-town-timestamp'], signature=headers['x-town-signature'];
  if (!secret || secret.length<32 || !/^\d{10}$/.test(timestamp||'') || Math.abs(now/1000-Number(timestamp))>300 || !/^[a-f0-9]{64}$/.test(signature||'')) return false;
  const expected=createHmac('sha256',secret).update(timestamp+'.'+body).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
const fail=code=>{throw Object.assign(new Error(code),{code});};
const digest=value=>createHash('sha256').update(value).digest('hex');

// The Sheet chooses pairs; the same Redis record as Town atomically books them.
export class LotteryBridge {
  constructor({social,channelId,slack,keyFor,members,allowSend=false,onChanged=()=>{},now=()=>new Date()}) {
    Object.assign(this,{social,channelId,slack,keyFor,members,allowSend,onChanged,now});
    this.shop=social.shop;
  }
  rootKey(roundId){return `donut-town:lottery:${this.channelId}:${roundId}`;}
  async records(roundId) {
    const raw=await this.shop.command(['GET',keyForRound(roundId,this.channelId)]);
    const data=raw?JSON.parse(raw):{};
    return {invitations:(Array.isArray(data.snapshots)?data.snapshots:[]).flatMap(s=>s.invitations||[]),lotteries:data.lotteries||{}};
  }
  async handle(body) {
    const now=this.now(),roundId=activeRoundId(now);
    if(body.channelId!==this.channelId)fail('wrong_channel');
    if(body.action==='status')return {ok:true,roundId,notificationsEnabled:this.allowSend,registered:JSON.parse(await this.shop.command(['GET',this.rootKey(roundId)]))};
    if(body.action==='notify')return {ok:true,notifications:await this.notify()};
    if(!/^\d{10}\.\d{6}$/.test(body.messageTs||''))fail('invalid_round');
    const rootKey=this.rootKey(roundId);
    if(body.action==='register') {
      const opened=new Date(Number(body.messageTs)*1000),closes=new Date(body.closesAt);
      // Town currently books by UTC week. Never silently bridge different weeks.
      if(!Number.isFinite(+closes)||+closes<=+opened||+opened>+now+300000||activeRoundId(opened)!==roundId||activeRoundId(closes)!==roundId)fail('invalid_round_window');
      const registration=JSON.stringify({messageTs:body.messageTs,closesAt:closes.toISOString()});
      await this.shop.command(['SET',rootKey,registration,'NX']);
      const stored=JSON.parse(await this.shop.command(['GET',rootKey]));
      if(stored.messageTs!==body.messageTs||stored.closesAt!==closes.toISOString())fail('round_conflict');
      return {ok:true,roundId};
    }
    const raw=await this.shop.command(['GET',rootKey]);
    if(!raw)fail('round_not_registered');
    const root=JSON.parse(raw);
    if(root.messageTs!==body.messageTs)fail('round_conflict');
    if(body.action==='pool') {
      const data=await this.records(roundId);
      return {ok:true,roundId,eligibleIds:(await this.members()).map(m=>m.id),bookedIds:[...new Set(data.invitations.filter(i=>!i.selfTest&&i.status==='accepted').flatMap(i=>[i.inviterId,i.inviteeId]))],committed:data.lotteries[body.messageTs]||null};
    }
    if(body.action!=='commit')fail('invalid_action');
    if(+now<new Date(root.closesAt).getTime())fail('signup_still_open');
    if(!Array.isArray(body.pairs)||body.pairs.length>100)fail('invalid_pairs');
    const members=new Set((await this.members()).map(m=>m.id)),seen=new Set();
    const pairs=body.pairs.map(pair=>{
      if(!Array.isArray(pair)||pair.length!==2)fail('invalid_pairs');
      for(const id of pair){if(!members.has(id)||seen.has(id))fail('invalid_pairs');seen.add(id);}
      return [...pair].sort();
    }).sort((a,b)=>a.join(':').localeCompare(b.join(':')));
    const leftover=body.leftover||null;
    if(leftover&&(!members.has(leftover)||seen.has(leftover)))fail('invalid_pairs');
    const signature=digest(JSON.stringify({pairs,leftover}));
    await this.social.invitation('lottery',{
      messageTs:body.messageTs,signature,members:pairs,leftover,
      pairs:pairs.map(([inviterId,inviteeId])=>({id:'lottery-'+digest(roundId+':'+body.messageTs+':'+inviterId+':'+inviteeId),inviterId,inviteeId,keys:[this.keyFor(inviterId),this.keyFor(inviteeId)]}))
    },roundId);
    this.onChanged();
    return {ok:true,roundId,pairs,leftover};
  }
  async notify() {
    if(!this.allowSend||!this.slack)fail('lottery_sending_disabled');
    const roundId=activeRoundId(this.now()),rootKey=this.rootKey(roundId);
    const raw=await this.shop.command(['GET',rootKey]);
    if(!raw)return {sent:0,pending:false};
    const {messageTs}=JSON.parse(raw),data=await this.records(roundId),jobs=[];
    for(const invitation of data.invitations) {
      if(invitation.status!=='accepted'||invitation.selfTest||invitation.source==='lottery')continue;
      jobs.push({id:invitation.id,text:`:doughnut: <@${invitation.inviterId}> + <@${invitation.inviteeId}> paired up in Donut Town! You each earned 5 donuts. You're all set for this week's chat and won't be included in the random pairing.`});
    }
    const batch=data.lotteries[messageTs];
    if(batch) {
      const pairs=Array.isArray(batch.pairs)?batch.pairs:[];
      jobs.push({id:'batch-'+messageTs,text:pairs.length
        ? `:doughnut: *The donuts are served!*\n${pairs.map(p=>`• <@${p[0]}> + <@${p[1]}>`).join('\n')}\nEach pair earned 5 donuts per person. Reach out to your partner to schedule a chat.${batch.leftover?`\n<@${batch.leftover}> is still available to find a partner in Town.`:''}`
        : `:doughnut: Random pairing is complete. No additional pairs this round.${batch.leftover?` <@${batch.leftover}> is still available to find a partner in Town.`:''}`});
    }
    let sent=0,pending=false;
    for(const job of jobs) {
      const noticeKey=rootKey+':notice:'+job.id;
      if(await this.shop.command(['GET',noticeKey+':sent']))continue;
      const token=randomUUID();
      if(!await this.shop.command(['SET',noticeKey,token,'NX','EX',120])){pending=true;continue;}
      try {
        await this.slack.postMessage(this.channelId,{text:job.text,thread_ts:messageTs,reply_broadcast:false});
        await this.shop.command(['SET',noticeKey+':sent','1']);sent++;
      } catch {pending=true;} finally {
        await this.shop.command(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,noticeKey,token]);
      }
    }
    return {sent,pending};
  }
}
