#!/usr/bin/env node
// Compile measured geometry; colors alone cannot distinguish orange roads from pumpkins.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {validateTheme} from '../town-themes/contract.mjs';
const source=process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-map-theme.mjs content/themes/<id>-source.json');
const spec=JSON.parse(readFileSync(source));
const base=spec.base ? JSON.parse(readFileSync(spec.base)) : {};
const theme={...base,...spec.theme};
const cols=spec.cols || base.walkMask?.cols || 192, rows=spec.rows || base.walkMask?.rows || 128;
const bits=spec.base ? Buffer.from(base.walkMask.bits,'base64') : Buffer.alloc(Math.ceil(cols*rows/8));
if (spec.base && (cols!==base.walkMask.cols || rows!==base.walkMask.rows)) throw new Error('Base grid size cannot change');
const get=i=>(bits[i>>3]>>(i&7))&1;
const set=(i,v)=>{if(v)bits[i>>3]|=1<<(i&7);else bits[i>>3]&=~(1<<(i&7));};
function inPolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,yi]=points[i], [xj,yj]=points[j];
    if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function contains(shape,x,y) {
  if (shape.points) return inPolygon(x,y,shape.points);
  if (shape.from && shape.to) {
    const [a,b]=shape.from,[c,d]=shape.to, length=(c-a)**2+(d-b)**2;
    const t=length ? Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/length)) : 0;
    return Math.hypot(x-a-t*(c-a),y-b-t*(d-b))<=shape.width;
  }
  return ((x-shape.x)/shape.rx)**2+((y-shape.y)/shape.ry)**2<=1;
}
for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
  const i=row*cols+col,x=(col+.5)/cols*100,y=(row+.5)/rows*100;
  if ((spec.allow || []).some(s=>contains(s,x,y))) set(i,1);
  if ((spec.block || []).some(s=>contains(s,x,y))) set(i,0);
}
// Use the same four-connected topology required to avoid diagonal corner squeezing.
const start=Math.floor(theme.spawn.y/100*rows)*cols+Math.floor(theme.spawn.x/100*cols);
if (!get(start)) throw new Error('Spawn is blocked; measure it on the artwork');
const seen=new Set([start]),queue=[start];
while(queue.length) {
  const i=queue.pop(),x=i%cols,y=Math.floor(i/cols);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx,ny=y+dy,n=ny*cols+nx;
    if(nx<0||ny<0||nx>=cols||ny>=rows||seen.has(n)||!get(n))continue;
    seen.add(n);queue.push(n);
  }
}
let dropped=0;
for(let i=0;i<cols*rows;i++) if(get(i)&&!seen.has(i)){set(i,0);dropped++;}
theme.walkMask={cols,rows,bits:bits.toString('base64')};
const window={location:{search:''}};
vm.runInNewContext(readFileSync('town-collision.js','utf8'),{window,atob,URLSearchParams});
const collision=window.createTownCollision(theme.walkMask);
const rejected=[];
theme.zones=(spec.zones || base.zones || []).flatMap(zone=>{
  const anchor=zone.anchor || {x:zone.x,y:zone.y};
  if (!collision.isWalkable(anchor.x,anchor.y)) {rejected.push(zone.note);return [];}
  return [{...zone,anchor,resolved:true,seats:zone.seats || 1,scene:'town'}];
});
for(const station of theme.stations)for(const point of [station,station.left,station.right])Object.assign(point,collision.nearestWalkable(point.x,point.y));
theme.imageSha256=createHash('sha256').update(readFileSync('.'+theme.image)).digest('hex');
theme.navigation={source,base:spec.base || null,droppedCells:dropped,omittedZones:rejected.length};
validateTheme(theme);
writeFileSync(`content/themes/${theme.id}.json`,JSON.stringify(theme,null,2)+'\n');
console.log(JSON.stringify({id:theme.id,cells:seen.size,droppedCells:dropped,zones:theme.zones.length,omittedZones:rejected}));
