import {loadTheme} from './client.mjs';
const status=document.querySelector('#status');
try {
  const catalog=await (await fetch('/content/themes/catalog.json')).json();
  const id=new URLSearchParams(location.search).get('theme') || 'classic';
  const entry=catalog.find(t=>t.id===id);
  if (!entry) throw new Error('Unknown theme');
  const theme=await loadTheme(entry);
  document.querySelector('#name').textContent=theme.name;
  document.title=theme.name+' · Map preview';
  const world=document.querySelector('#world'),art=document.querySelector('#art'),walker=document.querySelector('#walker'),sprite=walker.querySelector('i');
  world.style.aspectRatio=`${theme.imageSize.width}/${theme.imageSize.height}`;
  art.src=theme.image;art.alt=theme.name+' preview';
  window.TownCollision=window.createTownCollision(theme.walkMask);
  window.TownZones.setTown(theme.zones);
  const collision=window.TownCollision;
  const canvas=document.querySelector('#overlay');canvas.width=theme.walkMask.cols;canvas.height=theme.walkMask.rows;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)pixels.data.set(collision.isWalkable((x+.5)/canvas.width*100,(y+.5)/canvas.height*100)?[56,255,140,255]:[110,12,22,220],(y*canvas.width+x)*4);
  ctx.putImageData(pixels,0,0);
  document.querySelector('#paths').onchange=e=>{canvas.hidden=!e.target.checked;};
  const zones=document.querySelector('#zones');
  document.querySelector('#spots').onchange=e=>{zones.hidden=!e.target.checked;};
  let pos={...theme.spawn},path=[],direction='down',action=null,last=performance.now();
  const keys=new Set();
  const character=await (await fetch('/characters/r-7f3a2c.json')).json();
  await Promise.all([...new Set([character.url,...Object.values(character.actions).map(a=>a.url)])].map(async url=>{const img=new Image();img.src=url;await img.decode();}));
  for (const z of theme.zones) {
    const button=document.createElement('button');button.textContent=[z.action].flat()[0];button.title=z.note || button.textContent;button.style.left=z.anchor.x+'%';button.style.top=z.anchor.y+'%';
    button.onclick=e=>{e.stopPropagation();path=collision.findPath(pos,z.anchor);window.TownZones.reset();};zones.append(button);
  }
  for (const [id,e] of Object.entries(theme.entrances)) {
    const label=document.createElement('span');label.textContent=({chemPod:'Chem Pod',donutShop:'Shop',donutFactory:'Factory 1',donutFactoryTwo:'Factory 2'})[id] || id;label.style.left=e.x+'%';label.style.top=e.y+'%';document.querySelector('#doors').append(label);
  }
  const reset=()=>{pos={...theme.spawn};path=[];keys.clear();action=null;window.TownZones.reset();};
  document.querySelector('#reset').onclick=reset;
  world.onclick=e=>{world.focus();const r=world.getBoundingClientRect();path=collision.findPath(pos,{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100});};
  world.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();keys.add(e.key);path=[];}});
  window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instruction='Preview only · Active town unchanged · Click to walk';
  function frame(now) {
    const dt=Math.min((now-last)/1000,.05);last=now;
    let dx=Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a'));
    let dy=Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));
    if (path.length) {dx=path[0].x-pos.x;dy=path[0].y-pos.y;if(Math.hypot(dx,dy)<.12){pos=path.shift();dx=dy=0;}}
    const moving=Boolean(dx||dy);
    if (moving) {
      const length=Math.hypot(dx,dy),step=Math.min(length,dt*6),x=pos.x+dx/length*step,y=pos.y+dy/length*step;
      if(collision.isWalkable(x,y))pos={x,y};
      direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');action=null;window.TownZones.reset();
    } else {
      const settled=window.TownZones.settle(pos,'town',now,character.actions,[]);
      if(settled?.walkTo)path=collision.findPath(pos,settled.walkTo);
      if(settled?.action)action=settled.action;
    }
    const source=character.actions[action] || character;
    const facing=source.facing || direction;
    const f=moving&&!reduced?Math.floor(now/150)%3:1;
    const index=action?0:(facing==='up'?2:['left','right'].includes(facing)?1:0)*3+f;
    const [x,y,w,h]=source.frames[index],height=world.clientWidth/theme.worldWidth*88,scale=height/source.frameHeight;
    walker.style.left=pos.x+'%';walker.style.top=pos.y+'%';walker.style.width=w*scale+'px';walker.style.height=h*scale+'px';
    sprite.style.backgroundImage=`url("${source.url}")`;sprite.style.backgroundSize=`${source.imageWidth*scale}px ${source.imageHeight*scale}px`;sprite.style.backgroundPosition=`${-x*scale}px ${-y*scale}px`;sprite.style.transform=facing==='left'?'scaleX(-1)':'';
    walker.dataset.action=action || (moving?'walk':'idle');walker.dataset.x=pos.x.toFixed(2);walker.dataset.y=pos.y.toFixed(2);
    status.textContent=action?`${instruction} · ${action}`:instruction;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch {status.textContent='Could not load this preview. Check the theme package and try again.';}
