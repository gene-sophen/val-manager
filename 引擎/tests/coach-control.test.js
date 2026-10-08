const test = require('node:test');
const assert = require('node:assert/strict');
const { playerDecision } = require('../match');
const { matchGen } = require('../match');
const { resolveTeam } = require('../teams');
const { loadMap } = require('../gamemap');
const { mulberry32 } = require('../rng');
const path = require('node:path');

function fixture() {
  const state = {
    weights: { atk: { rush: 0.5, mid: 0.5 }, def: { hold: 1, push: 0 } },
    iglPick: 'alpha', timeoutsLeft: 2, halftimeUsed: false
  };
  const units = [{ name: 'alpha', mentality: -0.5 }, { name: 'beta', mentality: -0.5 }];
  return { state, units };
}

test('ordinary rounds reject free tactical changes without mutating morale or timeout budget', () => {
  const { state, units } = fixture();
  const original = structuredClone(state);
  assert.throws(() => playerDecision(state, {
    timeout: false,
    weights: { atk: { rush: 3, mid: 1 }, def: { hold: 1, push: 0 } }
  }, { isHalftime: false, units }), /普通回合/);
  assert.deepEqual(state, original);
  assert.equal(units[0].mentality, -0.5);
});

test('timeout has a distinct cost and state effect', () => {
  const { state, units } = fixture();
  const change = playerDecision(state, { timeout: true }, { isHalftime: false, units });
  assert.equal(change.kind, 'timeout');
  assert.equal(state.timeoutsLeft, 1);
  assert.ok(units[0].mentality > -0.5);
});

test('invalid plan leaves the active weights and timeout count unchanged', () => {
  const { state, units } = fixture();
  assert.throws(() => playerDecision(state, { timeout: true, weights: { atk: { rush: -1, mid: 1 }, def: { hold: 1, push: 0 } } }, { isHalftime: false, units }), /无效/);
  assert.equal(state.timeoutsLeft, 2);
  assert.equal(state.weights.atk.rush, 0.5);
});

test('the match generator applies a paid timeout plan to the next round and lets its opponent adjust', () => {
  const rng = mulberry32(73);
  const teamA = resolveTeam({ name: 'A', tiers: ['金', '金', '银', '银', '铜'] }, rng);
  const teamB = resolveTeam({ name: 'B', tiers: ['银', '银', '银', '银', '银'] }, rng);
  const events = [];
  const generator = matchGen({
    teamA, teamB, map: loadMap(path.join(__dirname, '../maps/ascent.json')),
    rng, logger: event => events.push(event), playerCoach: 'A'
  });
  const first = generator.next();
  assert.equal(first.value.type, 'coach_window');
  assert.equal(first.value.timeoutsLeft.A, 2);
  const plan = {
    atk: { rush: 1, mid: 0, lurk: 0, fake: 0 },
    def: { hold: 1, push: 0, stack: 0 }
  };
  assert.equal(first.value.kind,'round');
  assert.equal(first.value.canAdjust,false);
  const second = generator.next({ timeout: true, weights: plan });
  assert.equal(second.value.type, 'coach_window');
  assert.equal(second.value.timeoutsLeft.A, 1);
  assert.equal(second.value.weights.A.atk.rush, 1);
  const adjustments=events.filter(event=>event.type==='timeout'&&event.round===1);
  assert.equal(adjustments.length,2);
  assert.equal(adjustments.filter(event=>event.timeoutInitiated).length,1);
  assert.equal(adjustments[0].timeoutCaller,'A');
});

test('shared opponent pause is free, halftime is free, exhausted and ended windows reject changes', () => {
  const { state, units } = fixture();
  state.timeoutsLeft = 0;
  const plan = { atk: { rush: 1, mid: 0 }, def: { hold: 0, push: 1 } };
  playerDecision(state,{weights:plan},{sharedTimeout:true,units});
  assert.equal(state.timeoutsLeft,0);assert.equal(state.weights.atk.rush,1);
  playerDecision(state,{weights:plan,timeout:true},{isHalftime:true,units});
  assert.equal(state.timeoutsLeft,0);assert.equal(state.halftimeUsed,true);
  const original=structuredClone(state);
  assert.throws(()=>playerDecision(state,{timeout:true},{units}),/用完/);
  assert.throws(()=>playerDecision(state,{weights:plan},{matchOver:true,units}),/结束/);
  assert.deepEqual(state,original);
});
test('pause recovery approaches neutral and never grants extra positive morale', () => {
  const { state }=fixture();
  const units=[{mentality:-0.5},{mentality:0.5}];
  playerDecision(state,{timeout:true},{units});
  assert.equal(units[0].mentality,-0.4);assert.equal(units[1].mentality,0.5);
});

test('opponent AI calls a visible shared pause, human adjusts for free, and simultaneous requests merge', () => {
  const { RoundSim }=require('../round');
  const original=RoundSim.prototype.run;
  RoundSim.prototype.run=function(){
    return {winner:this.atk[0].id.startsWith('A:')?'atk':'def',reason:'elim',ticks:1,planted:false,
      stats:{popOffs:0,whiffs:0,utilsAtk:0,utilsDef:0,fakeReads:0,fakePulled:0,utilsByType:{flash:0,smoke:0,molly:0,recon:0,trap:0},abilityByArchetype:{}}};
  };
  try{
    const setup=mulberry32(80),events=[];
    const gen=matchGen({
      teamA:resolveTeam({name:'A',tiers:Array(5).fill('银')},setup),
      teamB:resolveTeam({name:'B',tiers:Array(5).fill('银')},setup),
      map:loadMap(path.join(__dirname,'../maps/ascent.json')),rng:mulberry32(81),playerCoach:'A',logger:e=>events.push(e)
    });
    let step=gen.next();step=gen.next();
    assert.equal(step.value.round,2);
    assert.equal(step.value.timeoutCaller,'B');assert.equal(step.value.canAdjust,true);
    assert.equal(step.value.canRequestTimeout,false);
    const plan={atk:{rush:1,mid:0,lurk:0,fake:0},def:{hold:1,push:0,stack:0}};
    step=gen.next({timeout:true,weights:plan});
    assert.equal(step.value.timeoutsLeft.A,2);assert.equal(step.value.timeoutsLeft.B,1);
    assert.equal(step.value.weights.A.atk.rush,1);
    assert.equal(events.find(e=>e.type==='round_meta'&&e.round===3).atkFamily,'rush');
    assert.equal(events.filter(e=>e.round===2&&e.type==='timeout'&&e.timeoutInitiated).length,1);
    gen.return();
  }finally{RoundSim.prototype.run=original;}
});

test('shared windows and decisions restore identically from the same saved seed', () => {
  function replay(){
    const setup=mulberry32(73),events=[];
    const gen=matchGen({teamA:resolveTeam({name:'A',tiers:Array(5).fill('银')},setup),
      teamB:resolveTeam({name:'B',tiers:Array(5).fill('银')},setup),
      map:loadMap(path.join(__dirname,'../maps/ascent.json')),rng:mulberry32(91),playerCoach:'A',logger:e=>events.push(e)});
    let step=gen.next();
    step=gen.next({timeout:true});step=gen.next();step=gen.next();
    const window=structuredClone(step.value);gen.return();return{window,events};
  }
  assert.deepEqual(replay(),replay());
});
