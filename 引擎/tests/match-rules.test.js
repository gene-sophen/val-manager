const test = require('node:test');
const assert = require('node:assert/strict');
const { matchOver, attackSide } = require('../match-rules');
const { matchGen, playerDecision } = require('../match');
const { RoundSim } = require('../round');
const { resolveTeam } = require('../teams');
const { GameMap } = require('../gamemap');
const { mulberry32 } = require('../rng');
const mapData = require('../maps/ascent.json');
const rules = { firstTo: 13, halfRounds: 12, initialAttacker: 'A' };

test('all score consumers require at least thirteen wins and a two-round lead', () => {
  for (const [a, b, done] of [[12,12,false],[13,12,false],[13,13,false],[14,12,true],[15,13,true],[13,11,true],[20,19,false],[21,19,true]]) {
    assert.equal(matchOver(a,b,rules),done,`${a}:${b}`);
    assert.equal(matchOver(b,a,rules),done,`${b}:${a}`);
  }
});
test('normal halves swap once and overtime alternates without a random coin toss', () => {
  assert.equal(attackSide(0,rules),'A');assert.equal(attackSide(11,rules),'A');
  assert.equal(attackSide(12,rules),'B');assert.equal(attackSide(23,rules),'B');
  assert.deepEqual(Array.from({length:8},(_,i)=>attackSide(24+i,rules)),['A','B','A','B','A','B','A','B']);
  assert.equal(attackSide(24,{...rules,initialAttacker:'B'}),'B');
});
test('the generator actually continues through 13:12 and multiple overtime cycles, resets economy and grants OT timeout once', () => {
  const setup=mulberry32(17);
  const teamA=resolveTeam({name:'A',tiers:['银','银','银','银','银']},setup);
  const teamB=resolveTeam({name:'B',tiers:['银','银','银','银','银']},setup);
  const sequence=[...Array(12).fill('A'),...Array(12).fill('B'),'A','B','A','B','A','A'];
  const original=RoundSim.prototype.run;
  let cursor=0;
  RoundSim.prototype.run=function(){
    const atkKey=this.atk[0].id.split(':')[0];
    return {winner:sequence[cursor++]===atkKey?'atk':'def',reason:'elim',ticks:1,planted:false,
      stats:{popOffs:0,whiffs:0,utilsAtk:0,utilsDef:0,fakeReads:0,fakePulled:0,utilsByType:{flash:0,smoke:0,molly:0,recon:0,trap:0},abilityByArchetype:{}}};
  };
  try{
    const gen=matchGen({teamA,teamB,map:new GameMap(mapData),rng:mulberry32(18),playerCoach:'A'});
    let step=gen.next(),seen13to12=false,otRequested=false,otRemaining=[];
    while(!step.done){
      const w=step.value;
      if(w.scoreA===13&&w.scoreB===12){seen13to12=true;assert.equal(w.matchOver,false);}
      if(w.isOvertime&&!w.matchOver){otRemaining.push(w.timeoutsLeft.A);}
      const request=w.isOvertime&&!w.matchOver&&!otRequested;
      if(request)otRequested=true;
      step=gen.next(request?{timeout:true}:undefined);
    }
    assert.equal(seen13to12,true);
    assert.deepEqual(otRemaining,[1,0,0,0,0,0]);
    assert.equal(step.value.rounds,30);
    assert.deepEqual([step.value.scoreA,step.value.scoreB],[16,14]);
    assert.deepEqual(step.value.roundDetails.slice(24).map(r=>r.atkTeam),['A','B','A','B','A','B']);
    assert.ok(step.value.roundDetails.slice(24).every(r=>[...r.startingCredits.A,...r.startingCredits.B].every(m=>m===5000)));
    assert.ok([...step.value.roundDetails[12].startingCredits.A,...step.value.roundDetails[12].startingCredits.B].every(m=>m===800));
    assert.equal(step.value.timeoutState.A.regulation,2);
    assert.equal(step.value.timeoutState.A.overtime,0);
  }finally{RoundSim.prototype.run=original;}
});
test('overtime manual timeout uses its own budget and cannot spend saved regulation timeouts', () => {
  const state={weights:{atk:{rush:1},def:{hold:1}},timeoutsLeft:2,overtimeTimeoutsLeft:1};
  playerDecision(state,{timeout:true},{isOvertime:true,units:[]});
  assert.equal(state.overtimeTimeoutsLeft,0);assert.equal(state.timeoutsLeft,2);
  assert.throws(()=>playerDecision(state,{timeout:true},{isOvertime:true,units:[]}),/用完/);
});
