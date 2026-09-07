import { itemArt } from './shop/item-art.mjs';
const MESSAGES = {
  slack_login_required: 'Open the town from Slack to visit your home.',
  member_not_found: 'Only channel members have a home.',
  house_store_unavailable: 'Home storage is unavailable.',
  house_save_failed: 'Not saved. Try again.',
  invalid_layout: 'That spot will not take it.'
};
const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function mountHouse(root, {paintCharacter = null} = {}) {
  const floor=root.querySelector('[data-house="floor"]'), shelf=root.querySelector('[data-house="shelf"]'), status=root.querySelector('[data-house="status"]');
  const grid={cols:14,rows:9};
  let furniture=new Map(), layout=[], owned=[], selected=null, dragging=null, timer=null, saving=null, revision=0, savedRevision=0, loaded=false;
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
    const style=entry?`grid-column:${entry.x+1}/span ${w};grid-row:${entry.y+1}/span ${h};z-index:${entry.y+h};`:'';
    return `<button class="house-tile${selected===item.id?' selected':''}" data-item="${escapeHtml(item.id)}" style="${style}" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}" aria-pressed="${selected===item.id}"><img src="${escapeHtml(itemArt(item))}" alt="" draggable="false"></button>`;
  }
  function render() {
    const focus=document.activeElement?.dataset.item;
    floor.style.setProperty('--cols',grid.cols);floor.style.setProperty('--rows',grid.rows);
    floor.innerHTML=layout.map(entry=>furniture.has(entry.id)?tile(furniture.get(entry.id),entry):'').join('')+'<span class="house-target" hidden></span>';
    shelf.innerHTML=owned.filter(id=>furniture.has(id)&&!placed(id)).map(id=>tile(furniture.get(id))).join('') || '<p class="house-empty">All placed. Find more in the shop.</p>';
    root.querySelector('[data-house="selected"]').textContent=furniture.get(selected)?.name || 'Select a decoration';
    root.querySelector('[data-house="remove"]').disabled=!placed(selected);
    if(focus)root.querySelector(`[data-item="${focus}"]`)?.focus({preventScroll:true});
  }
  async function flush() {
    clearTimeout(timer);
    if(saving)return saving;
    if(savedRevision===revision)return true;
    saving=(async()=>{
      while(savedRevision!==revision){
        const version=revision, snapshot={items:layout.map(item=>({...item}))};
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
  function changed(){revision++;status.textContent='Saving…';render();clearTimeout(timer);timer=setTimeout(flush,350);}
  function place(id,x,y){if(!valid(id,x,y)){status.textContent='Choose a clear spot.';return;}const entry=placed(id);if(entry){entry.x=x;entry.y=y;}else layout.push({id,x,y});changed();}
  function remove(){if(!placed(selected))return;layout=layout.filter(item=>item.id!==selected);changed();}
  function cell(event){const r=floor.getBoundingClientRect();if(event.clientX<r.left||event.clientX>=r.right||event.clientY<r.top||event.clientY>=r.bottom)return null;return{x:Math.floor((event.clientX-r.left)/r.width*grid.cols),y:Math.floor((event.clientY-r.top)/r.height*grid.rows)};}
  function cancel(){dragging?.ghost?.remove();dragging=null;floor.querySelector('.house-target')?.setAttribute('hidden','');}
  root.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.house-tile');if(!loaded||!button||event.button!==0)return;
    event.preventDefault();selected=button.dataset.item;
    dragging={id:selected,x:event.clientX,y:event.clientY,moved:false};root.setPointerCapture(event.pointerId);
    root.querySelectorAll('.house-tile').forEach(el=>el.classList.toggle('selected',el.dataset.item===selected));
  });
  root.addEventListener('pointermove',event=>{
    if(!dragging)return;
    if(!dragging.moved&&Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)<6)return;
    dragging.moved=true;
    if(!dragging.ghost){const ghost=document.createElement('div');ghost.className='house-ghost';ghost.innerHTML=`<img src="${escapeHtml(itemArt(furniture.get(dragging.id)))}" alt="">`;document.body.append(ghost);dragging.ghost=ghost;}
    dragging.ghost.style.left=event.clientX+'px';dragging.ghost.style.top=event.clientY+'px';
    const pos=cell(event),target=floor.querySelector('.house-target');target.hidden=!pos;
    if(pos){const {w,h}=size(dragging.id);target.style.left=`${pos.x/grid.cols*100}%`;target.style.top=`${pos.y/grid.rows*100}%`;target.style.width=`${Math.min(w,grid.cols-pos.x)/grid.cols*100}%`;target.style.height=`${Math.min(h,grid.rows-pos.y)/grid.rows*100}%`;target.classList.toggle('invalid',!valid(dragging.id,pos.x,pos.y));}
  });
  root.addEventListener('pointerup',event=>{
    if(!dragging){if(event.target===floor&&selected){const pos=cell(event);if(pos)place(selected,pos.x,pos.y);}return;}
    const {id,moved}=dragging;cancel();
    if(moved){const pos=cell(event);if(pos)place(id,pos.x,pos.y);else{const r=shelf.getBoundingClientRect();if(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)remove();else status.textContent='Drop on the floor or shelf.';}}
    render();
    root.querySelector(`[data-item="${id}"]`)?.focus({preventScroll:true});
  });
  root.addEventListener('pointercancel',cancel);
  root.addEventListener('lostpointercapture',cancel);
  root.addEventListener('click',event=>{const el=event.target.closest('.house-tile');if(el&&event.detail===0){selected=el.dataset.item;render();}});
  root.addEventListener('keydown',event=>{
    if(!selected)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(delta){event.preventDefault();event.stopPropagation();const pos=placed(selected)||{x:6,y:4};place(selected,pos.x+delta[0],pos.y+delta[1]);}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();remove();}
    if(event.key==='Escape'){cancel();selected=null;render();}
  });
  root.querySelector('[data-house="remove"]').onclick=remove;
  root.querySelector('[data-house="retry"]').onclick=flush;
  async function load(){
    if(!(await flush()))return;
    status.textContent='Opening your home…';
    try{const response=await fetch('/api/house',{signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(MESSAGES[data.error]||'Home unavailable.');
      Object.assign(grid,data.grid);furniture=new Map(data.furniture.map(item=>[item.id,item]));owned=data.owned;layout=data.layout.items;selected=null;loaded=true;status.textContent='Make yourself at home.';render();
    }catch(error){status.textContent=error.message;}
  }
  if(paintCharacter)paintCharacter(root.querySelector('[data-house="resident"]'));
  return {load,flush};
}
