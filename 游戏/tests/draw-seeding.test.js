const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../season-2026'),T=require('../tournament'),O=require('../round-outcome');
const cards=require('../catalog').cards,rosters=require('../content/rosters/2026-production-v1.json').teams;
const maps=['ascent','sunset','split','haven','lotus','breeze','summit'];
const winA=n=>({scoreA:(n.bestOf+1)/2,scoreB:0,winner:n.a,loser:n.b,bestOf:n.bestOf,maps:[]});
const winB=n=>({...winA(n),scoreA:0,scoreB:(n.bestOf+1)/2,winner:n.b,loser:n.a});
function regional(seed){const ctx=S.create(seed,rosters,cards,'EDG');for(const phase of [0,2,3])S.commitStage(ctx,phase,S.runStage(ctx,phase,winA));return ctx;}

test('Stage 1 draws one team from every Kickoff seed pair into each group',()=>{
 const signatures=new Set();for(let i=0;i<40;i++){const ctx=regional('pots-'+i);assert.equal(ctx.version,'2026-season-2');
 for(const region of S.regions){const event=ctx.stages[2].regions[region],order=ctx.stages[0].regions[region].placements.flat();assert.equal(event.draw.groups.length,2);assert.equal(new Set(event.draw.groups.flat()).size,12);
 for(let p=0;p<6;p++)for(const group of event.draw.groups)assert.equal(group.filter(id=>order.slice(p*2,p*2+2).includes(id)).length,1);
 signatures.add(JSON.stringify(event.draw.groups));}assert.deepEqual(S.runStage(ctx,2,winA),ctx.stages[2]);}assert(signatures.size>40);
});
test('CN seeding deciders are real BO3 scores, four then six, with no championship points',()=>{
 const ctx=regional('cn-deciders');let phase1=ctx.stages[2].regions.CN;assert.equal(phase1.seedingGames.length,4);assert.equal(phase1.games.filter(g=>g.label==='常规赛').length,30);
 for(let p=0;p<4;p++){const g=phase1.seedingGames[p];assert.equal(g.a,phase1.tables[0][p].id);assert.equal(g.b,phase1.tables[1][p].id);assert.equal(g.bestOf,3);assert.deepEqual(phase1.seeds.slice(p*2,p*2+2),[g.winner,g.loser]);}
 const out=S.runStage(ctx,5,winB),r=out.regions.CN;assert.equal(r.seedingGames.length,6);for(let p=0;p<6;p++)assert.deepEqual(r.seeds.slice(p*2,p*2+2),[r.seedingGames[p].winner,r.seedingGames[p].loser]);
 const before=Object.values(ctx.points).reduce((a,b)=>a+b,0);S.commitStage(ctx,5,out);assert.equal(Object.values(ctx.points).reduce((a,b)=>a+b,0)-before,120);
 const session=S.prepare(ctx,5,maps);assert(!session.featuredId?.includes(':SEED:'));
});
test('Stage 2 exchanges exactly three seeded positions and preserves two teams per rank band',()=>{
 const choices=new Set();for(let i=0;i<24;i++){const ctx=regional('swaps-'+i),out=S.runStage(ctx,5,winA);for(const region of S.regions){const d=out.regions[region].draw;assert.equal(d.kind,'rank-swap');assert.equal(d.swaps.length,3);choices.add(d.swaps.join(','));
 assert.equal(new Set(d.groups.flat()).size,12);assert.equal(d.groups[0].filter(id=>!d.baseGroups[0].includes(id)).length,3);
 for(let p=0;p<6;p++){const a=d.baseGroups[0][p],b=d.baseGroups[1][p];assert(d.groups[0].includes(a)!==d.groups[0].includes(b));}
 for(const group of d.baseGroups)for(let j=1;j<group.length;j++)assert(S.rank(ctx.stages[3].regions[region],group[j-1])<=S.rank(ctx.stages[3].regions[region],group[j]));
 }}assert.equal(choices.size,8);
});
test('Swiss random draw remains same-record, first-round seed/cross-region protected, without rematches',()=>{
 const teams=Array.from({length:8},(_,i)=>'S'+i),signatures=new Set();for(let i=0;i<100;i++){const out=T.swiss(teams,winA,'',()=>true,{random:key=>O.random(i+':'+key)});signatures.add(JSON.stringify(out.games.slice(0,4).map(g=>[g.a,g.b])));
 const rec=Object.fromEntries(teams.map(t=>[t,{w:0,l:0}])),seen=new Set();for(const g of out.games){assert.deepEqual(rec[g.a],rec[g.b]);const pair=[g.a,g.b].sort().join('/');assert(!seen.has(pair));seen.add(pair);rec[g.winner].w++;rec[g.loser].l++;}assert(out.draws.length>=4);
 }assert(signatures.size>20);
});
test('Champions draws regional seed pools, opposite playoff halves for same-group qualifiers',()=>{
 const signatures=new Set();for(let i=0;i<40;i++){const ctx=regional('champdraw-'+i);S.commitStage(ctx,5,S.runStage(ctx,5,winA));S.commitStage(ctx,6,S.runStage(ctx,6,winA));const out=S.runStage(ctx,7,winA),d=out.groupDraw;assert.equal(d.groups.length,4);assert.equal(new Set(d.groups.flat()).size,16);
 for(const group of d.groups){assert.equal(new Set(group.map(id=>ctx.teams.find(t=>t.id===id).region)).size,4);for(const pot of d.pools)assert.equal(group.filter(id=>pot.includes(id)).length,1);}
 const games=out.games.filter(g=>/:PO:U1[a-d]$/.test(g.id)),meta=Object.fromEntries(out.gsl.qualified.map((id,j)=>[id,{group:Math.floor(j/2),place:j%2+1}]));assert.equal(games.length,4);
 games.forEach(g=>{assert.notEqual(meta[g.a].place,meta[g.b].place);assert.notEqual(meta[g.a].group,meta[g.b].group);});
 for(let g=0;g<4;g++){const halves=games.map((n,j)=>({n,h:j<2?0:1})).filter(({n})=>meta[n.a].group===g||meta[n.b].group===g).map(x=>x.h);assert.deepEqual(halves.sort(),[0,1]);}
 signatures.add(JSON.stringify(d.groups));assert.deepEqual(S.runStage(ctx,7,winA),out);
 }assert(signatures.size>20);
});
test('legacy saves keep previous bracket; new actual sessions survive JSON and strength changes',()=>{
 const legacy=regional('legacy');legacy.version='2026-season-1';const old=S.runStage(legacy,2,winA);assert.equal(old.regions.CN.seedingGames,undefined);assert.deepEqual(old.regions.CN.tables.map(t=>t.map(r=>r.id)),S.groups(legacy.stages[0].regions.CN.placements.flat()));
 for(const phase of [0,2,3,5,6,7]){const ctx=S.create('resume-'+phase,rosters,cards,'EDG');for(let p=0;p<phase;p++)S.commitStage(ctx,p,S.runStage(ctx,p,winA));let s=S.prepare(ctx,phase,maps);S.progress(ctx,s,maps);s=JSON.parse(JSON.stringify(s));
 for(const t of ctx.teams)t.neutralPrior=100;let guard=0;while(!s.complete){assert(++guard<5);if(s.pending)S.submit(s,winB({...s.pending,bestOf:s.pending.playedBestOf}));S.progress(ctx,s,maps);}assert.equal(new Set(ctx.stages[phase].games.map(g=>g.id)).size,ctx.stages[phase].games.length);
 }
});

