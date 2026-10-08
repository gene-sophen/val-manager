// Standalone numerical diagnostics, never opens a personal/default database.
const fs=require('node:fs'),path=require('node:path'),S=require('./spatial-match'),H=require('./team-style'),A=require('./agent-selection');
const [id='split',label='engine-dev-v1',pairs='4',behavior=id+'-balance-1',club='BLG',styled='false',namespace=label]=process.argv.slice(2),folder=path.resolve('docs/validation/2026-10-07-engine-completion',id,label);
if(fs.existsSync(path.join(folder,'results.json')))throw Error('Use a new audit label; previous evidence must be retained');fs.mkdirSync(folder,{recursive:true});
const seen=new Set(),players=require('./catalog').cards.filter(p=>p.team===club&&p.tier!=='钻'&&!seen.has(p.name)&&(seen.add(p.name),true)).slice(0,5),agentPicks=A.recommend(players,require('../引擎/agents').allAgents(),id).agents;
if(players.length!==5||!Number.isInteger(+pairs)||+pairs<1||+pairs>100)throw Error('Invalid diagnostic input');
const team=k=>({id:k,players,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70},...(styled==='true'?{tacticalProfile:H.create('mirror-'+club,'same')}:{} )});
const result={id,label,behavior,club,agents:agentPicks,styled,rounds:0,atk:0,def:0,firstAtk:0,firstDef:0,plants:0,plantAdv:0,defuses:0,skills:{},byFamily:{},matches:[]};
for(let n=0;n<+pairs;n++)for(const side of ['attack','defense']){
 const order=(xs,k)=>xs.slice(k).concat(xs.slice(0,k)),priority={attack:order([0,1,2,3,4],n%5),defense:order([1,0,2,3,4],n%5)},rounds=[];
 S.simulate(id+'-'+namespace+'-'+n,team('A'),team('B'),priority,{mapId:id,version:6,behaviorVersion:behavior,side,awayPriority:priority,onRound:r=>{
  const ev=r.events,end=ev.find(e=>e.type==='round_end'),first=ev.find(e=>e.type==='kill'),meta=ev.find(e=>e.type==='round_meta'),plant=ev.find(e=>e.type==='plant'),killed=ev.filter(e=>e.type==='kill');result.rounds++;result[end.winner]++;if(first)result[first.side==='atk'?'firstAtk':'firstDef']++;if(end.reason==='defuse')result.defuses++;
  const atPlant=plant?{atk:5-killed.filter(e=>e.t<=plant.t&&e.side==='def').length,def:5-killed.filter(e=>e.t<=plant.t&&e.side==='atk').length}:null;if(plant){result.plants++;if(atPlant.atk>atPlant.def)result.plantAdv++;}
  const key=meta.defFamily;result.byFamily[key]??={rounds:0,atk:0,def:0,plants:0,firstAtk:0};const f=result.byFamily[key];f.rounds++;f[end.winner]++;if(plant)f.plants++;if(first?.side==='atk')f.firstAtk++;
  for(const e of ev.filter(e=>e.type==='ability')){const key=e.side+':'+e.archetype;result.skills[key]=(result.skills[key]||0)+1;}
  rounds.push({round:r.round,winner:end.winner,reason:end.reason,attack:meta.atkFamily,defense:meta.defFamily,first:first&&{killer:first.killer,victim:first.victim,side:first.side,t:first.t},plant:plant&&{site:plant.site,t:plant.t,...atPlant},support:ev.filter(e=>e.type==='support_call').length,arrivals:ev.filter(e=>e.type==='support_arrive').length});
  if(n===0)fs.writeFileSync(path.join(folder,'trace-'+side+'-'+r.round+'.json'),JSON.stringify(r));
 }});result.matches.push({n,side,rounds});result.attackPercent=100*result.atk/result.rounds;fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({id,label,n,side,atk:result.attackPercent}));
}
console.log(JSON.stringify({...result,matches:undefined}));
