const KEY=/^[a-f0-9]{64}$/;
export const CONFIRM_CHAT = `
local raw = redis.call('GET', KEYS[1])
local entry = raw and cjson.decode(raw) or cjson.decode(ARGV[1])
local actor = ARGV[2]
if actor ~= entry.members[1] and actor ~= entry.members[2] then return redis.error_reply('chat_not_found') end
entry.confirmations = entry.confirmations or {}
if not entry.confirmations[actor] then entry.confirmations[actor] = ARGV[3] end
if not entry.completedAt or entry.completedAt == cjson.null then
  if entry.confirmations[entry.members[1]] and entry.confirmations[entry.members[2]] then
    entry.completedAt = ARGV[3]
    redis.call('HINCRBY', KEYS[4], entry.members[2], 1)
    redis.call('HINCRBY', KEYS[5], entry.members[1], 1)
  end
end
local result = cjson.encode(entry)
redis.call('SET', KEYS[1], result)
redis.call('ZADD', KEYS[2], ARGV[4], entry.id)
redis.call('ZADD', KEYS[3], ARGV[4], entry.id)
return result
`;

export class ChatStore {
  constructor({url='',token='',namespace='',fetchImpl=fetch}={}) {
    this.url=url;this.token=token;this.fetch=fetchImpl;
    if(namespace&&!/^C[A-Z0-9]+$/.test(namespace))throw new Error('invalid_namespace');
    this.prefix=`donut-town:chats:v1:${namespace || 'default'}:`;
  }
  get configured(){return Boolean(this.url&&this.token)}
  key(value){if(!KEY.test(value||''))throw new Error('invalid_member_key');return value}
  async command(args){
    if(!this.configured)throw new Error('chat_history_unavailable');
    const response=await this.fetch(this.url,{method:'POST',headers:{authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('chat_history_unavailable');
    const data=await response.json();if(data.error)throw new Error('chat_history_unavailable');return data.result;
  }
  async list(memberKey){
    this.key(memberKey);
    const [ids,counts]=await Promise.all([
      this.command(['ZREVRANGE',this.prefix+'member:'+memberKey,0,50]),
      this.command(['HGETALL',this.prefix+'friends:'+memberKey])
    ]);
    const rows=ids.length?await this.command(['MGET',...ids.slice(0,50).map(id=>this.prefix+'record:'+this.key(id))]):[];
    const records=rows.filter(Boolean).map(raw=>JSON.parse(raw)).filter(item=>item.members?.includes(memberKey));
    const friendships={};for(let i=0;i<counts.length;i+=2)friendships[counts[i]]=Number(counts[i+1]);
    return {records,friendships,hasOlder:ids.length>50};
  }
  async confirm(record,memberKey,now=new Date()) {
    this.key(memberKey);this.key(record.id);
    if(record.members?.length!==2||!record.members.includes(memberKey)||record.members[0]===record.members[1])throw new Error('chat_not_found');
    const keys=record.members.map(key=>this.key(key));
    const result=await this.command(['EVAL',CONFIRM_CHAT,5,this.prefix+'record:'+record.id,
      ...keys.map(key=>this.prefix+'member:'+key),...keys.map(key=>this.prefix+'friends:'+key),
      JSON.stringify(record),memberKey,now.toISOString(),Date.parse(record.matchedAt)]);
    return JSON.parse(result);
  }
}
