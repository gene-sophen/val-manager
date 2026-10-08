// Pure, read-only probes of mixed spatial/legacy mechanics.
const fs=require('node:fs'),registry=require('../引擎/maps/combat-registry'),abilities=require('../引擎/abilities'),{canObserve}=require('../引擎/observation'),{hitChance}=require('../引擎/actions');
const findings=[];
for(const id of ['split','sunset','ascent']){
 const map=id==='ascent'?new(require('../引擎/gamemap').GameMap)(require('../引擎/maps/ascent-combat-v5.json'),require('../引擎/maps/ascent-geometry-v5.json')):registry.get(id);
 const sight=map.data.sightlines.find(([a,b])=>Object.values(map.data.sites).includes(map.posts[a].node)&&map.posts[a].node!==map.posts[b].node&&map.data.staticVisibility[a][b]>0),[a,b]=sight;
 const make=(key,side)=>({id:side,side,name:side,alive:true,node:map.posts[key].node,position:{x:map.posts[key].x,y:map.posts[key].y},post:key,aim:80,sen:80,syn:80,gun:2,armor:'heavy',holdTicks:2,stun:0});
 const atk=make(a,'atk'),def=make(b,'def'),r={map,t:1,doors:{...map.geometry.data.initialDoors},geometrySmokes:[],smokedSight:{},units:[atk,def]};
 const before=canObserve(r,atk,def);abilities.smokeSightlinesInto(r,atk.node,10,10000);const after=canObserve(r,atk,def),legacySmokeApplied=!!r.smokedSight[map.postKey(a,b)];
 const chance=hitChance(atk,def,false,map,r.t);def.cover=1;const changedCover=hitChance(atk,def,false,map,r.t);
 findings.push({map:id,pair:[a,b],before,after,legacySmokeApplied,hitChance:chance,hitChanceWithTargetCover1:changedCover,ruleOverrides:map.data.roundRules,clock:map.data.tickSeconds,thinkInterval:require('../引擎/config').brain.thinkInterval});
}
// Both units get the same visible contact at t=0. Only change iteration order.
const combat=require('../引擎/combat');
function flashOrder(first){
 const units=['atk','def'].map(side=>({id:side,side,name:side,alive:true,position:{x:side==='atk'?10:30,y:20},node:'site',skills:{},utils:1,aim:70,sen:70,syn:70,stun:0,gun:2,holdTicks:2})),events=[];
 const r={units:first==='atk'?units:units.slice().reverse(),t:0,map:{data:{strictSpatial:true,spatialFire:'shared-los'},engagements:{query:()=>({visible:1})}},lastFlashTick:{atk:-99,def:-99},stats:{utilsAtk:0,utilsDef:0,utilsByType:{flash:0}},rng:()=>0,thinkUse:()=>true,synFactor:()=>1,emit:(type,data)=>events.push({type,...data})};
 r.visibleEnemiesAt=u=>units.filter(e=>canObserve(r,u,e));combat.resolveTimedFire.call(r);
 return {first,contacts:events.filter(e=>e.type==='contact').map(e=>e.side),flashHits:events.filter(e=>e.type==='flash_hit').map(e=>e.unitId),units:units.map(u=>({side:u.side,stun:u.stun,fireReadyAt:u.fireReadyAt??null}))};
}
const flashOrderProbe=[flashOrder('atk'),flashOrder('def')];
const output={findings,flashOrderProbe};fs.writeFileSync('docs/validation/2026-10-06-side-bias/model-probes.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
