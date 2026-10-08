// Paired, deterministic diagnostics. An honest release gate, not a forced win rate.
const fs=require('node:fs'),path=require('node:path'),S=require('./spatial-match'),O=require('./round-outcome');
const cards=require('./catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5);
const cases=[],summary={matches:0,rounds:0,attackWins:0,maxRounds:0,overtimeMatches:0,homeWins:0,unfinished:0,heads:0,shots:0};
for(let i=0;i<100;i++)for(const side of ['attack','defense']){
 const shift=i%5,order=Array.from({length:5},(_,n)=>(shift+n)%5),priority={attack:order,defense:order};
 const m=O.create('paired-spatial:'+i,'ascent',side),a={id:'A',players:cards},b={id:'B',players:cards};
 S.initialize(m,a,b,priority);m.spatial.initial.away.tactics=S.weights(priority);
 if(process.argv.includes('--legacy'))m.spatial.version=1;
 while(!O.ended(m.home,m.away)&&m.rounds.length<300){S.step(m,a,b,priority);for(const e of m.replay.events){summary.heads+=e.type==='damage'&&e.hitLocation==='head';summary.shots+=e.type==='shot';}}
 summary.matches++;summary.rounds+=m.rounds.length;summary.attackWins+=m.rounds.filter(r=>(r.side==='attack')===r.win).length;summary.maxRounds=Math.max(summary.maxRounds,m.rounds.length);summary.overtimeMatches+=m.rounds.length>24;summary.homeWins+=m.home>m.away;summary.unfinished+=!O.ended(m.home,m.away);
 cases.push({seed:i,side,home:m.home,away:m.away,rounds:m.rounds.length});
}
summary.attackWinRate=summary.attackWins/summary.rounds;summary.homeWinRate=summary.homeWins/summary.matches;
summary.releaseGate=summary.unfinished===0&&summary.attackWinRate>=.35&&summary.attackWinRate<=.65;
summary.note='相同卡牌/英雄/教练，五种排序轮换，双向开局。阈值为游戏发布标准，不宣称现实地图应为五五开。失败时仅提供独立预览，不能默认接入征战。';
const dir=path.resolve(__dirname,process.argv[2]||'../docs/validation/2026-10-05-spatial');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'balance.json'),JSON.stringify({summary,cases},null,2));console.log(JSON.stringify(summary));
