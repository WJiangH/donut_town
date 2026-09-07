const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const words={not_enough_donuts:'Not enough donuts.',try_again_later:'Already sent. Reactions refresh after 24 hours.',invalid_amount:'Choose 1–999 donuts.',invalid_message:'Write 1–1,000 characters.',slack_login_required:'Open Town from Slack to continue.',member_not_found:'This neighbor is no longer available.',social_unavailable:'Could not connect. Try again.',request_conflict:'This request changed. Reopen and try again.'};
async function request(url,body){const r=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(words[d.error]||'Could not save. Try again.');return d;}
const date=at=>new Date(at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const face=p=>`<span class="social-avatar">${p.avatar?.startsWith('https://')?`<img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:esc(p.name?.slice(0,1)||'?')}</span>`;
function replace(el,html){if(el.innerHTML!==html)el.innerHTML=html;}
const reaction={kudos:'★ Sent Kudos',flower:'✿ Left flowers',heart:'♥ Sent a heart',donut:'◉ Gifted'};

export function mountHomeSocial(root,{onVisit=()=>{}}={}){
 const visitors=root.querySelector('[data-social="visitors"]'),notes=root.querySelector('[data-social="notes"]'),form=root.querySelector('[data-social="note-form"]'),gifts=root.querySelector('[data-social="gifts"]'),status=root.querySelector('[data-social="status"]');
 let owner=null,self=null,epoch=0,busy=false,balance=0,pending=null;
 const person=p=>p.key?`<button class="social-person" data-visit="${esc(p.key)}">${face(p)}<strong>${esc(p.name)}</strong></button>`:`<span class="social-person">${face(p)}${esc(p.name)}</span>`;
 async function refresh(version=epoch){
  if(!owner||root.hidden)return;
  try{const data=await request(`/api/social?home=${owner}`);if(version!==epoch)return;
   self=data.self;balance=data.wallet.balance;window.dispatchEvent(new CustomEvent('town-wallet',{detail:data.wallet}));
   root.querySelector('[data-social="balance"]').textContent=balance;
   form.hidden=gifts.hidden=self===owner;
   gifts.querySelector('[data-kind="donut"]').disabled=busy||balance<1;
   replace(visitors,data.visitors.map(v=>`<li>${person(v.sender)}<small>${esc(date(v.at))}</small></li>`).join('')||'<li class="social-empty">The door is open. Your first visitor is on the way.</li>');
   replace(notes,data.notes.map(n=>`<li>${person(n.sender)}<p>${n.kind==='note'?esc(n.text):`${reaction[n.kind]||''}${n.kind==='donut'?` ${n.amount} donuts`:''}`}</p><small>${esc(date(n.at))}</small></li>`).join('')||'<li class="social-empty">A little note can make someone’s day.</li>');
  }catch(error){if(version===epoch)status.textContent=error.message;}
 }
 async function send(body){
  if(busy||!owner||self===owner)return;
  const version=epoch,target=owner,signature=JSON.stringify(body);busy=true;
  if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID()};
  status.textContent='Sending…';form.querySelector('button').disabled=true;form.elements.text.disabled=true;gifts.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await request('/api/social',{...body,home:target,id:pending.id});if(version!==epoch)return;pending=null;status.textContent='Sent.';if(body.kind==='note')form.reset();await refresh(version);}
  catch(error){if(version===epoch)status.textContent=error.message;}
  finally{busy=false;if(version===epoch){form.querySelector('button').disabled=false;form.elements.text.disabled=false;gifts.querySelectorAll('button').forEach(b=>b.disabled=b.dataset.kind==='donut'&&balance<1);}}
 }
 form.onsubmit=e=>{e.preventDefault();void send({kind:'note',text:form.elements.text.value});};
 gifts.onclick=e=>{const b=e.target.closest('[data-kind]');if(b)void send({kind:b.dataset.kind,...(b.dataset.kind==='donut'?{amount:Number(gifts.querySelector('input').value)}:{})});};
 root.querySelectorAll('.home-social').forEach(panel=>panel.onclick=e=>{const b=e.target.closest('[data-visit]');if(b&&!busy)onVisit(b.dataset.visit);});
 // Only the small social feed polls; never reload room art, layout or character.
 setInterval(()=>{if(!document.hidden&&!root.hidden&&!busy)void refresh();},20000);
 return {load(key){owner=key;self=null;epoch++;pending=null;status.textContent='';form.reset();form.querySelector('button').disabled=false;form.elements.text.disabled=false;gifts.querySelectorAll('button').forEach(b=>b.disabled=false);form.hidden=gifts.hidden=true;visitors.innerHTML=notes.innerHTML='<li class="social-empty">Opening guestbook…</li>';void refresh();},pause(){epoch++;owner=null;}};
}

export function mountMessages(root){
 const list=root.querySelector('[data-messages="list"]'),title=root.querySelector('h2'),form=root.querySelector('form'),status=root.querySelector('[role="status"]');
 let peer=null,self=null,epoch=0,busy=false,pending=null,returnFocus=null;
 function close(){root.hidden=true;epoch++;returnFocus?.focus();}
 root.querySelector('[data-messages="close"]').onclick=close;
 root.querySelector('[data-messages="back"]').onclick=()=>open();
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 async function refresh(version=epoch){
  try{const data=await request('/api/messages'+(peer?`?peer=${peer}`:''));if(version!==epoch)return;self=data.self;
   title.textContent=data.peer?data.peer.name:'Messages';
   const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<60;
   const html=peer?data.messages.map(m=>`<li class="message-bubble ${m.from===self?'mine':''}"><p>${esc(m.text)}</p><small>${esc(date(m.at))}</small></li>`).join(''):data.messages.map(m=>{const other=m.from===self?m.recipient:m.sender;return `<li><button class="message-thread" data-peer="${esc(other.key||'')}">${face(other)}<span><strong>${esc(other.name)}</strong><small>${esc(m.text.slice(0,80))}</small></span></button></li>`;}).join('');
   const changed=list.innerHTML!==html;replace(list,html||`<li class="social-empty">${peer?'Say hello.':'Choose a neighbor’s profile to start a conversation.'}</li>`);if(peer&&bottom&&changed)list.scrollTop=list.scrollHeight;
  }catch(error){if(version===epoch)status.textContent=error.message;}
 }
 function open(key=null){if(busy)return;returnFocus=root.hidden?document.activeElement:returnFocus;peer=typeof key==='string'?key:null;epoch++;pending=null;root.hidden=false;form.hidden=!peer;form.reset();status.textContent='';title.textContent=peer?'Conversation':'Messages';list.innerHTML='';root.querySelector('[data-messages="back"]').hidden=!peer;void refresh();root.querySelector(peer?'textarea':'[data-messages="close"]').focus();}
 list.onclick=e=>{const b=e.target.closest('[data-peer]');if(b?.dataset.peer)open(b.dataset.peer);};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!peer)return;busy=true;const version=epoch,target=peer,text=form.elements.text.value.trim();
  if(!pending||pending.text!==text)pending={text,id:crypto.randomUUID()};
  form.querySelector('button').disabled=true;form.elements.text.disabled=true;status.textContent='Sending…';
  try{await request('/api/messages',{peer:target,text,id:pending.id});if(version!==epoch)return;pending=null;form.reset();status.textContent='';await refresh(version);list.scrollTop=list.scrollHeight;}
  catch(error){if(version===epoch)status.textContent=error.message;}
  finally{busy=false;form.querySelector('button').disabled=false;form.elements.text.disabled=false;}
 };
 setInterval(()=>{if(!root.hidden&&!document.hidden&&!busy)void refresh();},5000);
 return {open,close};
}
