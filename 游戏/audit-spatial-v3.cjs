const fs=require('node:fs'),path=require('node:path'),S=require('./spatial-match');
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const count=Number(arg('--series','200')),prefix=arg('--seed-prefix','paired-spatial:'),out=path.resolve(arg('--out','docs/validation/2026-10-06-map-engine/balance-v3.json'));
if(!Number.isInteger(count)||count<2||count%2)throw Error('交换攻防样本必须为偶数');
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:50,临场:50,声望:50},mapKnowledge:{ascent:50}});
const start=Date.now(),cases=[],matrix={},ends={},events={supportCalls:0,supportMoves:0,contacts:0,shots:0,movementStops:0},summary={matches:0,rounds:0,attackWins:0,homeWins:0,maxRounds:0};
for(let i=0;i<count/2;i++)for(const side of ['attack','defense']){
 const order=Array.from({length:5},(_,n)=>(i+n)%5),priority={attack:order,defense:order},m=S.simulate(prefix+i,team('A'),team('B'),priority,{side,awayPriority:priority,onRound:record=>{
  const e=record.events;events.supportCalls+=e.filter(x=>x.type==='support_call').length;events.supportMoves+=e.filter(x=>x.type==='support_move').length;events.contacts+=e.filter(x=>x.type==='contact').length;events.shots+=e.filter(x=>x.type==='shot').length;events.movementStops+=e.filter(x=>x.type==='move_stop').length;
  const reason=e.find(e=>e.type==='round_end')?.reason;ends[reason]=(ends[reason]||0)+1;
 }});
 for(const r of m.rounds){const atkWin=r.side==='attack'?r.win:!r.win;summary.rounds++;summary.attackWins+=atkWin;const key=r.side==='attack'?r.ownTactic+'/'+r.opponentTactic:r.opponentTactic+'/'+r.ownTactic;matrix[key]||={rounds:0,attackWins:0};matrix[key].rounds++;matrix[key].attackWins+=atkWin;}
 summary.matches++;summary.homeWins+=m.home>m.away;summary.maxRounds=Math.max(summary.maxRounds,m.rounds.length);cases.push({seed:prefix+i,side,home:m.home,away:m.away,rounds:m.rounds.length,attackWins:m.rounds.filter(r=>(r.side==='attack')===r.win).length});
 if(summary.matches%10===0)console.log(JSON.stringify({progress:summary.matches,total:count,attackWinRate:summary.attackWins/summary.rounds,elapsedMs:Date.now()-start}));
}
summary.attackWinRate=summary.attackWins/summary.rounds;summary.homeWinRate=summary.homeWins/summary.matches;summary.elapsedMs=Date.now()-start;summary.releaseGate=count>=1000&&summary.attackWinRate>=.45&&summary.attackWinRate<=.55;
// Cluster bootstrap: preserve all dependent rounds in each paired opening.
const rng=require('./round-outcome').random('bootstrap:'+prefix),rates=[];for(let n=0;n<2000;n++){let wins=0,rounds=0;for(let i=0;i<count/2;i++){const pair=Math.floor(rng()*count/2)*2;for(const c of cases.slice(pair,pair+2)){wins+=c.attackWins;rounds+=c.rounds;}}rates.push(wins/rounds);}rates.sort((a,b)=>a-b);summary.clusterCI95=[rates[50],rates[1950]];
const report={version:3,layoutVersion:S.mapDataV3.layoutVersion,count,seedPrefix:prefix,summary,cases,matrix,allRoundEvents:events,allRoundEnds:ends,note:'统计覆盖全部回合；按同一种子交换初始攻防成对采样。小样本只用于诊断，不代表九图或正式征战已发布。'};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
