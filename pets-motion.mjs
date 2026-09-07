// Positions are normalized; distances use the scene's unscaled pixel plane.
// Neither state transitions nor navigation depend on a theme name or frame rate.
export function petSpace(options={}) {
  const x=(options.width||3072)/100,y=(options.height||3072)/100,scale=options.figureScale||1;
  return {x,y,scale,distance:(a,b)=>Math.hypot((a.x-b.x)*x,(a.y-b.y)*y)};
}
export function petSpawn(owner,isWalkable,options={}) {
  const m=petSpace(options);
  for(const angle of [0,Math.PI,Math.PI/2,-Math.PI/2,.75,-.75,2.4,-2.4]){
    const p={x:owner.x+Math.cos(angle)*68*m.scale/m.x,y:owner.y+Math.sin(angle)*68*m.scale/m.y};
    if(!isWalkable||isWalkable(p.x,p.y))return p;
  }
  return {x:owner.x,y:owner.y};
}
export function updatePet(state,owner,dt,isWalkable,options={}) {
  dt=Math.min(.05,Math.max(0,dt));if(!dt)return state;
  const m=petSpace(options),follow=86*m.scale,settle=5*m.scale;
  const walkable=p=>!isWalkable||isWalkable(p.x,p.y);
  const clear=(a,b)=>{
    if(options.lineIsClear)return options.lineIsClear(a,b);
    const n=Math.max(1,Math.ceil(m.distance(a,b)/(2*m.scale)));
    for(let i=0;i<=n;i++)if(!walkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;
    return true;
  };
  const previous=state.lastOwner||owner,ownerSpeed=m.distance(owner,previous)/dt;
  const ownerMoving=owner.moving===true||ownerSpeed>5*m.scale;
  state.stillFor=ownerMoving?0:(state.stillFor||0)+dt;
  state.lastOwner={x:owner.x,y:owner.y};
  state.elapsed=(state.elapsed||0)+dt;
  if(ownerMoving){state.idleTarget=null;state.idlePlanned=false;}
  const trail=state.trail ||= [];
  if(!trail.length||m.distance(owner,trail.at(-1))>=8*m.scale)trail.push({x:owner.x,y:owner.y});
  if(trail.length>160)trail.splice(0,trail.length-160);
  let target=trail[0],remaining=follow,head=owner;
  for(let i=trail.length-1;i>=0;i--){
    const p=trail[i],distance=m.distance(head,p);
    if(distance>=remaining){const t=remaining/distance;target={x:head.x+(p.x-head.x)*t,y:head.y+(p.y-head.y)*t};break;}
    remaining-=distance;head=p;
  }
  function routeTo(goal){
    if(!walkable(goal))return [];
    if(clear(state,goal))return [{...goal}];
    return options.findPath?.({x:state.x,y:state.y},goal)||[];
  }
  if(state.stillFor>.6){
    if(!state.idlePlanned){
      state.idlePlanned=true;state.route=[];
      const side=state.x>=owner.x?1:-1;
      const angles=[side>0?0:Math.PI,side>0?Math.PI:0,Math.PI/2,-Math.PI/2,.75,-.75,2.4,-2.4];
      for(const a of angles){
        const seat={x:owner.x+Math.cos(a)*68*m.scale/m.x,y:owner.y+(Math.sin(a)*68+12)*m.scale/m.y};
        const route=routeTo(seat);
        if(route.length){state.idleTarget=seat;state.route=route;break;}
      }
      // A narrow or disconnected floor can have no side seat. Stay put instead
      // of repeatedly switching targets and walking/sitting atlases.
      state.idleTarget ||= {x:state.x,y:state.y};
    }
    target=state.idleTarget;
  } else if(m.distance(state,owner)<35*m.scale){
    // Yield sideways when the owner reverses through the companion.
    const dx=(owner.x-previous.x)*m.x,dy=(owner.y-previous.y)*m.y,len=Math.hypot(dx,dy);
    for(const side of [1,-1]){
      const p={x:owner.x+(len?-dy/len:1)*side*68*m.scale/m.x,y:owner.y+(len?dx/len:0)*side*68*m.scale/m.y};
      if(walkable(p)&&clear(state,p)){target=p;break;}
    }
  }
  let advanced=false;
  if(m.distance(state,target)>settle){
    if(clear(state,target))state.route=[target];
    else if(!state.route?.length||state.elapsed>=(state.replanAt||0)){
      state.route=routeTo(target);state.replanAt=state.elapsed+.4;
    }
    while(state.route?.length&&m.distance(state,state.route[0])<.5*m.scale)state.route.shift();
    const next=state.route?.[0];
    if(next){
      const gap=m.distance(state,next),speed=Math.max(170*m.scale,Math.min(420*m.scale,ownerSpeed*1.2));
      const stride=Math.min(speed*dt,gap),candidate={x:state.x+(next.x-state.x)*stride/gap,y:state.y+(next.y-state.y)*stride/gap};
      if(stride>0&&clear(state,candidate)){
        const dx=(candidate.x-state.x)*m.x,dy=(candidate.y-state.y)*m.y;
        // Keep the current axis near diagonal motion to avoid rapid left/up flips.
        const horizontal=['left','right'].includes(state.facing);
        const useX=Math.abs(dx)>Math.abs(dy)*(horizontal ? .8 : 1.2);
        state.facing=useX?(dx<0?'left':'right'):(dy<0?'up':'down');
        Object.assign(state,candidate);advanced=true;
      }else{state.route=[];}
    }
  }
  state.motionHold=advanced ? .25 : Math.max(0,(state.motionHold||0)-dt);
  state.moving=state.motionHold>0;
  return state;
}
