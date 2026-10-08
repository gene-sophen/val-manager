// Equal-rifle, equal-attributes rounds: no economy, heroes, cards or coaches.
const fs=require('node:fs'),{RoundSim}=require('../引擎/round'),{buildIntent}=require('../引擎/tactics'),{mulberry32}=require('../引擎/rng'),registry=require('../引擎/maps/combat-registry');
const result={purpose:'Small diagnostic matrix, two seeds/cell; not a release balance estimate',maps:[]};
for(const id of ['split','sunset','ascent']){
 const base=id==='ascent'?new(require('../引擎/gamemap').GameMap)(require('../引擎/maps/ascent-combat-v5.json'),require('../引擎/maps/ascent-geometry-v5.json')):registry.get(id),map=Object.create(base);map.data={...base.data,externalEffectsVersion:null,objectiveModel:'defuse-v2'};
 const cells=[];for(const a of ['rush','mid','fake','lurk','contact'])for(const d of ['push','hold','trap','flank','retake']){
  let wins=0,first=0,plants=0;for(let n=0;n<2;n++){
   let seed=2166136261;for(const c of `${id}:${a}:${d}:${n}`){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}const rng=mulberry32(seed>>>0),units=(side)=>Array.from({length:5},(_,i)=>({id:side+i,name:side+i,side,sideIdx:i,aim:70,sen:70,syn:70,gun:2,utils:0,armor:'heavy',mentality:0})),events=[];
   const r=new RoundSim({map,atkUnits:units('atk'),defUnits:units('def'),atkFamily:a,defFamily:d,atkIntent:buildIntent(map,'atk',a,rng),defIntent:buildIntent(map,'def',d,rng),rng,hooks:{onRoundStart:[],beforeDecision:[],beforeKillRoll:[],onKill:[]},logger:e=>events.push(e)}).run();wins+=r.winner==='atk';first+=events.find(e=>e.type==='kill')?.side==='atk';plants+=r.planted;
  }cells.push({attack:a,defense:d,rounds:2,atkWins:wins,atkFirstKills:first,plants});
 }
 const item={id,rounds:cells.length*2,atkWins:cells.reduce((s,c)=>s+c.atkWins,0),atkFirstKills:cells.reduce((s,c)=>s+c.atkFirstKills,0),cells};result.maps.push(item);console.log(JSON.stringify({id,rounds:item.rounds,atkWins:item.atkWins,atkFirstKills:item.atkFirstKills}));
 fs.writeFileSync('docs/validation/2026-10-06-side-bias/tactic-matrix.json',JSON.stringify(result,null,2)+'\n');
}