function pointsFixture(){const ctx=S.create('points-cases',rosters,cards,'EDG'),ids=ctx.teams.filter(t=>t.region==='CN'&&!t.entryOnly).map(t=>t.id);for(const id of ids)ctx.points[id]=id===ids[0]||id===ids[1]||id===ids[2]?20:0;ctx.stages[6]={games:[],regions:{CN:{placements:[ids.slice(0,3),ids.slice(3)],games:[]}}};return {ctx,ids};}
test('points subgroup restarts final standings, same-group ranking precedes later events',()=>{
 const {ctx,ids}=pointsFixture(),[a,b,c]=ids;ctx.stages[5]={games:[],regions:{CN:{tables:[[{id:a},{id:b}],ids.slice(2).map(id=>({id}))],games:[]}}};ctx.stages[4]={games:[],placements:[[c],[a,b]]};
 const order=S.pointStandings(ctx,'CN');assert.deepEqual(order.slice(0,3).map(r=>r.id),[c,a,b]);assert(order[1].tieCriteria.includes('第二赛段名次'));assert(!order.slice(0,3).some(r=>r.tieGames));
});
test('points respect play-in elimination tier before Masters or regular statistics',()=>{
 const {ctx,ids}=pointsFixture(),[a,b,c]=ids;ctx.stages[6].regions.CN.placements=[ids.slice(3)];ctx.stages[5]={games:[],regions:{CN:{games:[],playin:{eliminated:[a,c,b]},tables:[]}}};ctx.stages[4]={games:[],placements:[[b],[a],[c]]};
 assert.deepEqual(S.pointStandings(ctx,'CN').slice(0,3).map(r=>r.id),[a,c,b]);
});
test('points annual statistics exclude seeding/play-in/global results and final head-to-head is two-team only',()=>{
 const {ctx,ids}=pointsFixture(),[a,b,c]=ids;const matches=[{a,b,winner:a,loser:b,scoreA:2,scoreB:0,maps:[],label:'种子排位赛'},{a:b,b:c,winner:b,loser:c,scoreA:2,scoreB:0,maps:[],label:'常规赛'}];ctx.stages[2]={games:matches,regions:{CN:{games:matches,tables:[]}}};ctx.stages[5]={games:[],regions:{CN:{games:[],tables:[]}}};
 const result=S.pointStandings(ctx,'CN');assert.equal(result.find(r=>r.id===a).wins,0);assert.equal(result.find(r=>r.id===b).wins,1);assert.equal(result[0].id,b);
 const noH2H=pointsFixture();noH2H.ctx.stages[0]={games:[{a:noH2H.ids[0],b:noH2H.ids[1],winner:noH2H.ids[0],loser:noH2H.ids[1],scoreA:2,scoreB:0,maps:[]}],regions:{CN:{placements:[noH2H.ids],games:[]}}};const tied=S.pointStandings(noH2H.ctx,'CN').slice(0,3);assert(tied.every(r=>r.tieGames?.length));assert(!tied.some(r=>r.tieCriteria?.some(c=>c.startsWith('相互交手'))));
 const two=pointsFixture();two.ctx.points[two.ids[2]]=0;two.ctx.stages[0]={games:[{a:two.ids[0],b:two.ids[1],winner:two.ids[1],loser:two.ids[0],scoreA:0,scoreB:2,maps:[]}],regions:{CN:{placements:[two.ids],games:[]}}};const pair=S.pointStandings(two.ctx,'CN').slice(0,2);assert.equal(pair[0].id,two.ids[1]);assert(!pair.some(r=>r.tieGames));
});

