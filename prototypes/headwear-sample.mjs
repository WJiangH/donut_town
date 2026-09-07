import{loadHatSprite,accessoryGeometry,drawAccessory}from'/characters/head-accessories.mjs';
const sample=await(await fetch('./hat-fit-sample.json')).json(),hat=await loadHatSprite();
const view=document.querySelector('#view'),pose=document.querySelector('#pose'),button=document.querySelector('#walk');
let phase=1,timer=null;const residents=[];
async function loadImage(url){const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});return image}
for(const item of sample.items){
 const ch=await(await fetch(`/characters/${item.id}.json`)).json();
 const urls=new Set([ch.url,...Object.values(ch.actions).map(a=>a.url)]),images=new Map(await Promise.all([...urls].map(async url=>[url,await loadImage(url)])));
 const article=document.createElement('article');article.innerHTML=`<strong>${item.label}</strong><canvas width="360" height="250" aria-label="${item.label} hat comparison"></canvas><small>Original / Equipped</small><small style="margin-top:6px;color:${item.fitStatus==='sample-fit-ok'?'#36583b':'#8a3c25'}">${item.note}</small>`;document.querySelector('main').append(article);
 residents.push({...item,ch,images,canvas:article.querySelector('canvas'),overlay:document.createElement('canvas')});
}
function render(){
 for(const item of residents){
  const {ch,heads,images,canvas,overlay}=item,action=pose.value||null,source=action?ch.actions[action]:ch,d=source.facing||view.value,index=action?phase%source.frames.length:(d==='up'?6:d==='down'?0:3)+[0,1,2,1][phase%4];
  const g=accessoryGeometry(ch,index,action,heads),[x,y,w,h]=g.frame,scale=165/source.frameHeight,c=canvas.getContext('2d');
  c.clearRect(0,0,360,250);c.imageSmoothingEnabled=false;
  for(const [center,wear]of[[90,false],[270,true]]){
   c.save();c.translate(center,0);if(d==='left')c.scale(-1,1);
   c.drawImage(images.get(source.url),x,y,w,h,-w*scale/2,235-h*scale,w*scale,h*scale);
   if(wear){drawAccessory(overlay,{hat:true},d,hat);const ratio=g.headWidth/112*scale;c.drawImage(overlay,(g.x-w/2)*scale-96*ratio,235-(h-g.y)*scale-96*ratio,192*ratio,150*ratio)}
   c.restore();
  }
 }
}
view.onchange=pose.onchange=render;
function stop(){clearInterval(timer);timer=null;button.textContent='Animate';phase=1;render()}
button.onclick=()=>{if(timer)return stop();button.textContent='Pause';timer=setInterval(()=>{phase++;render()},150)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
render();document.querySelector('#status').textContent='Local fitting review · no member outfits changed';document.title='Hat fitting sample · ready';
