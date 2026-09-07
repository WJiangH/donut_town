// Keep room art and normalized gameplay geometry on one undistorted plane.
export function roomFrame(width,height,{overview=false,x=.5,y=.62}={}) {
  const w=overview?Math.min(width,height*1.5):Math.max(width,height*1.5),h=w/1.5;
  const offset=(space,size,focus)=>size<=space?(space-size)/2:Math.max(space-size,Math.min(0,space/2-size*focus));
  return {width:w,height:h,x:offset(width,w,x),y:offset(height,h,y)};
}
export function mountInteriorCamera(viewport,world,button) {
  let focus={x:.5,y:.62},overview=false,frame=null,drag=null,suppressUntil=0,signature='';
  function render(){
    const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;
    frame=roomFrame(w,h,{...focus,overview});
    const next=JSON.stringify(frame);if(next===signature)return;signature=next;
    world.style.width=frame.width+'px';world.style.height=frame.height+'px';
    world.style.transform=`translate3d(${frame.x}px,${frame.y}px,0)`;
    world.style.setProperty('--home-figure',Math.max(.65,frame.width/1100));
  }
  function pan(dx,dy){
    if(!frame||overview)return;
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const x=clamp(frame.x+dx,Math.min(0,viewport.clientWidth-frame.width),0),y=clamp(frame.y+dy,Math.min(0,viewport.clientHeight-frame.height),0);
    focus={x:(viewport.clientWidth/2-x)/frame.width,y:(viewport.clientHeight/2-y)/frame.height};render();
  }
  function follow(x,y){
    if(!frame||overview||drag)return;
    const sx=frame.x+x*frame.width,sy=frame.y+y*frame.height,w=viewport.clientWidth,h=viewport.clientHeight;
    const dx=sx<w*.25?w*.25-sx:sx>w*.75?w*.75-sx:0;
    const dy=sy<h*.34?h*.34-sy:sy>h*.8?h*.8-sy:0;
    if(dx||dy)pan(dx,dy);
  }
  button.onclick=()=>{overview=!overview;button.textContent=overview?'Fill screen':'Room overview';button.setAttribute('aria-pressed',String(overview));render();};
  viewport.addEventListener('pointerdown',event=>{
    if(overview||event.button!==0||event.target.closest('button,a,input,select'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  },true);
  viewport.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<8)return;
    drag.moved=true;viewport.setPointerCapture(event.pointerId);pan(dx,dy);
    drag.x=event.clientX;drag.y=event.clientY;event.preventDefault();event.stopPropagation();
  },true);
  viewport.addEventListener('pointerup',event=>{
    if(drag?.moved){suppressUntil=Date.now()+200;event.preventDefault();event.stopPropagation();}
    drag=null;
  },true);
  viewport.addEventListener('pointercancel',()=>{drag=null;});
  viewport.addEventListener('lostpointercapture',()=>{drag=null;});
  viewport.addEventListener('click',event=>{if(Date.now()<suppressUntil){event.preventDefault();event.stopPropagation();}},true);
  new ResizeObserver(render).observe(viewport);render();
  return {render,follow,pan};
}
