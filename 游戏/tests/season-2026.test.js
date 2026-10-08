const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../tournament'),S=require('../season-2026'),O=require('../round-outcome'),V=require('../map-veto'),H=require('../agent-selection');
const catalog=require('../catalog').cards,rosters=require('../content/rosters/2026-production-v1.json').teams;
const pool=['ascent','sunset','split','haven','lotus','breeze','summit'];
const winA=n=>({scoreA:(n.bestOf+1)/2,scoreB:0,winner:n.a,loser:n.b,bestOf:n.bestOf,maps:[]});
test('overseas regional matches use numeric scores while CN and world keep round facts',()=>{
 const ctx=S.create('regional-policy',rosters,catalog,'EDG'),pool=['ascent','sunset','split','haven','lotus','breeze','summit'];
 for(const [id,a,b,numeric]of [['0:AMER:U1','G2','NRG',true],['0:CN:U1','EDG','TYL',false],['1:world:PO:U1','G2','NRG',false]]){
  const r=S.simulate(ctx,{id,a,b,bestOf:3},pool);T.validate(r,a,b,3);assert.equal(r.simulationMode,numeric?'regional-numeric':'round-model');assert(r.maps.every(m=>numeric?m.rounds===undefined:Array.isArray(m.rounds)));assert(r.maps.every(m=>O.ended(m.home,m.away)));
 }
 const kickoff=S.runStage(ctx,0,winA);S.commitStage(ctx,0,kickoff);const regular=S.runStage(ctx,2,winA);S.commitStage(ctx,2,regular);const second=S.runStage(ctx,5,winA);
 for(const region of ['AMER','EMEA','PAC']){const r=second.regions[region];assert.equal(r.games.filter(g=>g.label==='常规赛').length,30);assert.equal(r.direct.length,4);assert.equal(r.playin.qualified.length,4);assert.equal(new Set(r.playin.games.flatMap(g=>[g.a,g.b])).size,12);assert(r.playin.games.every(g=>g.bestOf===3));const opening=r.playin.games.filter(g=>g.id.includes(':U0'));assert.equal(opening.length,4);const byes=r.seeds.slice(4,8);assert(opening.every(g=>!byes.includes(g.a)&&!byes.includes(g.b)));}
});
test('CN kickoff preserves twelve placements and exactly three losses for eliminated teams',()=>{
 const t=['BLG','DRG','XLG','EDG','AG','NOVA','JDG','TEC','TE','WOL','FPX','TYL'],out=T.kickoff(t,winA);
 assert.equal(out.games.length,30);assert.equal(new Set(out.placements.flat()).size,12);
 for(const id of out.placements.flat().slice(3))assert.equal(out.games.filter(g=>g.loser===id).length,3,id);
 for(const id of out.placements.flat().slice(0,3))assert(out.games.filter(g=>g.loser===id).length<3);
 assert.deepEqual(out.games.filter(g=>g.bestOf===5).map(g=>g.label),['UF','MF','LF']);
});
test('standard and seeded double elimination stop eliminated participants and attribute upper finalist',()=>{
 for(const byes of [false,true]){const ids=Array.from({length:8},(_,i)=>'T'+i),out=T.double(ids,winA,'',byes);
 assert.equal(new Set(out.placements.flat()).size,8);assert.equal(out.games.at(-1).upperTeam,out.results.UF.winner);
 for(const id of out.placements.flat().slice(2)){const last=out.games.findLastIndex(g=>g.loser===id);assert(!out.games.slice(last+1).some(g=>g.a===id||g.b===id));}
 assert.equal(out.games.length,byes?12:14);}
});
test('regular season has only thirty round robin matches, with cross-group playoff seeds and one point per actual win',()=>{
 const groups=[['a','b','c','d','e','f'],['g','h','i','j','k','l']],r=T.regular(groups,winA);
 assert.equal(r.games.length,30);assert(!r.games.some(g=>g.label==='同名次种子赛'));
 assert.deepEqual(r.seeds,['a','g','b','h','c','i','d','j','e','k','f','l']);
 const ctx={stages:{},points:Object.fromEntries(groups.flat().map(t=>[t,0]))};S.commitStage(ctx,2,{games:r.games,regions:{CN:r}});
 assert.equal(Object.values(ctx.points).reduce((a,b)=>a+b,0),30);S.commitStage(ctx,2,{games:r.games,regions:{CN:r}});assert.equal(ctx.points.a,5);
});
test('CN play-in has ten participants, four qualifiers, no eliminated team returns',()=>{
 const ids=Array.from({length:8},(_,i)=>'T'+i),r=T.cnPlayin(ids,['KBG','AT'],winA);
 assert.equal(r.games.length,16);assert.equal(new Set(r.qualified).size,4);assert.equal(new Set([...r.qualified,...r.eliminated]).size,10);
 for(const id of r.eliminated)assert.equal(r.games.filter(g=>g.loser===id).length,2);
});
test('Swiss avoids rematches, and GSL third/fourth placements stay distinct',()=>{
 const ids=Array.from({length:8},(_,i)=>'S'+i),s=T.swiss(ids,winA);assert.equal(s.qualified.length,4);assert.equal(s.eliminated.length,4);
 assert.equal(new Set(s.games.map(g=>[g.a,g.b].sort().join(':'))).size,s.games.length);
 const g=T.gsl([ids.slice(0,4),ids.slice(4)],winA);assert.equal(g.third.length,2);assert.equal(g.fourth.length,2);
 for(const id of g.fourth)assert.equal(g.games.filter(x=>x.loser===id).length,2);
});
test('Masters first draw crosses regions and seed pools, playoffs use winners draft, kickoff protects real Champions byes',()=>{
 for(let seed=0;seed<12;seed++){
  const ctx=S.create('draw-'+seed,rosters,catalog,'EDG');const kickoff=S.runStage(ctx,0,winA);S.commitStage(ctx,0,kickoff);
  for(const region of ['AMER','EMEA','PAC']){const first=kickoff.regions[region].games.slice(0,4).flatMap(g=>[g.a,g.b]);assert(S.kickoffByes[region].every(id=>!first.includes(id)));}
  const out=S.runStage(ctx,1,winA),meta=Object.fromEntries(S.regions.flatMap(region=>kickoff.regions[region].placements.flat().slice(1,3).map((id,i)=>[id,{region,seed:i+2}])));
  for(const g of out.swiss.games.slice(0,4)){assert.notEqual(meta[g.a].region,meta[g.b].region);assert.notEqual(meta[g.a].seed,meta[g.b].seed);}
  assert.equal(new Set(out.playoffDraft.map(p=>p.opponent)).size,4);assert.equal(new Set(out.playoffDraft.map(p=>p.team)).size,4);
  for(const p of out.playoffDraft){assert(out.swiss.qualified.includes(p.opponent));assert(out.games.some(g=>g.label.startsWith('U1')&&g.a===p.team&&g.b===p.opponent));}
  assert.deepEqual(out,S.runStage(ctx,1,winA),'draw changed when resuming same seed');
 }
});
test('all BO3, BO5 and upper/lower GF veto variants use legal seven-map sequence and side authority',()=>{
 for(const bestOf of [3,5])for(const gf of [false,true])for(const upper of [false,true])for(const role of ['A','B']){
 if(gf&&bestOf===3)continue;
 const v=V.create(pool,{bestOf,grandFinal:gf,playerUpper:upper,playerRole:role});
 if(gf&&!upper)assert.throws(()=>V.chooseRole(v,role));
 if(gf)assert.deepEqual(V.sequence(v).slice(0,2).map(s=>s.actor),[upper?role:role==='A'?'B':'A',upper?role:role==='A'?'B':'A']);
 V.auto(v);while(v.moves.length<7){assert.equal(V.actor(v),'player');V.move(v,v.pool.find(id=>!v.moves.includes(id)));V.auto(v);}
 assert.equal(new Set(V.maps(v)).size,bestOf);let i;while((i=V.pendingSide(v))!==undefined)V.setSide(v,i,'defense');assert(V.complete(v));
 assert.equal(V.sideActor(v,bestOf-1),(bestOf===3?'A':'B')===role?'player':'opponent');
 assert.throws(()=>V.move(v,pool[0]));assert.throws(()=>V.chooseRole(v,'A'));
 }
});
test('series length, overtime, reload reproducibility and future-only tactic changes',()=>{
 const a={id:'a',players:[{AIM:80,SYN:80,SEN:80}]},b={id:'b',players:[{AIM:70,SYN:70,SEN:70}]},priorities={attack:[0,1,2,3,4],defense:[0,1,2,3,4]};
 const m=O.create('reload','ascent');for(let i=0;i<10;i++)O.step(m,a,b,priorities);const copy=structuredClone(m),before=JSON.stringify(m.rounds);
 assert.deepEqual(O.step(m,a,b,priorities),O.step(copy,a,b,priorities));
 const altered=structuredClone(copy);O.step(copy,a,b,priorities);O.step(altered,a,b,{attack:[4,3,2,1,0],defense:[4,3,2,1,0]});assert.equal(JSON.stringify(altered.rounds.slice(0,10)),before);
 assert(O.ended(13,11));assert(!O.ended(13,12));assert(!O.ended(14,13));assert(O.ended(15,13));
 for(const bestOf of [1,3,5]){const r=O.series('series',a,b,bestOf,pool);T.validate(r,'a','b',bestOf);assert.equal(r.maps.length,r.scoreA+r.scoreB);assert(r.maps.length<=bestOf);}
 const quick=O.simulate('same',a,b,'ascent'),live=O.create('same','ascent');while(!O.ended(live.home,live.away)){if([8,12].includes(live.rounds.length))O.adapt(live);O.step(live,a,b,priorities);}assert.deepEqual(live,quick);
 let different=0;for(let i=0;i<20;i++){const old=O.step(O.create(i,'ascent'),a,b,priorities),changed=O.step(O.create(i,'ascent'),a,b,{attack:[4,3,2,1,0],defense:[4,3,2,1,0]});if(old.ownTactic!==changed.ownTactic&&old.probability!==changed.probability)different++;}assert(different>10,'priority changes did not affect execution and win chances');
});
test('quick hero assignment finds global optimal unique composition and leaves card abilities intact',()=>{
 const players=catalog.filter(p=>p.region==='CN'&&p.tier!=='钻').slice(0,5),heroes=['幽影','捷风','猎枭','零','炼狱','蝰蛇'];const immutable=JSON.stringify(players);
 const result=H.recommend(players,heroes,'ascent');assert.equal(new Set(result.agents).size,5);assert.equal(JSON.stringify(players),immutable);
 let best=-Infinity;function search(chosen){if(chosen.length===5){const score=chosen.reduce((n,a,i)=>n+H.fit(players[i],a,'ascent'),0)+H.composition(chosen);best=Math.max(best,score);return;}for(const a of heroes)if(!chosen.includes(a))search([...chosen,a]);}search([]);assert.equal(result.score,best);
 for(const p of players)assert.equal(H.signature(p),p.tier==='铜'?null:p.agents[0]);
});
test('complete season follows actual qualification, awards placements once and formal results redirect legal future bracket',()=>{
 const ctx=S.create('season-test',rosters,catalog,'EDG');let finals=0;
 for(let phase=0;phase<8;phase++){const session=S.prepare(ctx,phase,pool);let guard=0;
 while(!session.complete){S.progress(ctx,session,pool);if(session.pending){const n=session.pending;assert(++guard<4);assert.equal(n.playedBestOf,n.grandFinal?5:3);if(n.grandFinal)finals++;const target=(n.playedBestOf+1)/2;const ownA=n.a===ctx.club;S.submit(session,{scoreA:ownA?target:0,scoreB:ownA?0:target,winner:ctx.club,loser:n.opponent,bestOf:n.playedBestOf,maps:[]});}}
 const event=ctx.stages[phase];assert(event);const own=event.games.filter(g=>g.a===ctx.club||g.b===ctx.club);for(const item of Object.values(session.committed).filter(i=>i.kind==='formal'))assert(own.some(g=>g.id===item.node.id&&g.winner===ctx.club));
 const points={...ctx.points};S.commitStage(ctx,phase,event);assert.deepEqual(ctx.points,points);
 if([1,4].includes(phase))assert.equal(event.participants.length,12);
 }
 assert.equal(ctx.stages[7].participants.length,16);assert.equal(new Set(ctx.stages[7].participants).size,16);assert.equal(ctx.stages[7].placements.flat().length,16);assert(ctx.stages[7].gsl.third.every(id=>S.rank(ctx.stages[7],id)===9));assert(ctx.stages[7].gsl.fourth.every(id=>S.rank(ctx.stages[7],id)===13));
 assert(finals>0);assert(ctx.dataGaps.some(g=>g.id==='TL'));assert(ctx.dataGaps.some(g=>g.id==='GX'));
});
test('Masters draft freezes after actual Swiss completion and restores legacy committed quarterfinals across changed strength',()=>{
 for(const legacy of [false,true]){
 const ctx=S.create('draft-freeze',rosters,catalog,'BLG');S.commitStage(ctx,0,S.runStage(ctx,0,winA));
 let session=S.prepare(ctx,1,pool);assert.equal(ctx.playoffDrafts,undefined,'speculative selection leaked its draft into live context');S.progress(ctx,session,pool);
 assert(session.playoffDrafts?.[1]);const draft=JSON.stringify(session.playoffDrafts[1]);
 // Resolve the first featured match and take a JSON checkpoint. Every completed
 // quarterfinal remains binding even for older saves without the draft field.
 const n=session.pending;assert(n);S.submit(session,winA({...n,bestOf:n.playedBestOf}));session=JSON.parse(JSON.stringify(session));if(legacy)delete session.playoffDrafts;
 for(const t of ctx.teams)t.players=t.players.map(p=>({...p,AIM:t.id==='BLG'?0:100,SYN:t.id==='BLG'?0:100,SEN:t.id==='BLG'?0:100}));
 assert.doesNotThrow(()=>S.progress(ctx,session,pool));if(!legacy)assert.equal(JSON.stringify(session.playoffDrafts[1]),draft);
 for(const item of Object.values(session.committed)){const r=item.result;assert([item.node.a,item.node.b].includes(r.winner));}
 }
});
test('Champions tiebreak qualification is fixed before matches and cannot change after team growth',()=>{
 const ctx=S.create('qualification-freeze',rosters,catalog,'EDG');
 const ids=region=>ctx.teams.filter(t=>t.region===region&&!t.entryOnly).map(t=>t.id);
 for(const phase of [0,3])ctx.stages[phase]={games:[],regions:Object.fromEntries(S.regions.map(r=>[r,{placements:[ids(r)],games:[]}]))};
 for(const phase of [1,4])ctx.stages[phase]={games:[],placements:[ctx.teams.map(t=>t.id)]};
 for(const phase of [2,5])ctx.stages[phase]={games:[],regions:Object.fromEntries(S.regions.map(r=>[r,{seeds:ids(r),games:[]}]))};
 ctx.stages[6]={games:[],regions:Object.fromEntries(S.regions.map(r=>[r,{placements:[[ids(r)[0]],[ids(r)[1]],ids(r).slice(2)],games:[]}]))};
 let session=S.prepare(ctx,7,pool);S.progress(ctx,session,pool);assert(session.qualificationStandings.CN.some(t=>t.tieGames?.length));
 const frozen=JSON.stringify(session.qualificationStandings);session=JSON.parse(JSON.stringify(session));
 for(const t of ctx.teams)t.players=t.players.map(p=>({...p,AIM:100-p.AIM,SYN:100-p.SYN,SEN:100-p.SEN}));
 let guard=0;while(!session.complete){assert(++guard<5);if(session.pending)S.submit(session,winA({...session.pending,bestOf:session.pending.playedBestOf}));S.progress(ctx,session,pool);}
 assert.equal(JSON.stringify(session.qualificationStandings),frozen);assert.equal(JSON.stringify(ctx.qualificationStandings),frozen);
 for(const r of S.regions){const direct=ids(r).slice(0,2),points=ctx.qualificationStandings[r].filter(t=>!direct.includes(t.id)).slice(0,2).map(t=>t.id);assert([...direct,...points].every(id=>ctx.stages[7].participants.includes(id)));}
});
