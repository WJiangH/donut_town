import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {assignTownActivities}from'../town-activity-slots.mjs';import{collisionFor}from'../scripts/validate-map-themes.mjs';
for(const id of ['classic','halloween'])test(`${id}: supported resident activities occupy clear, separate ground`,()=>{
 const t=JSON.parse(readFileSync(`content/themes/${id}.json`)),c=collisionFor(t);
 const members=Array.from({length:56},(_,i)=>({id:String(i),character:{actions:Object.fromEntries(['dance','coffee','read','garden','lookout','sitGrass','sitChair'].map(k=>[k,{}]))}}));
 const result=assignTownActivities(members,t.zones,c.spreadPoints(160,4.2),c),slots=[...result.values()];
 assert.equal(result.size,56);assert(slots.filter(s=>s.activity==='zone').length>=30);
 for(let i=0;i<slots.length;i++){assert(c.isWalkable(slots[i].x,slots[i].y));for(let j=0;j<i;j++)assert(Math.hypot(slots[i].x-slots[j].x,slots[i].y-slots[j].y)>=3-1e-6);}
 const unsupported=assignTownActivities([{id:'blank'},{id:'booked',status:'booked',character:members[0].character}],t.zones,c.spreadPoints(160,4.2),c);
 assert([...unsupported.values()].every(s=>s.activity!=='zone'));
});
