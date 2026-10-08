const test=require('node:test'),assert=require('node:assert/strict');
const abilities=require('../abilities'),movement=require('../movement'),{canObserve}=require('../observation'),{GeometryV2}=require('../geometry-v2'),{snapshotAt}=require('../snapshot');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
test('a moving entrant can cast once; a visible target is flashed but a wall-hidden target is not',()=>{
 const geometry=new GeometryV2({schemaVersion:2,floorContours:[rect(0,0,200,100)],obstacles:[{id:'wall',points:rect(60,40,10,20),height:3}]});
 const a={id:'a',name:'a',node:'room',alive:true,side:'atk',position:{x:30,y:50},moving:{to:'room'},syn:70,utils:1},visible={id:'b',name:'b',node:'room',alive:true,side:'def',position:{x:40,y:50},stun:0},hidden={...visible,id:'c',name:'c',position:{x:90,y:50}};
 const events=[],round={t:0,map:{data:{strictSpatial:true},geometry},units:[a,visible,hidden],occ:{room:new Set([visible,hidden])},lastFlashTick:{},stats:{utilsAtk:0,utilsByType:{flash:0}},thinkUse:()=>true,synFactor:()=>1,emit:(type,e)=>events.push({type,...e})};round.visibleEnemiesAt=u=>round.units.filter(e=>canObserve(round,u,e));
 assert(abilities.onEntryFlash(round,a)>0);assert.equal(a.utils,0);assert(visible.stun>0);assert.equal(hidden.stun,0);assert.equal(events.filter(e=>e.type==='flash_hit').length,1);assert.equal(abilities.onEntryFlash(round,a),0);
});
test('stopping a move releases its reserved destination without teleporting the player',()=>{
 const u={id:'a',name:'a',position:{x:35,y:10},node:'from',moving:{from:'from',to:'to',post:'reserved'}};const events=[],r={map:{nodes:{from:{x:10,y:10},to:{x:80,y:10}}},postOcc:{reserved:u},occ:{from:new Set(),to:new Set()},emit:(type,e)=>events.push({type,...e})};movement.interruptMove.call(r,u,'contact');assert.equal(r.postOcc.reserved,undefined);assert.deepEqual(u.position,{x:35,y:10});assert.equal(u.moving,null);assert.equal(events[0].type,'move_stop');
});
test('indexed floor-ray results equal exhaustive polygon intersections across narrow holes and grid boundaries',()=>{
 const {intersects}=require('../geometry');const g=new GeometryV2({schemaVersion:2,floorContours:[rect(0,0,200,200),rect(63.95,30,.1,130),rect(110,70,40,20)]});
 for(let x=5;x<200;x+=13)for(let y=5;y<200;y+=17){const a={x,y},b={x:195-x/2,y:200-y};const exact=g.inFloor(a)&&g.inFloor(b)&&!g.walls.some(([c,d])=>intersects(a,b,c,d));assert.equal(g.floorSegment(a,b),exact,JSON.stringify([a,b]));}
});
test('replay motion remains stopped during a stun and resumes from the remaining travel time',()=>{
 const map={nodes:{from:{x:0,y:0},to:{x:100,y:0}},posts:{}},events=[{type:'round_start',t:0,units:[{id:'a',name:'a',node:'from'}]},{type:'move',unitId:'a',t:0,to:'to',ticks:10,route:[{x:0,y:0},{x:100,y:0}]},{type:'move_pause',unitId:'a',t:2,x:20,y:0},{type:'move_resume',unitId:'a',t:4,x:20,y:0,total:10,left:8}];assert.deepEqual(snapshotAt(events,3,map).units.a.position,{x:20,y:0});assert.deepEqual(snapshotAt(events,5,map).units.a.position,{x:30,y:0});assert.deepEqual(snapshotAt(events,12,map).units.a.position,{x:100,y:0});
});
test('spatial support uses the fastest legal route, while legacy journals keep their original hop order',()=>{
 const {GameMap}=require('../gamemap'),data={nodes:{a:{},b:{},c:{}},edges:[{a:'a',b:'c',ticks:15},{a:'a',b:'b',ticks:1},{a:'b',b:'c',ticks:1}]},modern=new GameMap({...data,strictSpatial:true}),legacy=new GameMap(data);assert.equal(modern.nextHop.a.c,'b');assert.equal(modern.travelTime('a','c'),2);assert.equal(legacy.nextHop.a.c,'c');
});
