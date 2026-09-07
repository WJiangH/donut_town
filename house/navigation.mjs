// Feet move on the same grid used for furniture footprints. Rugs are floor art.
export function homeNavigation(grid, layout, furniture) {
  const blocked = (x,y) => x<0 || y<0 || x>=grid.cols || y>=grid.rows || layout.some(entry => {
    const item=furniture.get(entry.id);
    if (item?.walkThrough || entry.id.endsWith('-rug')) return false;
    const {w,h}=item?.footprint || {w:1,h:1};
    return x>=entry.x && x<entry.x+w && y>=entry.y && y<entry.y+h;
  });
  const center = (x,y) => ({x:(x+.5)/4,y:(y+.5)/4});
  function nearest(point) {
    let best=null, distance=Infinity;
    for(let y=0;y<grid.rows*4;y++)for(let x=0;x<grid.cols*4;x++) {
      if(blocked((x+.5)/4,(y+.5)/4))continue;
      const d=((x+.5)/4-point.x)**2+((y+.5)/4-point.y)**2;
      if(d<distance){distance=d;best=center(x,y);}
    }
    return best;
  }
  function path(start,goal) {
    if(blocked(goal.x,goal.y)||blocked(start.x,start.y))return [];
    const key=(x,y)=>y*grid.cols*4+x, sx=Math.floor(start.x*4),sy=Math.floor(start.y*4),gx=Math.floor(goal.x*4),gy=Math.floor(goal.y*4);
    const queue=[[sx,sy]], previous=new Map([[key(sx,sy),null]]);
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i];
      if(x===gx&&y===gy){const result=[];let k=key(x,y);while(k!==null){result.unshift(center(k%(grid.cols*4),Math.floor(k/(grid.cols*4))));k=previous.get(k);}return [start,...result,goal];}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy,k=key(nx,ny);
        if(blocked((nx+.5)/4,(ny+.5)/4)||previous.has(k))continue;
        previous.set(k,key(x,y));queue.push([nx,ny]);
      }
    }
    return [];
  }
  return {blocked,nearest,path};
}
