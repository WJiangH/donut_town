// Reviewed head anchors for this rig only: atlas x/y at the hair crown, head width.
export const RIG_URL='/assets/residents/r-7f3a2c/walk-v1.png';
export const HEADS={
 walk:[[280,38,112],[638,38,112],[990,38,112],[284,435,112],[634,435,112],[990,435,112],[278,814,112],[634,814,112],[988,814,112]],
 sitChair:[[138,12,112]],garden:[[426,14,112]],lookout:[[710,12,110]],read:[[984,20,110]],experiment:[[1234,14,124]],fish:[[1504,12,110]],
 coffee:[[140,372,112],[422,372,112]],sitGrass:[[644,539,110],[934,506,112]],dance:[[1260,372,110],[1540,372,110]]
};
export function cleanBanner(text='') { return Array.from(String(text).normalize('NFC').replace(/[\p{C}]/gu,'')).slice(0,12).join(''); }
export function accessoryGeometry(character,index,actionId=null,heads=character.url===RIG_URL?HEADS:null) {
 if(!heads)return null;
 const source=actionId?character.actions?.[actionId]:character;
 const head=heads[actionId||'walk']?.[index],frame=source?.frames?.[index];
 if(!head||!frame)return null;
 return {x:head[0]-frame[0],y:head[1]-frame[1],headWidth:head[2],frame,source};
}
// Hat art is loaded once; banner lettering stays dynamic and needs no image asset.
let hatPromise;
export function loadHatSprite(){
 return hatPromise ||= (async()=>{
  const response=await fetch('/assets/accessories/felt-hat-v1.json');
  if(!response.ok)throw Error('Hat unavailable');
  const spec=await response.json(),image=new Image();
  await new Promise((resolve,reject)=>{image.onload=()=>image.naturalWidth===spec.width&&image.naturalHeight===spec.height?resolve():reject(Error('Hat dimensions mismatch'));image.onerror=reject;image.src=spec.url});
  return {...spec,image};
 })().catch(error=>{hatPromise=null;throw error});
}
export function drawAccessory(canvas,{hat=false,banner=''}={},facing='down',hatSprite=null) {
 canvas.width=192;canvas.height=150;
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 if(hat&&hatSprite){
  const key=facing==='up'?'back':facing==='down'?'front':'side';
  const [x,y,w,h]=hatSprite.frames[key];
  const width=148,height=width*h/w;
  c.drawImage(hatSprite.image,x,y,w,h,96-width/2,140-height,width,height);
 }
 const text=cleanBanner(banner);
 if(text){
  rect(2,10,188,40,'#263a32');rect(8,16,176,28,'#f4e3a4');rect(14,46,12,9,'#263a32');
  c.save();
  // Parent character is mirrored for left: counter-mirror only the lettering.
  if(facing==='left'){c.translate(192,0);c.scale(-1,1)}
  c.fillStyle='#263a32';c.font='bold 20px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(text,96,31,164);c.restore();
 }
}
export function paintAccessory(element,character,selection,facing,index,actionId=null,hatSprite=null){
 const g=accessoryGeometry(character,index,actionId);
 let canvas=element.querySelector('.head-accessory');
 if(!g||(!selection.hat&&!cleanBanner(selection.banner))){canvas?.remove();return;}
 const key=JSON.stringify([selection,facing,index,actionId]);
 if(canvas?.dataset.key===key)return;
 if(!canvas){canvas=document.createElement('canvas');canvas.className='head-accessory';canvas.setAttribute('aria-hidden','true');element.append(canvas)}
 drawAccessory(canvas,selection,facing,hatSprite);canvas.dataset.key=key;
 const scale=88/g.source.frameHeight,ratio=g.headWidth/112*scale;
 canvas.style.cssText=`position:absolute;pointer-events:none;image-rendering:pixelated;width:${192*ratio}px;height:${150*ratio}px;left:calc(50% + ${(g.x-g.frame[2]/2)*scale-96*ratio}px);bottom:${(g.frame[3]-g.y)*scale-54*ratio}px;`;
}
