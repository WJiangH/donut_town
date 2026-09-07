import { recentRounds, townChats, chatProfile } from './history.mjs';

export class ChatService {
  constructor({invitationStore,store,keyFor,currentRound}) {
    Object.assign(this,{invitationStore,store,keyFor,currentRound});
    this.cached=null;this.expires=0;this.loading=null;
  }
  async matches() {
    if(!this.cached||Date.now()>=this.expires) {
      if(!this.loading)this.loading=this.invitationStore.loadRecent(recentRounds()).then(rounds=>{this.cached=rounds;this.expires=Date.now()+60000}).finally(()=>{this.loading=null});
      await this.loading;
    }
    return townChats([...this.cached,this.currentRound()],this.keyFor);
  }
  async data(userId,members){
    if(!members.some(member=>member.id===userId))throw new Error('member_not_found');
    const memberKey=this.keyFor(userId);
    const [matches,saved]=await Promise.all([this.matches(),this.store.list(memberKey)]);
    return {memberKey,matches,...saved};
  }
  async profile(userId,members){
    const data=await this.data(userId,members);
    return chatProfile({...data,stored:data.records,members,keyFor:this.keyFor});
  }
  async confirm(userId,chatId,members){
    const data=await this.data(userId,members);
    const record=[...data.records,...data.matches].find(item=>item.id===chatId&&item.members.includes(data.memberKey));
    if(!record)throw new Error('chat_not_found');
    await this.store.confirm(record,data.memberKey);
    return this.profile(userId,members);
  }
}
