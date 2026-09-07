// One reusable workshop; pairs spill into another workshop, never share a station.
(function () {
  const stations = [52,73].flatMap(y => [28,49.5,71].map(x => ({x,y,left:{x:x-8.5,y},right:{x:x+8.5,y}})));
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
    floor:[{left:11,right:89,top:35,bottom:80},{left:42,right:58,top:79,bottom:93}],
    blocked:[
      ...[40,61].flatMap(top=>[28,49.5,71].map(x=>({left:x-6.7,right:x+6.7,top,bottom:top+15}))),
      {left:0,right:12.5,top:43,bottom:74},{left:86,right:100,top:43,bottom:71}
    ]
  };
  const cols=224,rows=126,bytes=new Uint8Array(Math.ceil(cols*rows/8));
  const contains=(r,x,y)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=(col+.5)/cols*100,y=(row+.5)/rows*100,i=row*cols+col;
    if(geometry.floor.some(r=>contains(r,x,y))&&!geometry.blocked.some(r=>contains(r,x,y)))bytes[i>>3]|=1<<(i&7);
  }
  window.DonutFactory={stations,pairsFor,geometry};
  window.FACTORY_WALK_MASK={cols,rows,bits:btoa(String.fromCharCode(...bytes)),geometry};
})();
