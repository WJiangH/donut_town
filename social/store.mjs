import { keyForRound } from '../slack/upstash-store.mjs';

const INVITATION = `
local raw=redis.call('GET',KEYS[1])
local data=raw and cjson.decode(raw) or {version=1,roundId=ARGV[2],snapshots={}}
local action=ARGV[1]
local input=cjson.decode(ARGV[3])
local target=nil
for _,snap in ipairs(data.snapshots) do
 for _,inv in ipairs(snap.invitations) do if inv.id==input.id then target=inv end end
end
if action=='lottery' then
 data.lotteries=data.lotteries or {}
 local prior=data.lotteries[input.messageTs]
 if prior then
  if prior.signature~=input.signature then return redis.error_reply('lottery_already_committed') end
  return cjson.encode({snapshots=data.snapshots,changed=false})
 end
 local selected={}
 for _,pair in ipairs(input.pairs) do selected[pair.inviterId]=true;selected[pair.inviteeId]=true end
 for _,snap in ipairs(data.snapshots) do for _,inv in ipairs(snap.invitations) do
  if inv.status=='accepted' and (selected[inv.inviterId] or selected[inv.inviteeId] or inv.inviterId==input.leftover or inv.inviteeId==input.leftover) then return redis.error_reply('already_booked') end
 end end
 -- Validate and encode every wallet before writing any; Lua errors do not roll back Redis writes.
 local purses={}
 for _,pair in ipairs(input.pairs) do
  for _,key in ipairs(pair.keys) do
   local raw=redis.call('HGET',KEYS[2],key)
   local purse=raw and cjson.decode(raw) or {owned={}}
   purse.credits=(purse.credits or 0)+5
   table.insert(purses,{key=key,value=cjson.encode(purse)})
  end
  local own=nil
  for _,snap in ipairs(data.snapshots) do if snap.inviterId==pair.inviterId then own=snap end end
  if not own then own={version=1,roundId=ARGV[2],inviterId=pair.inviterId,invitations={}};table.insert(data.snapshots,own) end
  table.insert(own.invitations,{id=pair.id,inviterId=pair.inviterId,inviteeId=pair.inviteeId,priority=1,status='accepted',source='lottery',createdAt=ARGV[6],answeredAt=ARGV[6]})
 end
 for _,snap in ipairs(data.snapshots) do for _,inv in ipairs(snap.invitations) do
  if inv.status=='pending' and (selected[inv.inviterId] or selected[inv.inviteeId]) then inv.status='cancelled';inv.answeredAt=ARGV[6] end
 end end
 data.lotteries[input.messageTs]={signature=input.signature,pairs=input.members,leftover=input.leftover,at=ARGV[6]}
 for _,entry in ipairs(purses) do redis.call('HSET',KEYS[2],entry.key,entry.value) end
elseif action=='add' then
 if target then return cjson.encode(data) end
 local pending=0
 for _,snap in ipairs(data.snapshots) do for _,inv in ipairs(snap.invitations) do
  if inv.status=='accepted' and (inv.inviterId==input.inviterId or inv.inviteeId==input.inviterId or inv.inviterId==input.inviteeId or inv.inviteeId==input.inviteeId) then return redis.error_reply('already_booked') end
  if inv.status=='pending' and inv.inviterId==input.inviterId then
   pending=pending+1
   if inv.inviteeId==input.inviteeId then return redis.error_reply('invitation_already_pending') end
  end
 end end
 if pending>=3 then return redis.error_reply('pending_invitation_limit') end
 local own=nil
 for _,snap in ipairs(data.snapshots) do if snap.inviterId==input.inviterId then own=snap end end
 if not own then own={version=1,roundId=ARGV[2],inviterId=input.inviterId,invitations={}};table.insert(data.snapshots,own) end
 table.insert(own.invitations,input)
elseif action=='delivery' then
 if target then target.messageChannel=input.messageChannel;target.messageTs=input.messageTs end
elseif action=='remove' then
 if target and target.status=='pending' then target.status='cancelled' end
else
 if not target or target.inviteeId~=input.responder or target.inviterId~=input.inviter then return redis.error_reply('invitation_not_active') end
 if target.status==input.status then return cjson.encode({snapshots=data.snapshots,changed=false}) end
 if target.status~='pending' then return redis.error_reply('invitation_not_active') end
 if input.status=='accepted' then
  for _,snap in ipairs(data.snapshots) do for _,inv in ipairs(snap.invitations) do
   if inv.status=='accepted' and (inv.inviterId==target.inviterId or inv.inviteeId==target.inviterId or inv.inviterId==target.inviteeId or inv.inviteeId==target.inviteeId) then return redis.error_reply('already_booked') end
  end end
  local purses={}
  for _,key in ipairs({ARGV[4],ARGV[5]}) do
   local p=redis.call('HGET',KEYS[2],key)
   p=p and cjson.decode(p) or {owned={}}
   p.credits=(p.credits or 0)+5
   table.insert(purses,{key=key,value=cjson.encode(p)})
  end
  for _,entry in ipairs(purses) do redis.call('HSET',KEYS[2],entry.key,entry.value) end
  for _,snap in ipairs(data.snapshots) do for _,inv in ipairs(snap.invitations) do
   if inv.status=='pending' and inv.id~=target.id and (inv.inviterId==target.inviterId or inv.inviteeId==target.inviterId or inv.inviterId==target.inviteeId or inv.inviteeId==target.inviteeId) then inv.status='cancelled' end
  end end
 end
 target.status=input.status;target.answeredAt=ARGV[6]
end
data.savedAt=ARGV[6]
local result=cjson.encode(data)
result=string.gsub(result,'"snapshots":{}','"snapshots":[]')
redis.call('SET',KEYS[1],result)
return cjson.encode({snapshots=data.snapshots,changed=true})
`;

