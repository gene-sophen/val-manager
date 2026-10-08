const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),O=require('../round-outcome');
const {GameMap}=require('../../引擎/gamemap'),map=new GameMap(S.mapDataV4,require('../../引擎/maps/ascent-geometry-v4.json'));
const cards=require('../catalog').cards.filter(c=>c.team==='EDG'&&c.tier!=='钻').slice(0,5),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]},team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:50,临场:50,声望:50},mapKnowledge:{ascent:50}});
test('v4 replay shots have physical sight and frozen journals restore including later tactical changes',()=>{
 const a=team('A'),b=team('B'),m=O.create('v4-restore','ascent');S.initialize(m,a,b,priority,null,{version:4});
 for(let i=0;i<3;i++)S.step(m,a,b,priority);const copy=JSON.parse(JSON.stringify(m));assert.equal(m.spatial.initial.ruleVersion,'spatial-4');
 const changed={attack:[2,1,0,3,4],defense:[4,1,2,0,3]};S.requestTimeout(m);S.requestTimeout(copy);assert.deepEqual(S.step(m,a,b,changed),S.step(copy,a,b,changed));assert.equal(JSON.stringify(m),JSON.stringify(copy));
 const record=S.replay(m,2);let shots=0;for(const e of record.events.filter(e=>e.type==='shot')){shots++;assert(e.visibleFraction>0);assert(map.geometry.visibleFraction({x:e.x,y:e.y},{x:e.targetX,y:e.targetY})>0);assert('window'in e);}
 assert(shots>0);for(let t=0;t<=record.ticks;t+=.25)for(const u of Object.values(S.frame(record,t).units))assert(map.geometry.contains(u.position),u.name+' at '+t);
});
test('v4 rejects a v3 layout and delivered browser bundle executes identical shots and frames',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ctx={structuredClone};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/spatial-engine.js'),'utf8'),ctx);
 const a=team('A'),b=team('B'),m=O.create('v4-browser','ascent'),w=O.create('v4-browser','ascent');S.initialize(m,a,b,priority,null,{version:4});ctx.SPATIAL_MATCH.initialize(w,a,b,priority,null,{version:4});
 for(let i=0;i<3;i++){S.step(m,a,b,priority);ctx.SPATIAL_MATCH.step(w,a,b,priority);assert.equal(JSON.stringify(w.replay),JSON.stringify(m.replay));for(let t=0;t<=m.replay.ticks;t+=1)assert.equal(JSON.stringify(ctx.SPATIAL_MATCH.frame(w.replay,t)),JSON.stringify(S.frame(m.replay,t)));}
 const invalid=JSON.parse(JSON.stringify(m));invalid.spatial.initial.layoutVersion=S.mapDataV3.layoutVersion;const before=JSON.stringify(invalid);assert.throws(()=>S.step(invalid,a,b,priority),/版本不匹配/);assert.equal(JSON.stringify(invalid),before);
});
