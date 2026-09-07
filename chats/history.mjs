import { createHash } from 'node:crypto';
import { activeRoundId } from '../slack/invitations.mjs';

export const FRIENDSHIP_POINTS = 10;
export const HISTORY_WEEKS = 52;
const keyPattern = /^[a-f0-9]{64}$/;

export function recentRounds(now = new Date()) {
  return Array.from({length:HISTORY_WEEKS},(_,i)=>activeRoundId(new Date(now.getTime()-i*7*86400000)));
}

export function townChats(rounds, keyFor) {
  const chats=new Map();
  for(const round of rounds) {
    if(!/^week:\d{4}-\d{2}-\d{2}$/.test(round.roundId||''))continue;
    for(const snapshot of round.snapshots || [])for(const invite of snapshot.invitations || []) {
      if(invite.selfTest || invite.status!=='accepted' || invite.inviterId!==snapshot.inviterId || !/^[UW][A-Z0-9]+$/.test(invite.inviterId||'') || !/^[UW][A-Z0-9]+$/.test(invite.inviteeId||'') || invite.inviterId===invite.inviteeId)continue;
      const members=[keyFor(invite.inviterId),keyFor(invite.inviteeId)].sort();
      if(!members.every(key=>keyPattern.test(key)))throw new Error('invalid_member_key');
      const date=Date.parse(invite.answeredAt || invite.createdAt);
      if(!Number.isFinite(date))continue;
      // One pair per round, even if imported twice or invited in both directions.
      const id=createHash('sha256').update(`donut-chat:v1:${round.roundId}:${members.join(':')}`).digest('hex');
      const record={id,members,roundId:round.roundId,matchedAt:new Date(date).toISOString(),confirmations:{},completedAt:null};
      if(!chats.has(id)||record.matchedAt<chats.get(id).matchedAt)chats.set(id,record);
    }
  }
  return [...chats.values()];
}

export function chatProfile({memberKey,members,keyFor,matches,stored,friendships,hasOlder}) {
  const directory=new Map(members.map(member=>[keyFor(member.id),{key:keyFor(member.id),name:member.displayName,avatarUrl:member.avatarUrl||''}]));
  const partner=key=>directory.get(key)||{key,name:'Former member',avatarUrl:''};
  const records=new Map(matches.filter(item=>item.members.includes(memberKey)).map(item=>[item.id,item]));
  for(const item of stored)if(item.members.includes(memberKey))records.set(item.id,item);
  const history=[...records.values()].sort((a,b)=>(b.completedAt||b.matchedAt).localeCompare(a.completedAt||a.matchedAt)).map(item=>({
    id:item.id,partner:partner(item.members.find(key=>key!==memberKey)),matchedAt:item.matchedAt,completedAt:item.completedAt,
    status:item.completedAt?'completed':item.confirmations[memberKey]?'waiting': 'matched',
    partnerConfirmed:Boolean(item.confirmations[item.members.find(key=>key!==memberKey)])
  }));
  const friends=Object.entries(friendships).filter(([key,count])=>keyPattern.test(key)&&Number.isSafeInteger(count)&&count>0).map(([key,count])=>({partner:partner(key),chats:count,score:count*FRIENDSHIP_POINTS})).sort((a,b)=>b.score-a.score||a.partner.name.localeCompare(b.partner.name));
  return {history,friends,completed:friends.reduce((sum,item)=>sum+item.chats,0),connections:friends.length,pointsPerChat:FRIENDSHIP_POINTS,hasOlder,coverage:{matchedWeeks:HISTORY_WEEKS,lotteryConnected:false}};
}
