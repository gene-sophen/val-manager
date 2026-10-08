const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {GameMap}=require('../引擎/gamemap'),S=require('./spatial-match'),{routePoint}=require('../引擎/geometry');
const data=require('../引擎/maps/ascent-combat-v4.json'),geometry=require('../引擎/maps/ascent-geometry-v4.json'),map=new GameMap(data,geometry);
const actor=(id,side)=>({id,post:id,side,alive:true,node:data.positions[id].area,position:{x:data.positions[id].x,y:data.positions[id].y}}),ids=Object.keys(data.positions),states=[];
for(let i=0;i<200;i++){
 const a=actor(ids[i%ids.length],'atk'),b=actor(ids[(i*7+13)%ids.length],'def'),round={map,t:i*.25};
 if(i%3===0){a.moving={to:a.node};const edge=data.edges[i%data.edges.length];a.position=routePoint(edge.route,(i%11)/10);}
 if(i%7===0)round.geometrySmokes=[{x:542,y:663,radius:24,until:100000}];
 states.push({a,b,round});
}
let mismatches=0;for(const {a,b,round}of states){const direct=map.geometry.contains(a.position)&&map.geometry.contains(b.position)?map.geometry.visibleFraction(a.position,b.position,{smokes:round.geometrySmokes||[]}):0;if(map.engagements.query(round,a,b).visible!==direct)mismatches++;}
// Workload has six consumers of the same pair per tick, as observation, AI,
// contact, damage and reporting commonly reuse a query. Both get the same rays.
function benchmark(layered){const start=performance.now();let checksum=0;for(let n=0;n<80;n++)for(const [i,{a,b,round}]of states.entries()){round.t=(n*200+i)*.25;for(let consumer=0;consumer<6;consumer++)checksum+=layered?map.engagements.query(round,a,b).visible:map.geometry.visibleFraction(a.position,b.position,{smokes:round.geometrySmokes||[]});}return {ms:performance.now()-start,checksum};}
benchmark(false);benchmark(true);const direct=benchmark(false),layered=benchmark(true);
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:50,临场:50,声望:50},mapKnowledge:{ascent:50}}),cases=[],totals={maps:0,rounds:0,attackWins:0,shots:0,shotsThroughStaticWalls:0,angleChecks:0,contacts:0};
const began=performance.now();
for(let i=0;i<10;i++)for(const side of ['attack','defense']){const order=Array.from({length:5},(_,n)=>(i+n)%5),priority={attack:order,defense:order};const m=S.simulate('layered-audit:'+i,team('A'),team('B'),priority,{version:4,side,awayPriority:priority,onRound:record=>{
 for(const e of record.events){if(e.type==='angle_check')totals.angleChecks++;if(e.type==='contact')totals.contacts++;if(e.type==='shot'){totals.shots++;if(map.geometry.visibleFraction({x:e.x,y:e.y},{x:e.targetX,y:e.targetY})<=0)totals.shotsThroughStaticWalls++;}}
 }});for(const r of m.rounds){totals.rounds++;totals.attackWins+=(r.side==='attack')===r.win;}totals.maps++;cases.push({seed:'layered-audit:'+i,side,home:m.home,away:m.away,rounds:m.rounds.length});if(totals.maps%10===0)console.log(JSON.stringify(totals));}
totals.attackWinRate=totals.attackWins/totals.rounds;totals.elapsedMs=performance.now()-began;
const report={version:4,layoutVersion:data.layoutVersion,layerCounts:data.layerCounts,queries:{sampleStates:states.length,mismatches,direct,layered,stats:map.engagements.stats,note:'固定 200 个定点/移动/烟遮挡状态，每状态每 tick 六个消费者；80 次重复。微基准不能代表整个赛年耗时或设备帧率。'},totals,cases,releaseGate:false,note:'20 场新种子成对交换攻防，只用于结构/事件诊断；不代表发布平衡通过，也不能与 v3 不同样本直接推断因果。'};
const out=path.resolve('docs/validation/2026-10-06-layered-engagements/audit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.queries));console.log(JSON.stringify(totals));
if(mismatches||direct.checksum!==layered.checksum||totals.shotsThroughStaticWalls)process.exitCode=1;
