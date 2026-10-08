const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),O=require('../round-outcome'),fs=require('node:fs'),vm=require('node:vm');
const cards=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),priority={attack:[2,0,1,3,4],defense:[1,0,2,3,4]};
test('all nine autonomous maps retain physical shot validation, restored journals and browser equivalence',()=>{
 const x={structuredClone};vm.createContext(x);vm.runInContext(fs.readFileSync('设计文档/UI原型/complete-prototype-01/spatial-engine.js','utf8'),x);
 for(const id of ['ascent',...S.mapIds]){const a=team('A'),b=team('B'),m=O.create('agent-map:'+id,id),w=structuredClone(m),options={version:id==='ascent'?5:6,behaviorVersion:id==='ascent'?'ascent-balance-5':id+'-balance-3'};
  S.initialize(m,a,b,priority,null,options);x.SPATIAL_MATCH.initialize(w,a,b,priority,null,options);S.step(m,a,b,priority);x.SPATIAL_MATCH.step(w,a,b,priority);assert.equal(JSON.stringify(m.replay),JSON.stringify(w.replay),id);assert.equal(S.replayMap(m.replay).autonomyModel,'agents-1');
  for(const e of m.replay.events.filter(e=>e.type==='shot'))assert(S.combatGeometry(id,options.behaviorVersion).canShoot({x:e.x,y:e.y,z:e.sourceZ},{x:e.targetX,y:e.targetY,z:e.targetZ},{doors:e.doors}),id);
  const copy=structuredClone(m);assert.deepEqual(S.step(m,a,b,priority),S.step(copy,a,b,priority),id);assert(m.replay.events.some(e=>e.type==='agent_decision'),id);
 }
});
test('all nine feint teams move before execution rather than waiting in spawn',()=>{
 for(const id of ['ascent',...S.mapIds]){const a=team('A'),b=team('B'),m=O.create('feint-opening:'+id,id),options={version:id==='ascent'?5:6,behaviorVersion:id==='ascent'?'ascent-balance-5':id+'-balance-3'};
  S.initialize(m,a,b,priority,null,options);m.spatial.initial.home.tactics.atk={fake:1,rush:0,mid:0,lurk:0,contact:0};S.step(m,a,b,priority);const start=m.replay.events.find(e=>e.type==='round_start');assert.equal(start.atkFamily,'fake');
  for(const u of start.units.filter(u=>u.side==='atk')){const first=m.replay.events.find(e=>e.type==='move'&&e.unitId===u.id);assert(first,id+' / '+u.name);assert(first.t<=5,id+' / '+u.name+' waited '+first.t);}
 }
});
