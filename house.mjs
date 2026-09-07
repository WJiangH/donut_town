import { mountHomeSocial } from './social-client.mjs';
import { itemArt, itemSprite } from './shop/item-art.mjs';
import { decorationLuxury, houseLuxury, LUXURY_TIERS } from './house/luxury.mjs';
import { homeNavigation } from './house/navigation.mjs';
const MESSAGES = {
  slack_login_required: 'Open the town from Slack to visit your home.',
  member_not_found: 'Only channel members have a home.',
  house_store_unavailable: 'Home storage is unavailable.',
  house_save_failed: 'Not saved. Try again.',
  invalid_layout: 'That spot will not take it.'
};
const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function mountHouse(root, {paintCharacter = null, onMove = () => {}, onVisit = () => {}} = {}) {
  const floor=root.querySelector('[data-house="floor"]'), shelf=root.querySelector('[data-house="shelf"]'), status=root.querySelector('[data-house="status"]');
  const social=mountHomeSocial(root,{onVisit});
  let canDecorate=false, loadVersion=0;
  const grid={cols:14,rows:9};
  let furniture=new Map(), layout=[], owned=[], selected=null, dragging=null, timer=null, saving=null, revision=0, savedRevision=0, loaded=false;
  const resident=root.querySelector('[data-house="resident"]');
  const roomSelect=root.querySelector('[data-house="room"]'), roomArt=root.querySelector('.room-art');
  let rooms=[], roomId='room-cottage', roomRequest=0;
  async function applyRoom(id) {
    const room=rooms.find(item=>item.id===id);if(!room)return false;
    const request=++roomRequest;
    const image=new Image();image.src=room.art;
    await image.decode();
    if(request!==roomRequest)return false;
    roomArt.src=room.art;root.dataset.room=id;roomId=id;roomSelect.value=id;return true;
  }
  roomSelect.onchange=async()=>{
    const chosen=roomSelect.value;roomSelect.disabled=true;
    try{if(await applyRoom(chosen))changed();}
    catch{roomSelect.value=roomId;status.textContent='Room could not load. Try again.';}
    finally{roomSelect.disabled=false;}
  };
  const roomBackdrop=new ResizeObserver(()=>{
    const room=root.querySelector('.house-room').getBoundingClientRect();
    if(room.width){root.style.setProperty('--home-figure',Math.max(.2,Math.min(1.6,room.width/1100)));}
  });
  roomBackdrop.observe(root.querySelector('.house-room'));roomBackdrop.observe(root.querySelector('.house-viewport'));
  const keys=new Set();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let decorating=false, position={x:7.5,y:8.5}, route=[], direction='down', animation=null, lastTime=0, painted='';
  let navigation=homeNavigation(grid,layout,furniture);
  const placed=id=>layout.find(item=>item.id===id);
  const size=id=>furniture.get(id)?.footprint || {w:1,h:1};
  function valid(id,x,y) {
    const {w,h}=size(id);
    return owned.includes(id) && furniture.has(id) && x>=0 && y>=0 && x+w<=grid.cols && y+h<=grid.rows && !layout.some(other=>{
      if(other.id===id)return false;const s=size(other.id);
      return x<other.x+s.w && x+w>other.x && y<other.y+s.h && y+h>other.y;
    });
  }
  function tile(item,entry) {
    const {w,h}=size(item.id);
    const style=entry?`left:${entry.x/grid.cols*100}%;top:${entry.y/grid.rows*100}%;width:${w/grid.cols*100}%;height:${h/grid.rows*100}%;z-index:${item.id.endsWith('-rug')?0:Math.round((entry.y+h)*10)};`:'';
    const art=entry?itemSprite(item):`<img src="${escapeHtml(itemArt(item,true))}" alt="" loading="lazy" decoding="async" draggable="false">`;
    return `<button class="house-tile${selected===item.id?' selected':''}" data-item="${escapeHtml(item.id)}" style="${style}" title="${escapeHtml(item.name)} · +${decorationLuxury(item)} Luxury" aria-label="${escapeHtml(item.name)}" aria-pressed="${selected===item.id}">${art}</button>`;
  }
  function render() {
    const focus=document.activeElement?.dataset.item;
    floor.style.setProperty('--cols',grid.cols);floor.style.setProperty('--rows',grid.rows);
    floor.innerHTML=layout.map(entry=>furniture.has(entry.id)?tile(furniture.get(entry.id),entry):'').join('')+'<span class="house-target" hidden></span>';
    floor.append(resident);
    navigation=homeNavigation(grid,layout,furniture);
    if(navigation.blocked(position.x,position.y))position=navigation.nearest(position)||position;
    route=[];painted='';paintResident(false,0);
    shelf.innerHTML=owned.filter(id=>furniture.has(id)&&!placed(id)).map(id=>tile(furniture.get(id))).join('') || '<p class="house-empty">All placed. Find more in the shop.</p>';
    const selectedItem=furniture.get(selected);
    root.querySelector('[data-house="selected"]').textContent=selectedItem ? `${selectedItem.name} · +${decorationLuxury(selectedItem)} Luxury` : 'Select a decoration';
    root.querySelector('[data-house="remove"]').disabled=!placed(selected);
    renderLuxury();
    if(focus)root.querySelector(`[data-item="${focus}"]`)?.focus({preventScroll:true});
  }
  function renderLuxury() {
    const luxury=houseLuxury({items:layout},{catalog:{items:[...furniture.values()]},ownedIds:owned});
    root.querySelector('[data-house="luxury-score"]').textContent=luxury.score;
    root.querySelector('[data-house="luxury-tier"]').textContent=luxury.tier.name;
    root.querySelector('[data-house="luxury-next"]').textContent=luxury.nextTier ? `${luxury.remaining} to ${luxury.nextTier.name}` : 'Top tier';
    const progress=root.querySelector('[data-house="luxury-progress"]');
    progress.value=luxury.progress;
    progress.setAttribute('aria-valuetext',`${luxury.score} Luxury, ${luxury.tier.name}${luxury.nextTier ? `, ${luxury.remaining} to ${luxury.nextTier.name}` : ', top tier'}`);
    root.querySelector('[data-house="luxury-tiers"]').innerHTML=LUXURY_TIERS.map(tier=>`<li${tier===luxury.tier?' aria-current="step"':''}><b>${tier.name}</b><span>${tier.min}+</span></li>`).join('');
  }
  async function flush() {
    clearTimeout(timer);
    if(saving)return saving;
    if(savedRevision===revision)return true;
    saving=(async()=>{
      while(savedRevision!==revision){
        const version=revision, snapshot={roomId,items:layout.map(item=>({...item}))};
        status.textContent='Saving…';
        try{
          const response=await fetch('/api/house',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({layout:snapshot}),signal:AbortSignal.timeout(20000)});
          const data=await response.json();if(!response.ok)throw Error(MESSAGES[data.error]||'Not saved. Try again.');
          savedRevision=version;
          // Never replace newer edits with the response to an older save.
          if(revision===version){layout=data.layout.items;render();}
        }catch(error){status.textContent=error.message || 'Not saved. Try again.';root.querySelector('[data-house="retry"]').hidden=false;return false;}
      }
      status.textContent='Saved';root.querySelector('[data-house="retry"]').hidden=true;return true;
    })().finally(()=>{saving=null;});
    return saving;
  }
  function changed(){if(!canDecorate||!loaded)return;revision++;status.textContent='Saving…';render();clearTimeout(timer);timer=setTimeout(flush,350);}
  function place(id,x,y){if(!valid(id,x,y)){status.textContent='Choose a clear spot.';return;}const entry=placed(id);if(entry){entry.x=x;entry.y=y;}else layout.push({id,x,y});changed();}
  function remove(){if(!placed(selected))return;layout=layout.filter(item=>item.id!==selected);changed();}
  function cell(event){
    const r=floor.getBoundingClientRect();if(event.clientX<r.left||event.clientX>=r.right||event.clientY<r.top||event.clientY>=r.bottom)return null;
    const x=(event.clientX-r.left)/r.width*grid.cols, y=(event.clientY-r.top)/r.height*grid.rows;
    return decorating?{x:Math.round((x-(dragging?.offsetX||0))*4)/4,y:Math.round((y-(dragging?.offsetY||0))*4)/4}:{x,y};
  }
  function cancel(){dragging?.ghost?.remove();dragging=null;floor.querySelector('.house-target')?.setAttribute('hidden','');}
  root.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.house-tile');if(!decorating||!loaded||!button||event.button!==0)return;
    event.preventDefault();selected=button.dataset.item;
    const entry=placed(selected), r=floor.getBoundingClientRect();
    dragging={id:selected,x:event.clientX,y:event.clientY,moved:false,
      offsetX:entry?(event.clientX-r.left)/r.width*grid.cols-entry.x:0,
      offsetY:entry?(event.clientY-r.top)/r.height*grid.rows-entry.y:0};root.setPointerCapture(event.pointerId);
    root.querySelectorAll('.house-tile').forEach(el=>el.classList.toggle('selected',el.dataset.item===selected));
  });
  root.addEventListener('pointermove',event=>{
    if(!dragging)return;
    if(!dragging.moved&&Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)<6)return;
    dragging.moved=true;
    if(!dragging.ghost){const ghost=document.createElement('div');ghost.className='house-ghost';ghost.innerHTML=itemSprite(furniture.get(dragging.id));document.body.append(ghost);dragging.ghost=ghost;}
    dragging.ghost.style.left=event.clientX+'px';dragging.ghost.style.top=event.clientY+'px';
    const pos=cell(event),target=floor.querySelector('.house-target');target.hidden=!pos;
    if(pos){const {w,h}=size(dragging.id);target.style.left=`${pos.x/grid.cols*100}%`;target.style.top=`${pos.y/grid.rows*100}%`;target.style.width=`${Math.min(w,grid.cols-pos.x)/grid.cols*100}%`;target.style.height=`${Math.min(h,grid.rows-pos.y)/grid.rows*100}%`;target.classList.toggle('invalid',!valid(dragging.id,pos.x,pos.y));}
  });
  root.addEventListener('pointerup',event=>{
    if(!decorating){if(loaded&&event.target===floor){const pos=cell(event);if(pos){route=navigation.path(position,pos);if(!route.length)status.textContent='Choose a clear spot.';}}return;}
    if(!dragging){if(event.target===floor&&selected){const pos=cell(event);if(pos)place(selected,pos.x,pos.y);}return;}
    const {id,moved}=dragging, pos=cell(event);cancel();
    if(moved){if(pos)place(id,pos.x,pos.y);else{const r=shelf.getBoundingClientRect();if(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)remove();else status.textContent='Drop on the floor or shelf.';}}
    render();
    root.querySelector(`[data-item="${id}"]`)?.focus({preventScroll:true});
  });
  root.addEventListener('pointercancel',cancel);
  root.addEventListener('lostpointercapture',cancel);
  root.addEventListener('click',event=>{const el=event.target.closest('.house-tile');if(decorating&&el&&event.detail===0){selected=el.dataset.item;render();}});
  root.addEventListener('keydown',event=>{
    if(!decorating||!selected)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(delta){event.preventDefault();event.stopPropagation();const pos=placed(selected)||{x:6,y:4};const step=event.shiftKey?1:.25;place(selected,pos.x+delta[0]*step,pos.y+delta[1]*step);}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();remove();}
    if(event.key==='Escape'){cancel();selected=null;render();}
  });
  root.querySelector('[data-house="remove"]').onclick=remove;
  root.querySelector('[data-house="retry"]').onclick=flush;
  root.querySelector('[data-house="mode"]').onclick=()=>setDecorating(!decorating);
  function setDecorating(value){
    decorating=canDecorate&&value;cancel();keys.clear();route=[];selected=null;
    root.classList.toggle('decorating',decorating);
    root.querySelector('[data-house="editor"]').hidden=!decorating;
    root.querySelector('[data-house="mode"]').setAttribute('aria-pressed',String(decorating));
    root.querySelector('[data-house="mode"]').textContent=decorating?'Done decorating':'Decorate';
    root.querySelector('[data-house="help"]').textContent=decorating?'Drag decorations onto the floor':'Click to walk · WASD / arrows';
    render();
    if(!decorating)void flush();
  }
  function paintResident(moving,time) {
    resident.style.left=`${position.x/grid.cols*100}%`;resident.style.top=`${position.y/grid.rows*100}%`;
    resident.style.zIndex=String(Math.ceil(position.y*10));
    resident.dataset.x=position.x.toFixed(3);resident.dataset.y=position.y.toFixed(3);
    const frame=moving&&!reducedMotion.matches?[0,1,2,1][Math.floor(time/135)%4]:1;
    const signature=direction+frame;
    if(painted!==signature){paintCharacter?.(resident,direction,frame);painted=signature;}
  }
  function pause(){keys.clear();route=[];if(animation!==null)cancelAnimationFrame(animation);animation=null;lastTime=0;}
  function tick(time) {
    if(root.hidden){pause();return;}
    const dt=Math.min(.04,Math.max(0,(time-(lastTime||time))/1000));lastTime=time;
    let dx=0,dy=0;
    if(!decorating&&loaded){
      dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      if(dx||dy)route=[];
      else if(route.length){const target=route[0],distance=Math.hypot(target.x-position.x,target.y-position.y);if(distance<.05){position={...route.shift()};}else{dx=(target.x-position.x)/distance;dy=(target.y-position.y)/distance;}}
      const length=Math.hypot(dx,dy);
      if(length){
        onMove();
        direction=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
        const step=Math.min(dt*3.5,route.length?Math.hypot(route[0].x-position.x,route[0].y-position.y):Infinity);
        const nx=position.x+dx/length*step,ny=position.y+dy/length*step;
        if(!navigation.blocked(nx,position.y))position.x=nx;
        if(!navigation.blocked(position.x,ny))position.y=ny;
      }
    }
    paintResident(Boolean(dx||dy),time);animation=requestAnimationFrame(tick);
  }
  document.addEventListener('keydown',event=>{
    if(root.hidden||decorating||!loaded||event.target.closest('input,textarea,select'))return;
    const key=event.key.toLowerCase();
    if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
      event.preventDefault();
      // A quick tap still moves a tile when keyup arrives before the next frame.
      if(!keys.size&&!event.repeat){
        const dx=Number(['d','arrowright'].includes(key))-Number(['a','arrowleft'].includes(key));
        const dy=Number(['s','arrowdown'].includes(key))-Number(['w','arrowup'].includes(key));
        route=navigation.path(position,{x:Math.floor(position.x)+.5+dx,y:Math.floor(position.y)+.5+dy});
      }
      keys.add(key);
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  async function load(owner=null){
    const version=++loadVersion;
    if(!(await flush())||version!==loadVersion)return;
    pause();loaded=false;canDecorate=false;root.querySelector('.house-viewport').inert=true;social.pause();
    status.textContent='Opening your home…';
    try{const response=await fetch('/api/house'+(owner?'?owner='+encodeURIComponent(owner):''),{signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(MESSAGES[data.error]||'Home unavailable.');
      if(version!==loadVersion)return;
      Object.assign(grid,data.grid);furniture=new Map(data.furniture.map(item=>[item.id,item]));owned=data.owned;layout=data.layout.items;rooms=data.rooms;roomSelect.innerHTML=rooms.map(room=>`<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`).join('');await applyRoom(data.layout.roomId||'room-cottage');if(version!==loadVersion)return;canDecorate=data.canDecorate===true;root.querySelector('.house-viewport').inert=false;root.querySelector('.house-room-choice').hidden=!canDecorate;root.querySelector('.house-mode').hidden=!canDecorate;root.querySelector('[data-house="owner-label"]').textContent=canDecorate?'Your place':data.owner.name+'’s place';social.load(data.owner.key);selected=null;loaded=true;status.textContent='Make yourself at home.';setDecorating(false);
      if(!root.hidden&&animation===null)animation=requestAnimationFrame(tick);
    }catch(error){status.textContent=error.message;}
  }
  return {load,flush,pause(){loadVersion++;pause();social.pause();}};
}
