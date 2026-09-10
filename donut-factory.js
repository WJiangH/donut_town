// One reusable workshop; pairs spill into another workshop, never share a station.
(function () {
  // Measured against the 1536 x 1024 v2 room. Feet sit behind the counter;
  // its front face defines the ground-plane collision and foreground depth.
  const stations = [33.4,48.7,64.3].flatMap((top,row) => [20.8,39.8,60.5,79.8].map((x,col) => {
    const y=top+5.2;
    return {x,y,top,bottom:top+12.6,variant:row*4+col,
      left:{x:x-2.9,y},right:{x:x+2.9,y}};
  }));
  function stationFor(pairs, userId, page, position, moving=false) {
    if(moving || !position) return null;
    const pair=pairs.find(pair=>pair.page===page && pair.members.some(p=>id(p)===userId));
    if(!pair) return null;
    const side=pair.members.findIndex(p=>id(p)===userId);
    const spot=side===0?pair.station.left:pair.station.right;
    return Math.hypot(position.x-spot.x,position.y-spot.y)<.7 ? {station:pair.station,side} : null;
  }
  // Front-view chin/collar cuts reviewed on the existing 56 assigned identities.
  // This changes only the temporary baking costume, never the saved avatar.
  const headCuts={
    '0486d1':.45,'085b80':.40,'1043fe':.40,'1064fe':.41,'1115c1':.45,'116e1a':.31,'12960c':.42,'1df047':.49,'275360':.38,'2e57a5':.44,
    '331031':.32,'3b1082':.49,'3bb640':.37,'42218c':.45,'47174e':.49,'4fc97b':.44,'55b262':.52,'5635fb':.45,'5775b5':.43,'596f28':.42,
    '607f12':.43,'654fff':.43,'69f6d4':.42,'6f211e':.42,'6fa98c':.43,'70f8f9':.45,'74b9db':.50,'7b8c65':.48,'7e4404':.45,'7e550e':.43,
    '7f3a2c':.39,'847bc9':.43,'84b56f':.46,'88a426':.47,'908340':.53,'93b5e1':.52,'93c8e1':.30,'9d48d2':.45,'a59a39':.44,'a69569':.46,
    'adf4ae':.36,'b4e9c9':.43,'b61800':.43,'b7c1c2':.45,'c2bbd5':.45,'c74fc1':.43,'c848a4':.49,'c9b4dd':.45,'da85dd':.47,'dd03cb':.45,
    'e189a0':.45,'e26546':.50,'e4a122':.53,'e78900':.42,'e8b91e':.47,'fad40d':.41
  };
  const headFraction=character=>headCuts[character?.url?.match(/residents\/r-([a-f0-9]+)\//)?.[1]] || .43;
  const id = person => person.slackId || person.id;
  function pairsFor(people) {
    const groups = new Map();
    for (const person of people) {
      if (person.status !== 'booked' || !person.pairId || !person.partnerId) continue;
      if (!groups.has(person.pairId)) groups.set(person.pairId,[]);
      groups.get(person.pairId).push(person);
    }
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([pairId,members])=>{
      if (members.length!==2 || id(members[0])===id(members[1]) || members[0].partnerId!==id(members[1]) || members[1].partnerId!==id(members[0])) return [];
      return [{pairId,members:members.sort((a,b)=>id(a).localeCompare(id(b)))}];
    }).map((pair,index)=>({...pair,page:Math.floor(index/stations.length),station:stations[index%stations.length]}));
  }
  const geometry = {
    floor:[{left:11.5,right:89,top:30,bottom:79.5},{left:42,right:57,top:79,bottom:91}],
    blocked:[
      ...stations.map(s=>({left:s.x-6.5,right:s.x+6.5,top:s.y+1,bottom:s.bottom})),
      {left:0,right:12,top:39,bottom:64},{left:88,right:100,top:39,bottom:64}
    ]
  };
  const cols=224,rows=126,bytes=new Uint8Array(Math.ceil(cols*rows/8));
  const contains=(r,x,y)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=(col+.5)/cols*100,y=(row+.5)/rows*100,i=row*cols+col;
    if(geometry.floor.some(r=>contains(r,x,y))&&!geometry.blocked.some(r=>contains(r,x,y)))bytes[i>>3]|=1<<(i&7);
  }
  window.DonutFactory={stations,pairsFor,stationFor,headFraction,geometry};
  window.FACTORY_WALK_MASK={cols,rows,bits:btoa(String.fromCharCode(...bytes)),geometry};
})();
