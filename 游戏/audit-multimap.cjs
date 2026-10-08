// Diagnostic samples, deliberately not a balance/release acceptance gate.
const fs=require('node:fs'),path=require('node:path'),S=require('./spatial-match'),registry=require('../引擎/maps/combat-registry');
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]};
const output=path.resolve(process.argv[2]||'docs/validation/2026-10-06-multimap/audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});
const result={releaseGate:false,samplePurpose:'equal roster, one paired starting-side diagnostic per map; not enough samples to establish balance',maps:[],failures:[]};
for(const id of S.mapIds){
 const map=registry.get(id),g=map.geometry,stats={id,counts:map.data.layerCounts,maps:0,rounds:0,attackerWins:0,shots:0,blockedShots:0,moves:0,invalidRoutes:0,liveFrames:0,invalidFrames:0,doorEvents:0,objectDamage:0,ziplineMoves:0,plants:{},supportMoves:0,seconds:0};
 for(const side of ['attack','defense']){
  const start=performance.now();S.simulate('diagnostic-v6-'+id,team('A'),team('B'),priority,{mapId:id,version:6,side,onRound:r=>{
   stats.rounds++;const end=r.events.find(e=>e.type==='round_end');if(end.winner==='atk')stats.attackerWins++;
   let doors={...g.data.initialDoors};for(const e of r.events){
    if(e.type==='door'){doors[e.doorId]=e.state;stats.doorEvents++;}
    if(e.type==='object_damage')stats.objectDamage++;
    if(e.type==='support_move')stats.supportMoves++;
    if(e.type==='plant')stats.plants[e.site]=(stats.plants[e.site]||0)+1;
    if(e.type==='shot'){stats.shots++;if(!g.canShoot({x:e.x,y:e.y},{x:e.targetX,y:e.targetY},{doors:e.doors})){stats.blockedShots++;result.failures.push({id,side,round:r.round,type:'shot',t:e.t});}}
    if(e.type==='move'){stats.moves++;if(e.traversal==='zipline')stats.ziplineMoves++;if(e.route.some((p,i)=>i&&!g.canWalk(e.route[i-1],p,null,{doors})&&!(e.traversal==='zipline'&&g.onNavigationLink(e.route[i-1],'zipline')&&g.onNavigationLink(p,'zipline')))){stats.invalidRoutes++;result.failures.push({id,side,round:r.round,type:'move',t:e.t});}}
   }
   for(let t=0;t<=r.ticks;t+=1){const f=S.frame(r,t);for(const u of Object.values(f.units))if(u.alive){stats.liveFrames++;if(!g.contains(u.position,{doors:f.doors})&&!(u.moving?.traversal==='zipline'&&g.onNavigationLink(u.position,'zipline'))){stats.invalidFrames++;if(result.failures.length<100)result.failures.push({id,side,round:r.round,type:'frame',t,unit:u.id});}}}
  }});stats.maps++;stats.seconds+=(performance.now()-start)/1000;
 }
 stats.attackerWinPercent=+(100*stats.attackerWins/stats.rounds).toFixed(1);stats.seconds=+stats.seconds.toFixed(3);result.maps.push(stats);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(id,JSON.stringify(stats));
}
if(result.failures.length)process.exitCode=1;
