// Populate authored activity areas before scattering everyone onto generic paths.
export function assignTownActivities(members,zones,roadSlots,collision) {
  const result=new Map(),occupied=[],limit=Math.ceil(members.length*.7);
  const apart=p=>occupied.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=3);
  const pools=zones.map(zone=>{
    const anchor=zone.anchor||zone,points=[anchor],radius=zone.radius||.8;
    for(let r=1.5;r<=radius;r+=1.5)for(let i=0;i<16;i++)points.push({x:anchor.x+Math.cos(i*Math.PI/8)*r,y:anchor.y+Math.sin(i*Math.PI/8)*r});
    return {zone,left:zone.seats||1,points:points.filter(p=>collision.isWalkable(p.x,p.y))};
  });
  let added=true;
  while(added&&result.size<limit){
    added=false;
    for(const pool of pools){
      if(!pool.left||result.size>=limit)continue;
      const member=members.find(m=>!result.has(m.id)&&m.status!=='booked'&&[pool.zone.action].flat().some(a=>m.character?.actions?.[a]));
      const point=pool.points.find(apart);if(!member||!point)continue;
      const slot={x:point.x,y:point.y,activity:'zone'};result.set(member.id,slot);occupied.push(slot);pool.left--;added=true;
    }
  }
  for(const member of members){
    if(result.has(member.id))continue;
    const slot=roadSlots.find(apart)||roadSlots.find(p=>occupied.every(q=>p.x!==q.x||p.y!==q.y))||roadSlots[0];
    result.set(member.id,slot);occupied.push(slot);
  }
  return result;
}