test('Masters restores changed actual Swiss outcomes at each round without redrawing committed games',()=>{
 for(let seed=0;seed<24;seed++){const ctx=S.create('swiss-resume-'+seed,rosters,cards,'EDG');S.commitStage(ctx,0,S.runStage(ctx,0,winA));let session=S.prepare(ctx,1,maps),guard=0;while(!session.complete){assert(++guard<5);S.progress(ctx,session,maps);if(session.pending){const prior=JSON.stringify(session.committed);session=JSON.parse(JSON.stringify(session));S.submit(session,session.pending.a===ctx.club?winB({...session.pending,bestOf:session.pending.playedBestOf}):winA({...session.pending,bestOf:session.pending.playedBestOf}));const checkpoint=JSON.parse(prior);for(const [id,item]of Object.entries(checkpoint))assert.deepEqual(session.committed[id],item);}}
 const swiss=ctx.stages[1].swiss;assert.equal(new Set(swiss.games.map(g=>[g.a,g.b].sort().join('/'))).size,swiss.games.length);
 }
});

test('actual frontend season awards seeding participation once and records its real maps',()=>{const H=require('./helpers/live-ui.cjs'),x=H.load('seeding-growth'),s=H.season(x,H.begin(x));const matches=s.participation.filter(p=>p.matchId?.includes(':SEED:'));assert(matches.length>0);for(const p of matches){assert.equal(p.kind,'quick');assert(p.cards.length===5);assert(s.mapRecords.some(m=>m.matchId===p.matchId&&m.players));}const snapshot=JSON.stringify(s);x.PROTOTYPE_RULES.finish(s);assert.equal(JSON.stringify(s),snapshot);});

test('overseas play-in official diagrams preserve byes, exact lower falls and stop at four qualifiers',()=>{const ctx=regional('playin-diagrams');const out=S.runStage(ctx,5,winA);for(const region of ['AMER','EMEA','PAC']){const event=out.regions[region],p=event.playin,r=p.results,t=event.seeds.slice(4);assert.equal(p.games.length,18);assert.equal(p.qualified.length,4);assert.equal(p.eliminated.length,8);assert.equal(new Set([...p.qualified,...p.eliminated]).size,12);const opening=p.games.filter(g=>/U0[0-3]$/.test(g.id));assert.deepEqual(opening.map(g=>g.a),[t[7],t[4],t[6],t[5]]);assert(opening.every(g=>ctx.teams.find(t=>t.id===g.b).entryOnly));assert.deepEqual(p.games.filter(g=>/U1[0-3]$/.test(g.id)).map(g=>g.a),region==='EMEA'?[t[0],t[3],t[2],t[1]]:[t[0],t[3],t[1],t[2]]);for(const [l,u,v]of [['L1a','U00','U13'],['L1b','U01','U12'],['L1c','U02','U11'],['L1d','U03','U10']]){const g=p.games.find(g=>g.id.endsWith(':'+l));assert.deepEqual([g.a,g.b],[r[u].loser,r[v].loser]);}const losses={};for(const g of p.games){assert((losses[g.a]||0)<2);assert((losses[g.b]||0)<2);losses[g.loser]=(losses[g.loser]||0)+1;}for(const id of p.eliminated)assert.equal(losses[id],2);assert(!p.games.some(g=>/:(UF|LF)$/.test(g.id)));}});
