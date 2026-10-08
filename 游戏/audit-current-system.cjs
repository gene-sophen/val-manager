// Read-only fixed-sample audit of the current independent spatial behavior.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),S=require('./spatial-match');
const output=path.resolve(process.argv[2]||'docs/validation/2026-10-06-ascent-balance/all-map-check'),seeds=Number(process.argv[3]||2);
if(!Number.isInteger(seeds)||seeds<1||seeds>20)throw Error('Use 1–20 seeds for diagnostics, not a release claim');
fs.mkdirSync(output,{recursive:true});
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]};
const sources=['游戏/spatial-match.js','引擎/brain.js','引擎/round.js','引擎/combat.js','引擎/movement.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={date:'2026-10-06',behaviorVersion:'mixed',behaviors:{ascent:'ascent-balance-4',otherMaps:'objective-2'},releaseGate:false,samplePurpose:'Equal player/team/coach values, fixed tactical priorities, paired starting sides; small diagnostic sample, not balanced across all tactical/hero compositions. Round share is not team map-win probability.',seedsPerMap:seeds,maps:[],sources};
const save=()=>{const keys=['matches','rounds','attackerWins','defenderWins','plants','defuses','explosions','timeouts','clearedExplosions','spikeRedrops','blockedShots'];report.totals=Object.fromEntries(keys.map(k=>[k,report.maps.reduce((s,m)=>s+m[k],0)]));report.totals.attackerWinPercent=report.totals.rounds?+(100*report.totals.attackerWins/report.totals.rounds).toFixed(1):null;report.totals.defenderWinPercent=report.totals.rounds?+(100*report.totals.defenderWins/report.totals.rounds).toFixed(1):null;report.complete=report.maps.length===9;fs.writeFileSync(path.join(output,'winrates.json'),JSON.stringify(report,null,2)+'\n');};
for(const id of ['ascent',...S.mapIds]){
 const stats={id,version:id==='ascent'?5:6,matches:0,rounds:0,attackerWins:0,defenderWins:0,plants:0,defuses:0,explosions:0,timeouts:0,clearedExplosions:0,spikeRedrops:0,blockedShots:0};
 const start=performance.now(),G=id==='ascent'?new (require('../引擎/gamemap').GameMap)(S.mapDataV5,require('../引擎/maps/ascent-geometry-v5.json')).geometry:require('../引擎/maps/combat-registry').get(id).geometry;
 for(let seed=0;seed<seeds;seed++)for(const side of ['attack','defense']){
  const prefix=id==='ascent'?'diagnostic-v5-':'diagnostic-v6-',key=prefix+id+(seed?'-sample-'+seed:'');
  const m=S.simulate(key,team('A'),team('B'),priority,{mapId:id,version:stats.version,side,onRound:r=>{
   const end=r.events.find(e=>e.type==='round_end'),plant=r.events.find(e=>e.type==='plant');stats.rounds++;end.winner==='atk'?stats.attackerWins++:stats.defenderWins++;if(plant)stats.plants++;if(end.reason==='defuse')stats.defuses++;if(end.reason==='explosion'){stats.explosions++;if(r.events.some(e=>e.type==='site_cleared'))stats.clearedExplosions++;}if(end.reason==='timeout')stats.timeouts++;
   if(plant&&r.events.some(e=>e.type==='spike_drop'&&e.t>plant.t))stats.spikeRedrops++;
   for(const e of r.events)if(e.type==='shot'&&!G.canShoot({x:e.x,y:e.y},{x:e.targetX,y:e.targetY},{doors:e.doors}))stats.blockedShots++;
  }});
  if(m.spatial.initial.behaviorVersion!==(id==='ascent'?'ascent-balance-4':'objective-2'))throw Error('Audit must run the fixed behavior');stats.behaviorVersion=m.spatial.initial.behaviorVersion;stats.matches++;
 }
 stats.attackerWinPercent=+(100*stats.attackerWins/stats.rounds).toFixed(1);stats.defenderWinPercent=+(100*stats.defenderWins/stats.rounds).toFixed(1);stats.diagnosticSeconds=+((performance.now()-start)/1000).toFixed(3);report.maps.push(stats);save();console.log(JSON.stringify(stats));
}
console.log(JSON.stringify(report.totals));if(report.totals.spikeRedrops||report.totals.blockedShots)process.exitCode=1;
