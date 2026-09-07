const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const errors={slack_login_required:'Open Town from Slack to see your chats.',member_not_found:'Your membership could not be verified.',chat_not_found:'That match is no longer available. Refresh your history.',chat_history_unavailable:'Chat history is unavailable. Try again.'};
const date=value=>new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

export function mountProfileChats(root) {
  let state=null,busy=false,limit=5,friendLimit=3;
  const status=root.querySelector('[data-chats="status"]');
  const list=root.querySelector('[data-chats="history"]');
  const friends=root.querySelector('[data-chats="friends"]');
  const more=root.querySelector('[data-chats="more"]');
  const moreFriends=root.querySelector('[data-chats="more-friends"]');
  const retry=root.querySelector('[data-chats="retry"]');
  const avatar=person=>person.avatarUrl?.startsWith('https://')?`<img src="${escapeHtml(person.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span aria-hidden="true">${escapeHtml(person.name.slice(0,1))}</span>`;
  async function request(url,body) {
    const response=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw Error(errors[data.error]||'Could not update your chats. Try again.');return data;
  }
  function render() {
    root.querySelector('[data-chats="completed"]').textContent=state.completed;
    root.querySelector('[data-chats="connections"]').textContent=state.connections;
    root.querySelector('[data-chats="connections-label"]').textContent=state.connections===1?'connection':'connections';
    friends.innerHTML=state.friends.slice(0,friendLimit).map(friend=>`<li><div class="chat-avatar">${avatar(friend.partner)}</div><div class="chat-copy"><strong>${escapeHtml(friend.partner.name)}</strong><small>${friend.chats} confirmed ${friend.chats===1?'chat':'chats'}</small></div><strong class="friendship-score" aria-label="${friend.score} friendship points">${friend.score} <span aria-hidden="true">♥</span></strong></li>`).join('')||'<li class="chat-empty">Your first confirmed chat starts a friendship.</li>';
    list.innerHTML=state.history.slice(0,limit).map(chat=>`<li><div class="chat-avatar">${avatar(chat.partner)}</div><div class="chat-copy"><strong>${escapeHtml(chat.partner.name)}</strong><small>${chat.completedAt?'Confirmed':'Matched'} ${date(chat.completedAt||chat.matchedAt)}${chat.status==='completed'?'':chat.status==='waiting'?' · Waiting for partner':chat.partnerConfirmed?' · Partner confirmed':''}</small></div>${chat.status==='completed'?'<span class="chat-complete">+10 ♥</span>':`<button type="button" data-confirm="${escapeHtml(chat.id)}" aria-label="Confirm chat with ${escapeHtml(chat.partner.name)} on ${date(chat.matchedAt)}" ${busy||chat.status==='waiting'?'disabled':''}>${chat.status==='waiting'?'Confirmed':'We chatted'}</button>`}</li>`).join('')||'<li class="chat-empty">No Town matches recorded yet.</li>';
    more.hidden=limit>=state.history.length;more.disabled=busy;
    moreFriends.hidden=friendLimit>=state.friends.length;
    root.querySelector('[data-chats="older"]').hidden=!state.hasOlder;
    list.querySelectorAll('[data-confirm]').forEach(button=>button.onclick=()=>confirm(button.dataset.confirm));
  }
  async function load() {
    if(busy)return;
    busy=true;retry.disabled=true;status.textContent='Loading your chats…';
    if(state)render();
    try{state=await request('/api/profile/chats');status.textContent='';}
    catch(error){status.textContent=error.message;}
    finally{busy=false;retry.disabled=false;if(state)render();}
  }
  async function confirm(chatId) {
    if(busy)return;
    busy=true;retry.disabled=true;status.textContent='Saving confirmation…';render();
    try{state=await request('/api/profile/chats/confirm',{chatId});status.textContent=state.history.find(chat=>chat.id===chatId)?.status==='completed'?'Both confirmed. +10 friendship.':'Confirmed. Waiting for your partner.';}
    catch(error){status.textContent=error.message;}
    finally{busy=false;retry.disabled=false;render();}
  }
  more.onclick=()=>{limit+=10;render()};
  moreFriends.onclick=()=>{friendLimit+=10;render()};
  retry.onclick=load;
  return {load};
}
