// Feet move on the same grid used for furniture footprints. Rugs are floor art.
export function homeNavigation(grid, layout, furniture) {
  const blocked = (x,y) => x<0 || y<0 || x>=grid.cols || y>=grid.rows || layout.some(entry => {
    const item=furniture.get(entry.id);
    if (item?.walkThrough || entry.id.endsWith('-rug')) return false;
    const {w,h}=item?.footprint || {w:1,h:1};
    return x>=entry.x && x<entry.x+w && y>=entry.y && y<entry.y+h;
  });
  const center = (x,y) => ({x:x+.5,y:y+.5});
  function nearest(point) {
    let best=null, distance=Infinity;
    for(let y=0;y<grid.rows;y++)for(let x=0;x<grid.cols;x++) {
      if(blocked(x,y))continue;
      const d=(x+.5-point.x)**2+(y+.5-point.y)**2;
      if(d<distance){distance=d;best=center(x,y);}
    }
    return best;
  }
  function path(start,goal) {
    if(blocked(goal.x,goal.y)||blocked(start.x,start.y))return [];
    const key=(x,y)=>y*grid.cols+x, sx=Math.floor(start.x),sy=Math.floor(start.y),gx=Math.floor(goal.x),gy=Math.floor(goal.y);
    const queue=[[sx,sy]], previous=new Map([[key(sx,sy),null]]);
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i];
      if(x===gx&&y===gy){const result=[];let k=key(x,y);while(k!==null){result.unshift(center(k%grid.cols,Math.floor(k/grid.cols)));k=previous.get(k);}return result;}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy,k=key(nx,ny);
        if(blocked(nx,ny)||previous.has(k))continue;
        previous.set(k,key(x,y));queue.push([nx,ny]);
      }
    }
    return [];
  }
  return {blocked,nearest,path};
}
