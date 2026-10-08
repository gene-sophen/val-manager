const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../spatial-match'),R=require('../round-outcome'),registry=require('../../引擎/maps/combat-registry');
const cards=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]};
test('local pose revisions remain reachable, bounded and isolated from original map data',()=>{
 for(const id of S.mapIds){const base=registry.get(id),before=JSON.stringify(base.data),map=require('../../引擎/maps/balance-geometry').prepare(base);
  for(const c of map.data.poseCorrections){assert(Math.hypot(c.to.x-c.from.x,c.to.y-c.from.y)<=9.001);assert(map.geometry.canWalk(c.from,c.to));}
  for(const p of Object.values(map.posts))assert(map.geometry.contains(p));assert.equal(JSON.stringify(base.data),before,id);
 }
});
test('every new map revision restores its journal and browser events with physical legal shots',()=>{
 const ctx={structuredClone};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/spatial-engine.js'),'utf8'),ctx);
 for(const id of S.mapIds){
  const behaviorVersion=id+'-balance-1',a=team('A'),b=team('B'),m=R.create('new-policy:'+id,id),w=R.create('new-policy:'+id,id),options={version:6,behaviorVersion};
  S.initialize(m,a,b,priority,null,options);ctx.SPATIAL_MATCH.initialize(w,a,b,priority,null,options);
  S.step(m,a,b,priority);ctx.SPATIAL_MATCH.step(w,a,b,priority);assert.equal(JSON.stringify(m.replay),JSON.stringify(w.replay),id);assert.equal(S.replayMap(m.replay).physicsRevision,id+'-guard-poses-1');
  const copy=structuredClone(m);S.step(m,a,b,priority);S.step(copy,a,b,priority);assert.deepEqual(copy,m,id);
  for(const e of m.replay.events.filter(e=>e.type==='shot'))assert(S.combatGeometry(id,behaviorVersion).canShoot({x:e.x,y:e.y},{x:e.targetX,y:e.targetY},{doors:e.doors}),id+' blocked shot');
 }
});