const EVENT = `
local old=redis.call('GET',KEYS[2])
if old then
 local prior=cjson.decode(old)
 if prior.signature~=ARGV[2] then return redis.error_reply('request_conflict') end
 return old
end
local e=cjson.decode(ARGV[1])
if e.kind=='donut' then
 local from=redis.call('HGET',KEYS[1],e.from)
 from=from and cjson.decode(from) or {owned={}}
 local to=redis.call('HGET',KEYS[1],e.to)
 to=to and cjson.decode(to) or {owned={}}
 local spent=from.gifted or 0
 for _,item in ipairs(from.owned or {}) do spent=spent+(item.price or 0) end
 if spent+e.amount>tonumber(ARGV[3])+(from.credits or 0) then return redis.error_reply('not_enough_donuts') end
 from.gifted=(from.gifted or 0)+e.amount;to.credits=(to.credits or 0)+e.amount
 redis.call('HSET',KEYS[1],e.from,cjson.encode(from),e.to,cjson.encode(to))
else
 if redis.call('EXISTS',KEYS[4])==1 then return redis.error_reply('try_again_later') end
 redis.call('SET',KEYS[4],'1','EX',ARGV[4])
end
local result=cjson.encode({signature=ARGV[2],event=e})
redis.call('SET',KEYS[2],result)
if e.kind~='donut' then redis.call('EXPIRE',KEYS[2],604800) end
redis.call('LPUSH',KEYS[3],cjson.encode(e));redis.call('LTRIM',KEYS[3],0,99)
if e.kind=='message' then
 redis.call('HSET',KEYS[5],e.to,cjson.encode(e))
 redis.call('HSET',KEYS[6],e.from,cjson.encode(e))
end
return result
`;

export function socialInput(body, {self, peer, messaging=false}) {
 if (!body || typeof body!=='object' || Array.isArray(body) || !/^[a-f0-9-]{20,64}$/.test(body.id||'')) throw Error('invalid_interaction');
 if(self===peer) throw Error('choose_a_neighbor');
 const kind=messaging?'message':body.kind;
 if(!['message','note','kudos','flower','heart','donut'].includes(kind) || (!messaging&&kind==='message')) throw Error('invalid_interaction');
 const text=typeof body.text==='string'?body.text.trim():'';
 if(['message','note'].includes(kind) && (!text||text.length>1000)) throw Error('invalid_message');
 if(kind==='donut' && (!Number.isSafeInteger(body.amount)||body.amount<1||body.amount>999)) throw Error('invalid_amount');
 return {id:body.id,kind,from:self,to:peer,text:['message','note'].includes(kind)?text:'',amount:kind==='donut'?body.amount:0,at:new Date().toISOString()};
}

// Reuse the existing Redis transport and wallet hash; Lua keeps gifts and purchases atomic.
export class SocialStore {
 constructor(shop,namespace=''){this.shop=shop;this.prefix=`donut-town:social:${namespace}`;this.namespace=namespace;}
 async invitation(action,input,roundId,keys=[]) {
  const raw=await this.shop.command(['EVAL',INVITATION,2,keyForRound(roundId,this.namespace),this.shop.key,action,roundId,JSON.stringify(input),keys[0]||'',keys[1]||'',new Date().toISOString()]);
  const data=JSON.parse(raw);
  // Redis cjson represents an empty list as {}; snapshots are nonempty after add.
  const snapshots=Array.isArray(data.snapshots)?data.snapshots:[];snapshots.changed=data.changed===true;return snapshots;
 }
 async home(key){
  const [notes,visitors]=await Promise.all([
   this.shop.command(['LRANGE',`${this.prefix}:home:${key}`,0,99]),
   this.shop.command(['HGETALL',`${this.prefix}:visitors:${key}`])
  ]);
  return {notes:notes.map(JSON.parse),visitors:visitors.filter((_,i)=>i%2===1).map(JSON.parse).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30)};
 }
 async visit(key,self){
  if(key!==self)await this.shop.command(['HSET',`${this.prefix}:visitors:${key}`,self,JSON.stringify({from:self,at:new Date().toISOString()})]);
 }
 async event(event,earned=0){
  const {from,to,kind,id}=event;
  const thread=[from,to].sort().join(':');
  const signature=JSON.stringify({...event,at:null});
  const reaction=['kudos','flower','heart'].includes(kind);
  const raw=await this.shop.command(['EVAL',EVENT,6,this.shop.key,`${this.prefix}:request:${from}:${id}`,kind==='message'?`${this.prefix}:dm:${thread}`:`${this.prefix}:home:${to}`,`${this.prefix}:limit:${from}:${to}:${kind}`,`${this.prefix}:inbox:${from}`,`${this.prefix}:inbox:${to}`,JSON.stringify(event),signature,earned,reaction?86400:3]);
  return JSON.parse(raw).event;
 }
 async messages(self,peer){
  if(peer)return (await this.shop.command(['LRANGE',`${this.prefix}:dm:${[self,peer].sort().join(':')}`,0,99])).map(JSON.parse).reverse();
  const rows=await this.shop.command(['HGETALL',`${this.prefix}:inbox:${self}`]);
  return rows.filter((_,i)=>i%2===1).map(JSON.parse).sort((a,b)=>b.at.localeCompare(a.at));
 }
}
