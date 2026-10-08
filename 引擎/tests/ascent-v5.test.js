const test=require('node:test'),assert=require('node:assert/strict'),{GameMap}=require('../gamemap'),{GeometryV2}=require('../geometry-v2'),movement=require('../movement'),doors=require('../doors');
const data=require('../maps/ascent-combat-v5.json'),geo=require('../maps/ascent-geometry-v5.json'),map=new GameMap(data,geo);
test('B lane partition physically blocks inside-site sight without removing all valid routes',()=>{
 const a={x:688,y:664},b={x:706,y:664};assert(map.geometry.contains(a));assert(map.geometry.contains(b));assert(!map.geometry.canShoot(a,b));assert(!map.geometry.canWalk(a,b));assert(map.geometry.route(a,b)?.length>2);
 for(const p of Object.values(data.positions))assert(map.geometry.contains(p));for(const e of data.edges)for(let i=1;i<e.route.length;i++)assert(map.geometry.canWalk(e.route[i-1],e.route[i]));
});
test('market door closed blocks physical sight and navigation; reopening invalidates pose caches',()=>{
 const a={id:'A:0',post:'market-door-hold',position:{x:542,y:663}},b={id:'B:0',position:{x:590,y:663}},r={map,t:0,doors:{'b-market-door':'open'}};
 assert(map.geometry.contains(b.position));assert(map.engagements.query(r,a,b).visible>0);r.doors['b-market-door']='closed';assert.equal(map.engagements.query(r,a,b).visible,0);assert(!map.geometry.canWalk(a.position,b.position,null,{doors:r.doors}));
 r.doors['b-market-door']='open';assert(map.engagements.query(r,a,b).visible>0);assert(map.geometry.canWalk(a.position,b.position,null,{doors:r.doors}));
});
test('closing and opening a door require a nearby live unit and operation time',()=>{
 const u={id:'A:0',name:'选手',side:'def',alive:true,position:{x:542,y:663},node:'market',holdTicks:2},events=[];
 const r={...doors,map,units:[u],t:2,hasVisibleEnemy:()=>false,emit:(type,d)=>events.push({type,...d})};r.initDoors();r.updateDoors();assert.equal(r.doors['b-market-door'],'open');assert(u.doorAction);
 r.t=3;r.updateDoors();assert.equal(r.doors['b-market-door'],'closed');assert(r.openDoorForRoute(u,{x:590,y:663}));r.t=3.5;r.updateDoors();assert.equal(r.doors['b-market-door'],'closed');r.t=4;r.updateDoors();assert.equal(r.doors['b-market-door'],'open');assert.equal(events.filter(e=>e.type==='door').length,2);
});
test('a door closing across an in-flight route stops the unit without crossing it',()=>{
 const u={id:'A:0',name:'选手',alive:true,side:'atk',node:'market',position:{x:555,y:663},stun:0,moving:{from:'market',to:'b_site',left:.25,total:.5,route:[{x:555,y:663},{x:590,y:663}]}};
 const r={...movement,map,doors:{'b-market-door':'closed'},units:[u],occ:Object.fromEntries(Object.keys(data.nodes).map(n=>[n,new Set()])),postOcc:{},emit:()=>{}};r.updateMovement();assert.equal(u.moving,null);assert.deepEqual(u.position,{x:555,y:663});
});
test('a partially exposed body produces a ray to the visible edge, never a wall-hidden center',()=>{
 const g=new GeometryV2({schemaVersion:2,width:100,height:100,floorContours:[[[0,0],[100,0],[100,100],[0,100]]],obstacles:[{points:[[48,49],[52,49],[52,51],[48,51]],height:8}]});
 const a={x:20,y:50},b={x:80,y:50};assert(!g.canShoot(a,b));assert(g.visibleFraction(a,b)>0);const trace=g.shootTrace(a,b);assert(trace);assert.notEqual(trace.y,b.y);assert(g.canShoot(a,trace));
});
