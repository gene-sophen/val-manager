// Versioned standalone audit; never opens a personal or default database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),S=require('./spatial-match'),H=require('./team-style');
const [label='development',pairs='4',ids='ascent',mode='latest',seedGroup=label.replace(/-(old|new)$/,'')]=process.argv.slice(2);if(!Number.isInteger(+pairs)||+pairs<1||+pairs>100)throw Error('Invalid cohort size');
if(!['latest','old','control-guards','control-duels','lotus-flex-control'].includes(mode))throw Error('Unknown audit mode');
// Explicit diagnostic ablations run only inside this process. No production
// defaults or recorded career inputs are changed by these controls.
const autonomy=require('../引擎/agent-autonomy');
if(mode==='control-guards')autonomy.defCandidates=function(u){return require(this.map.data.id==='ascent'?'../引擎/ascent-behavior':'../引擎/spatial-behavior-v2').defCandidates.call(this,u);};
if(mode==='control-duels'){const original=autonomy.atkCandidates;autonomy.atkCandidates=function(u){if(this.visibleEnemiesAt(u).length){u.agentTarget=null;return null;}return original.call(this,u);};}
if(mode==='lotus-flex-control'){
 if(ids!=='lotus')throw Error('Lotus control must not alter another map');
 const profiles=require('../引擎/maps/balance-profiles-v2');profiles.lotus={...profiles.lotus,holdHomes:['a_site','a_stairs','b_site','c_site','c_waterfall']};
}
const catalog=require('./catalog').cards,clubs=['EDG','TE','BLG','DRG'],rotate=(xs,n)=>xs.slice(n).concat(xs.slice(0,n));
const tree=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?['tests','out','node_modules'].includes(e.name)?[]:tree(dir+'/'+e.name):/\.(js|json)$/.test(e.name)?[dir+'/'+e.name]:[]);
const sources=[...new Set([...tree('引擎'),...tree('游戏'),'游戏/audit-agent-autonomy.cjs','设计文档/UI原型/complete-prototype-01/spatial-engine.js','数据源/cards_full.json','数据源/diamond_cards.json'])].filter(f=>fs.existsSync(f)).sort();
const hashes=sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),sourceKey=crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),snapshot=path.resolve('docs/validation/2026-10-07-agent-autonomy/sources',sourceKey);
if(!fs.existsSync(snapshot)){for(const file of sources){const target=path.join(snapshot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}fs.writeFileSync(path.join(snapshot,'manifest.json'),JSON.stringify(hashes,null,2));}
for(const id of ids.split(',')){
 const version=id==='ascent'?5:6,behavior=id==='ascent'?(mode==='old'?'ascent-balance-4':'ascent-balance-5'):id+(mode==='old'?['split','fracture'].includes(id)?'-balance-2':'-balance-1':'-balance-3'),dir=path.resolve('docs/validation/2026-10-07-agent-autonomy',id,label);if(fs.existsSync(path.join(dir,'results.json')))throw Error('Choose a new label');fs.mkdirSync(dir,{recursive:true});
 const report={id,label,seedGroup,mode,behavior,experimental:!['latest','old'].includes(mode),...(mode==='lotus-flex-control'?{experiment:{holdHomes:['a_site','a_stairs','b_site','c_site','c_waterfall'],scope:'private diagnostic only; not a published behavior revision'}}:{}),pairs:+pairs,sourceKey,sourceSnapshot:snapshot,sources:hashes,matches:[],totals:{rounds:0,atk:0,def:0,shots:0,invalidShots:0,decisions:0,repositions:0,tradeChoices:0,feints:0,defuses:0,openingMoves:[],decisionReasons:{},families:{}}};
 for(let n=0;n<+pairs;n++)for(const side of ['attack','defense']){
  const seen=new Set(),players=catalog.filter(p=>p.team===clubs[n%4]&&p.tier!=='钻'&&!seen.has(p.name)&&(seen.add(p.name),true)).slice(0,5),team=k=>({id:k,players,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70},mapKnowledge:{[id]:50},tacticalProfile:H.create('agents:'+n,'mirror')}),priority=H.priorities(team('A').tacticalProfile),t=report.totals,match={n,side,club:clubs[n%4],rounds:0,atk:0,def:0},geometry=S.combatGeometry(id,behavior);
  const m=S.simulate(id+'-'+seedGroup+'-'+n,team('A'),team('B'),priority,{mapId:id,version,behaviorVersion:behavior,side,awayPriority:priority,onRound:r=>{
   const ev=r.events,end=ev.find(e=>e.type==='round_end'),start=ev.find(e=>e.type==='round_start');t.rounds++;t[end.winner]++;match.rounds++;match[end.winner]++;if(end.reason==='defuse')t.defuses++;
   const f=t.families[start.atkFamily+' / '+start.defFamily]??={rounds:0,atk:0,def:0};f.rounds++;f[end.winner]++;
   for(const e of ev){if(e.type==='shot'){t.shots++;if(!geometry.canShoot({x:e.x,y:e.y,...(e.sourceZ!=null?{z:e.sourceZ}:{})},{x:e.targetX,y:e.targetY,...(e.targetZ!=null?{z:e.targetZ}:{})},{doors:e.doors}))t.invalidShots++;}if(e.type==='agent_decision'){t.decisions++;t.decisionReasons[e.reason]=(t.decisionReasons[e.reason]||0)+1;if(e.choice==='reposition')t.repositions++;if(e.choice==='trade-cover')t.tradeChoices++;}if(e.type==='fake_noise')t.feints++;}
   if(start.atkFamily==='fake')for(const u of start.units.filter(u=>u.side==='atk')){const first=ev.find(e=>e.type==='move'&&e.unitId===u.id);if(first)t.openingMoves.push({t:first.t,unit:u.id,round:r.round});}
   if(n===0&&side==='attack'&&r.round<=2)fs.writeFileSync(path.join(dir,'round-'+r.round+'.json'),JSON.stringify(r));
  }});match.inputs=m.spatial.initial;report.matches.push(match);t.atkPercent=+(100*t.atk/t.rounds).toFixed(2);report.complete=report.matches.length===+pairs*2;fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({id,n,side,atk:t.atkPercent}));
 }
 console.log(JSON.stringify({id,...report.totals,openingMoves:undefined}));
}
