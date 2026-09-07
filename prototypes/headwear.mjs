import {RIG_URL,accessoryGeometry,drawAccessory,paintAccessory,cleanBanner,loadHatSprite} from '../characters/head-accessories.mjs';
import {loadWardrobe,layerUrls} from '../characters/wardrobe/renderer.mjs';
const POSE_LABELS={sitChair:'Sit',garden:'Garden',lookout:'Look around',read:'Read',experiment:'Experiment',fish:'Fish',coffee:'Coffee',sitGrass:'On the grass',dance:'Dance'};
export async function mountHeadwear(root,character,onChange=()=>{}){
 if(character?.url!==RIG_URL)return null;
 const manifest=await(await fetch('/characters/wardrobe/r-7f3a2c.json')).json();
 const [images,hatSprite]=await Promise.all([loadWardrobe(manifest),loadHatSprite()]);
 for(const action of Object.values(character.actions||{}))if(!images.has(action.url)){
  const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=action.url});images.set(action.url,im);
 }
 root.innerHTML=`<h3>Accessory test</h3><canvas width="320" height="300" aria-label="Head accessory preview" style="width:240px;max-width:100%;image-rendering:pixelated;background:#d9e2c6"></canvas><div class="accessory-controls"><label><input type="checkbox" name="hat"> Felt hat</label><label>Banner <input name="banner" maxlength="24" placeholder="HI TEAM" size="12"></label><label>View <select name="facing"><option value="down">Front</option><option value="right">Right</option><option value="up">Back</option><option value="left">Left</option></select></label><label>Pose <select name="pose"><option value="">Walk / stand</option>${Object.keys(character.actions||{}).map(id=>`<option value="${id}">${POSE_LABELS[id]||id}</option>`).join('')}</select></label><button type="button" name="animate">Walk</button><button type="button" name="clear">Remove all</button></div><p>Local test · no purchase or save</p>`;
 const selection={hat:false,banner:''},layer=document.createElement('canvas');let phase=1,timer=null;
 const output=root.querySelector('canvas'),hat=root.querySelector('[name=hat]'),banner=root.querySelector('[name=banner]'),facing=root.querySelector('[name=facing]'),pose=root.querySelector('[name=pose]'),animate=root.querySelector('[name=animate]');
 function render(){
  const actionId=pose.value||null,source=character.actions?.[actionId]||character,d=source.facing||facing.value;
  const index=actionId?phase%source.frames.length:(d==='up'?6:d==='down'?0:3)+[0,1,2,1][phase%4];
  const g=accessoryGeometry(character,index,actionId),[x,y,w,h]=g.frame,scale=175/source.frameHeight;
  const c=output.getContext('2d');c.clearRect(0,0,320,300);c.imageSmoothingEnabled=false;
  c.save();if(d==='left'){c.translate(320,0);c.scale(-1,1)}
  for(const url of actionId?[source.url]:layerUrls(manifest,character.outfit))c.drawImage(images.get(url),x,y,w,h,160-w*scale/2,285-h*scale,w*scale,h*scale);
  drawAccessory(layer,selection,d,hatSprite);const ratio=g.headWidth/112*scale;
  c.drawImage(layer,160+(g.x-w/2)*scale-96*ratio,285-(h-g.y)*scale-96*ratio,192*ratio,150*ratio);c.restore();
 }
 function change(){selection.hat=hat.checked;selection.banner=cleanBanner(banner.value);onChange({...selection});render()}
 hat.onchange=banner.oninput=change;facing.onchange=pose.onchange=render;
 function stop(){clearInterval(timer);timer=null;animate.textContent='Walk';phase=1;render()}
 animate.onclick=()=>{if(timer)return stop();animate.textContent='Pause';timer=setInterval(()=>{phase++;render()},140)};
 root.querySelector('[name=clear]').onclick=()=>{hat.checked=false;banner.value='';change();stop()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 document.querySelector('#profileWardrobe')?.addEventListener('wardrobe-close',stop);
 render();return {selection,paint:(element,ch,d,i,a)=>paintAccessory(element,ch,selection,d,i,a,hatSprite),stop};
}
export async function attachTownPrototype(root,character){
 const panel=document.createElement('section');panel.className='headwear-prototype';panel.style.cssText='margin-top:24px;padding-top:20px;border-top:2px solid #bfccb9';root.append(panel);
 return mountHeadwear(panel,character);
}
