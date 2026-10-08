// Diagnostic-only instrumentation/ablation. Never changes production modules on disk.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const mode=process.argv[2]||'baseline',ids=(process.argv[3]||'ascent,haven,split,sunset,breeze,lotus,fracture,abyss,summit').split(','),seeds=Number(process.argv[4]||2);
const supported=['baseline','symmetric','no-skills','direct-retake','fast-brain','def-first-fire'];
if(!supported.includes(mode)||!Number.isInteger(seeds)||seeds<1||seeds>4)throw Error('Invalid diagnostic mode/sample');
const cfg=require('../引擎/config'),abilities=require('../引擎/abilities'),{RoundSim}=require('../引擎/round');
if(mode==='no-skills'){
 abilities.candidates=()=>[];abilities.triggerCast=()=>null;abilities.onEntryFlash=()=>0;abilities.onCommitSmoke=()=>false;abilities.onDefuseSmoke=()=>{};abilities.onDeath=()=>{};abilities.tick=()=>{};
 RoundSim.prototype.preplaceUtility=function(){};
 abilities.mount=()=>{};abilities.findSkill=()=>null;RoundSim.prototype.doRecon=function(){};
}
if(mode==='fast-brain')cfg.brain.thinkInterval=1;
if(mode==='def-first-fire'){
 const fire=RoundSim.prototype.resolveTimedFire;
 RoundSim.prototype.resolveTimedFire=function(){const units=this.units;this.units=[...this.def,...this.atk];try{return fire.call(this);}finally{this.units=units;}};
}
if(mode==='direct-retake'){
 const defCandidates=RoundSim.prototype.defCandidates;
 RoundSim.prototype.defCandidates=function(u){
  if(this.planted&&!u.saved&&!this.visibleEnemiesAt(u).length&&!this.flags.siteCleared){
   if(u.node!==this.map.siteNode(this.plantSite))return [{action:'push',prior:100,node:this.map.siteNode(this.plantSite),mode:'run'}];
  }
  return defCandidates.call(this,u);
 };
}
const S=require('./spatial-match'),cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]};
const output=path.resolve(process.argv[5]||'docs/validation/2026-10-06-ascent-balance/diagnostic');fs.mkdirSync(output,{recursive:true});
const report={mode,seedsPerMap:seeds,scope:'Small fixed-seed paired diagnostic; ablations change random draw streams, not release balance or causal percentage attribution.',sources:['引擎/round.js','引擎/brain.js','引擎/combat.js','引擎/movement.js','引擎/abilities.js','游戏/spatial-match.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),maps:[],rounds:[]};
let live=null;
const physical=(r,u)=>{const route=r.map.geometry.route(u.position,r.spike.position,{doors:r.doors});return route?route.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-route[i].x,p.y-route[i].y),0)/(r.map.data.navigationSpeed?.run||32):null;};
const oldRun=RoundSim.prototype.run;
RoundSim.prototype.run=function(){
 const d={map:live.map,seed:live.seed,initialSide:live.side,number:live.number++,atkFamily:this.atkFamily,defFamily:this.defFamily,start:this.units.map(u=>({id:u.id,side:u.side,gun:u.gun,node:u.node,post:u.post})),plant:null,cleared:null,crossNodeShots:0,shots:{atk:0,def:0},flashHits:{atk:0,def:0},supportCalls:[],supportArrivals:[],decisions:{atk:0,def:0},defuseNoEnemyOpportunities:0};this._biasDiag=d;
 const result=oldRun.call(this),events=this._roundEvents||[],unitSides=Object.fromEntries(d.start.map(u=>[u.id,u.side]));
 d.winner=result.winner;d.reason=result.reason;d.ticks=result.ticks;d.firstKill=events.find(e=>e.type==='kill')||null;d.firstContact=events.find(e=>e.type==='contact')?.t??null;
 d.endAlive={atk:this.aliveCount('atk'),def:this.aliveCount('def')};d.defuses=events.filter(e=>['defuse_start','defuse_abort','defuse'].includes(e.type));
 d.saves=events.filter(e=>e.type==='save'||e.type==='save_cancel');d.retake=events.find(e=>e.type==='retake')||null;
 d.abilities={atk:0,def:0};for(const e of events)if(e.type==='ability'&&!e.fumble&&e.side in d.abilities)d.abilities[e.side]++;
 d.doorBlocks=events.filter(e=>e.type==='move_stop'&&e.reason==='blocked-door-or-wall').length;
 d.trace=events.filter(e=>['plant','site_cleared','defuse_start','defuse_abort','defuse','save','save_cancel','support_call','support_move','retake','kill','molly_block','molly_entry','round_end'].includes(e.type));
 report.rounds.push(d);return result;
};
const oldEmit=RoundSim.prototype.emit;
RoundSim.prototype.emit=function(type,data){
 const d=this._biasDiag;
 if(d){
  if(type==='plant')d.plant={t:this.t,site:this.plantSite,atk:this.aliveCount('atk'),def:this.aliveCount('def'),defenders:this.def.filter(u=>u.alive).map(u=>({id:u.id,node:u.node,moving:!!u.moving,saved:!!u.saved,position:{...u.position},travel:physical(this,u)}))};
  if(type==='site_cleared')d.cleared={t:this.t,left:this.spikeLeft,denyUntil:this.mollyZone?.deny?this.mollyZone.until:null,defenders:this.def.filter(u=>u.alive).map(u=>({id:u.id,node:u.node,saved:!!u.saved,moving:!!u.moving,stun:u.stun,defusing:u.defusing,position:{...u.position},travel:physical(this,u)}))};
  if(type==='shot'){const u=this.units.find(u=>u.id===data.actorId),v=this.units.find(u=>u.id===data.targetId);d.shots[u.side]++;if(u.node!==v.node)d.crossNodeShots++;}
  if(type==='flash_hit'){const v=this.units.find(u=>u.id===data.unitId);if(v)d.flashHits[v.side==='atk'?'def':'atk']++;}
  if(type==='support_call')d.supportCalls.push({t:this.t,...data});
 }
 return oldEmit.call(this,type,data);
};
const oldExec=RoundSim.prototype.execAction;
RoundSim.prototype.execAction=function(u,c){
 const d=this._biasDiag;if(d){d.decisions[u.side]++;if(u.side==='def'&&this.planted&&!this.visibleEnemiesAt(u).length&&u.node===this.map.siteNode(this.plantSite)&&!this.flags.siteCleared)d.defuseNoEnemyOpportunities++;}
 return oldExec.call(this,u,c);
};
const oldEntry=RoundSim.prototype.entryFight;
RoundSim.prototype.entryFight=function(u){
 if(u.side==='def'&&u.supportOrder&&u.node===this.map.siteNode(u.supportOrder.site))this._biasDiag?.supportArrivals.push({id:u.id,t:this.t,node:u.node});
 return oldEntry.call(this,u);
};
const pct=(n,d)=>d?+(100*n/d).toFixed(1):null;
function summarize(rs){const plants=rs.filter(r=>r.plant),cleared=rs.filter(r=>r.reason==='explosion'&&r.cleared),stats={rounds:rs.length,atkWins:rs.filter(r=>r.winner==='atk').length,plants:plants.length,plantWins:plants.filter(r=>r.winner==='atk').length,firstKillAtk:rs.filter(r=>r.firstKill?.side==='atk').length,firstKillDef:rs.filter(r=>r.firstKill?.side==='def').length,atkWinsAfterDefFirstKill:rs.filter(r=>r.firstKill?.side==='def'&&r.winner==='atk').length,plantEvenOrBehind:plants.filter(r=>r.plant.atk<=r.plant.def).length,plantEvenOrBehindWins:plants.filter(r=>r.plant.atk<=r.plant.def&&r.winner==='atk').length,plantDefAlive0:plants.filter(r=>r.plant.def===0).length,plantDefAlive1:plants.filter(r=>r.plant.def===1).length,plantDefAlive2:plants.filter(r=>r.plant.def===2).length,plantDefAlive3plus:plants.filter(r=>r.plant.def>=3).length,defuses:rs.filter(r=>r.reason==='defuse').length,explosions:rs.filter(r=>r.reason==='explosion').length,clearedExplosions:cleared.length,clearImpossible:cleared.filter(r=>!r.cleared.defenders.some(d=>d.travel!==null&&r.cleared.left>=d.travel+7)).length,clearFeasible:cleared.filter(r=>r.cleared.defenders.some(d=>d.travel!==null&&r.cleared.left>=d.travel+7)).length,clearLateUnder7:cleared.filter(r=>r.cleared.left<7).length,supportRoundCalls:rs.filter(r=>r.supportCalls.length).length,supportRoundArrivedBeforePlant:plants.filter(r=>r.supportArrivals.some(a=>a.t<=r.plant.t)).length,supportRoundCalledButNoArrivalBeforePlant:plants.filter(r=>r.supportCalls.some(a=>a.t<r.plant.t)&&!r.supportArrivals.some(a=>a.t<=r.plant.t)).length,shotsAtk:rs.reduce((s,r)=>s+r.shots.atk,0),shotsDef:rs.reduce((s,r)=>s+r.shots.def,0),crossNodeShots:rs.reduce((s,r)=>s+r.crossNodeShots,0),flashHitsAtk:rs.reduce((s,r)=>s+r.flashHits.atk,0),flashHitsDef:rs.reduce((s,r)=>s+r.flashHits.def,0),abilityAtk:rs.reduce((s,r)=>s+r.abilities.atk,0),abilityDef:rs.reduce((s,r)=>s+r.abilities.def,0)};stats.atkPercent=pct(stats.atkWins,stats.rounds);stats.plantPercent=pct(stats.plants,stats.rounds);stats.postplantAtkPercent=pct(stats.plantWins,stats.plants);return stats;}
function save(){report.total=summarize(report.rounds);report.byAttack=Object.fromEntries(['rush','mid','fake','lurk','contact'].map(k=>[k,summarize(report.rounds.filter(r=>r.atkFamily===k))]));report.byDefense=Object.fromEntries(['push','hold','trap','flank','retake'].map(k=>[k,summarize(report.rounds.filter(r=>r.defFamily===k))]));report.complete=report.maps.length===ids.length;fs.writeFileSync(path.join(output,mode+'.json'),JSON.stringify(report,null,2)+'\n');}
for(const id of ids){const before=report.rounds.length;
 for(let n=0;n<seeds;n++)for(const side of ['attack','defense']){const key=(id==='ascent'?'diagnostic-v5-':'diagnostic-v6-')+id+(n?'-sample-'+n:'');live={map:id,seed:key,side,number:1};S.simulate(key,team('A'),team('B'),priority,{mapId:id,version:id==='ascent'?5:6,side,behaviorVersion:process.argv[6],...(mode==='symmetric'?{awayPriority:priority}:{})});}
 const stats={id,...summarize(report.rounds.slice(before))};report.maps.push(stats);save();console.log(JSON.stringify(stats));
}
save();console.log(JSON.stringify(report.total));
