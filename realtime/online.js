// Presence is workspace-wide; theme/room filtering only applies to map sprites.
(function(){
 class OnlineRoster {
  constructor(){this.ready=false;this.members=new Map();}
  reset(){this.ready=false;this.members.clear();}
  receive(message){
   if(message.type==='snapshot'){
    this.ready=true;this.members=new Map((message.players||[]).filter(p=>p?.userId).map(p=>[p.userId,p]));return true;
   }
   if(message.type==='leave')return this.members.delete(message.userId);
   if(message.type!=='state'||!message.userId)return false;
   const previous=this.members.get(message.userId);
   this.members.set(message.userId,message);
   return !previous||previous.scene!==message.scene||previous.inHome!==message.inHome;
  }
  status(id){
   if(!this.ready)return {state:'unknown',label:'Status unavailable'};
   const member=this.members.get(id);
   if(!member)return {state:'offline',label:'Away / offline'};
   const place=member.inHome?'Home':({town:'Town',chemPod:'Chem Pod',donutShop:'Shop',donutFactory:'Factory'}[member.scene]||'Town');
   return {state:'online',label:`Online · ${place}`};
  }
 }
 window.OnlineRoster=OnlineRoster;
})();
