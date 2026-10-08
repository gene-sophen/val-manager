const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),O=require('../round-outcome'),H=require('../team-style'),E=require('../../引擎/external-effects');
const priority={attack:[0,1,2,3,4],defense:[1,0,2,3,4]},cards=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5);
const team=id=>({id,players:structuredClone(cards),team:{羁绊:40,状态:50,熟练:50},coach:{战术:50,临场:50,声望:50},mapKnowledge:{split:50},tacticalProfile:H.create('contract','mirror',{neutral:true})});
test('external contract separates card, team, map, coach and tactical execution, without mutating input',()=>{
 const t=team('A'),raw=JSON.stringify(t),p=t.players[0],a=S.validateInputs(t,priority,null,'split');assert.equal(JSON.stringify(t),raw);assert.equal(a.executionState.map,50);assert.equal(a.effectsVersion,'card-effects-1');
 for(const [path,dim]of [['状态','aim'],['羁绊','syn'],['熟练','syn']]){const b=team('B');b.team[path]=100;const x=S.validateInputs(b,priority,null,'split');assert(E.base(p,x.executionState,x.coach)[dim]>E.base(p,a.executionState,a.coach)[dim]);}
 const b=team('B');b.mapKnowledge.split=100;b.coach.战术=100;const x=S.validateInputs(b,priority,null,'split');assert(E.base(p,x.executionState,x.coach).sen>E.base(p,a.executionState,a.coach).sen);
 b.coach.声望=0;const lo=S.validateInputs(b,priority,null,'split');b.coach.声望=100;const hi=S.validateInputs(b,priority,null,'split');assert.deepEqual(E.base(p,lo.executionState,lo.coach),E.base(p,hi.executionState,hi.coach));assert.equal(hi.coach.prestige,100);
 const sk=H.execution(b.tacticalProfile,'attack','rush','push');assert(sk.syn>H.execution(b.tacticalProfile,'attack','rush','trap').syn);
});
test('invalid external input is rejected before creating the map journal',()=>{for(const change of [t=>t.players[0].AIM=NaN,t=>t.team.羁绊=101,t=>t.mapKnowledge.split=-1,t=>t.coach.临场=Infinity,t=>t.players[4]=t.players[0],t=>t.tacticalProfile.attack[0]=Infinity]){const a=team('A');change(a);const m=O.create('bad','split');assert.throws(()=>S.initialize(m,a,team('B'),priority,null,{version:6,behaviorVersion:'split-balance-2'}));assert(!m.spatial);}});
test('new policy input freezes source cards and coach but accepts bounded round team state, restore is identical',()=>{
 const a=team('A'),b=team('B'),m=O.create('contract-round','split');S.initialize(m,a,b,priority,null,{version:6,behaviorVersion:'split-balance-2'});S.step(m,a,b,priority);
 const frozen=JSON.stringify(m.spatial.initial);a.team.状态=80;a.mapKnowledge.split=90;a.coach.战术=0;a.players[0].AIM=1;const restored=structuredClone(m);assert.deepEqual(S.step(m,a,b,priority),S.step(restored,a,b,priority));assert.equal(JSON.stringify(m.spatial.initial),frozen);
 const own=m.replay.events.filter(e=>e.type==='execution_profile'&&e.unitId.startsWith('A:'));assert.equal(own.length,5);assert(own.every(e=>e.team.form===80&&e.team.map===90&&e.coach.tactics===50));assert.equal(own[0].card.aim,cards[0].AIM);assert.deepEqual(m.replay,S.replay(restored));
});
