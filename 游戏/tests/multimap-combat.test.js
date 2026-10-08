const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),O=require('../round-outcome'),registry=require('../../引擎/maps/combat-registry'),{buildIntent}=require('../../引擎/tactics');
const cards=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70},mapKnowledge:{haven:65}}),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]};
for(const id of S.mapIds){
 test(id+' has separate legal positions, physical connectors and ten map-specific intents',()=>{
  const map=registry.get(id),d=map.data,open={doors:Object.fromEntries(d.doorDefinitions.map(x=>[x.id,'open']))};assert.equal(d.id,id);assert.deepEqual(d.positions,d.posts);assert(d.layerCounts.positions>=50&&d.layerCounts.positions<=100);
  for(const p of Object.values(d.positions))assert(map.geometry.contains(p),id+' illegal stance '+p.name);
  for(const s of Object.keys(d.sites)){const node=map.nodes[d.sites[s]];assert(d.plantZones.some(c=>require('../../引擎/geometry-v2').inside(node,c.points.map(([x,y])=>({x,y})))));assert(map.nextHop.t_spawn[d.sites[s]]);}
  for(const e of d.edges)for(let i=1;i<e.route.length;i++)assert(e.traversal==='zipline'?map.geometry.onNavigationLink(e.route[i],'zipline'):map.geometry.canWalk(e.route[i-1],e.route[i],null,open),id+' '+e.a+' '+e.b);
  for(const [side,fs]of [['atk',['rush','mid','fake','lurk','contact']],['def',['push','hold','trap','flank','retake']]])for(const family of fs){const intent=buildIntent(map,side,family,()=>.8);assert.equal(intent.homes.length,5);for(const n of [...intent.homes,...Object.values(intent.routes).flat()])assert(map.nodes[n]);if(side==='def')for(const s of Object.keys(d.sites))assert(intent.homes.some(n=>map.region(n)===s));}
 });
 test(id+' replays real rays and restores the same map, effects and journal',()=>{
  const a=team('A'),b=team('B'),m=O.create('restore-'+id,id);S.initialize(m,a,b,priority,null,{version:6});assert.equal(m.spatial.initial.mapId,id);assert.equal(m.spatial.initial.effectsVersion,'card-effects-1');
  for(let i=0;i<3;i++)S.step(m,a,b,priority);const copy=structuredClone(m);assert.deepEqual(S.step(m,a,b,priority),S.step(copy,a,b,priority));assert.equal(JSON.stringify(m),JSON.stringify(copy));let shots=0;
  for(let n=1;n<=4;n++){const r=S.replay(m,n),g=registry.get(id).geometry;assert.equal(S.replayMap(r).id,id);for(const e of r.events.filter(e=>e.type==='shot')){shots++;assert(g.canShoot({x:e.x,y:e.y},{x:e.targetX,y:e.targetY},{doors:e.doors}),id+' blocked ray');}for(let t=0;t<=r.ticks;t+=.5){const f=S.frame(r,t);for(const u of Object.values(f.units))if(u.alive)assert(g.contains(u.position,{doors:f.doors})||u.moving?.traversal==='zipline'&&g.onNavigationLink(u.position,'zipline'),id+' invalid live frame '+t);}}
  assert(shots>0);const invalid=structuredClone(m);invalid.mapId=id==='haven'?'lotus':'haven';const before=JSON.stringify(invalid);assert.throws(()=>S.step(invalid,a,b,priority),/地图 ID/);assert.equal(JSON.stringify(invalid),before);
 });
}
test('unknown v6 layouts cannot silently replay on Ascent and map knowledge remains map-specific',()=>{
 assert.throws(()=>S.replayMap({layoutVersion:'future-combat-v6'}),/未知地图/);const m=O.create('knowledge','haven');S.initialize(m,team('A'),team('B'),priority,null,{version:6});assert.equal(m.spatial.initial.home.executionState.map,65);assert.throws(()=>S.initialize(O.create('bad','haven'),team('A'),team('B'),priority,null,{version:5}),/地图与模型/);
});
test('the generated browser bundle uses the same events on all eight maps',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ctx={structuredClone};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/spatial-engine.js'),'utf8'),ctx);
 for(const id of S.mapIds){const a=team('A'),b=team('B'),m=O.create('browser-'+id,id),w=O.create('browser-'+id,id);S.initialize(m,a,b,priority,null,{version:6});ctx.SPATIAL_MATCH.initialize(w,a,b,priority,null,{version:6});S.step(m,a,b,priority);ctx.SPATIAL_MATCH.step(w,a,b,priority);assert.equal(JSON.stringify(w.replay),JSON.stringify(m.replay),id);}
});

