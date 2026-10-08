const test = require('node:test');
const assert = require('node:assert/strict');
const { createState } = require('../legacy/state');
const { applyCommand } = require('../legacy/commands');
const { allAgents } = require('../../引擎/agents');
const { snapshotAt } = require('../../引擎/snapshot');
const map = require('../../引擎/maps/ascent.json');

function dispatch(state, type, payload = {}, id = `${type}-${state.revision}`) {
  return applyCommand(state, { id, expectedRevision: state.revision, type, payload });
}

function ready() {
  let state = dispatch(createState(), 'begin_run', { runId: 'test-run', seed: 42 });
  state = dispatch(state, 'open_pack', { tier: 'starter', region: 'CN' });
  state = dispatch(state, 'acknowledge_pack');
  const unique = [];
  const seen = new Set();
  for (const card of state.activeRun.ownedCards) {
    if (seen.has(card.playerId)) continue;
    seen.add(card.playerId);
    unique.push(card);
    if (unique.length === 5) break;
  }
  assert.equal(unique.length, 5);
  state = dispatch(state, 'set_lineup', {
    instanceIds: unique.map(card => card.instanceId),
    iglInstanceId: unique[0].instanceId,
    agentAssignments: Object.fromEntries(unique.map((card, index) => [card.instanceId, allAgents()[index]])),
    tactics: { atk: { rush: 0.4, mid: 0.3, lurk: 0.2, fake: 0.1 }, def: { push: 0.2, hold: 0.6, stack: 0.2 } }
  });
  return state;
}

test('four fixtures, growth, stage supplement and career reset complete without hand edits', () => {
  let state = ready();
  for (let fixture = 0; fixture < 4; fixture++) {
    state = dispatch(state, 'choose_preparation', { actionId: fixture % 2 ? 'recovery' : 'training' });
    state = dispatch(state, 'start_match');
    assert.equal(state.activeRun.match.window.round, 1);
    let guard = 0;
    while (state.activeRun.match) {
      state = dispatch(state, 'advance_match');
      assert.ok(++guard <= 26, '比赛应有限结束');
    }
    assert.equal(state.activeRun.results.length, fixture + 1);
    if (state.activeRun.pendingOffer) {
      const offer = state.activeRun.pendingOffer;
      const before = structuredClone(state);
      state = dispatch(state, 'select_growth', { offerId: offer.id, optionId: offer.options[0] });
      assert.equal(before.activeRun.pendingOffer.id, offer.id);
      assert.equal(state.activeRun.growth.length, fixture + 1);
    }
    if (fixture === 1) {
      state = dispatch(state, 'claim_stage_supplement');
      assert.equal(state.activeRun.unopenedPacks.starter, 1);
      assert.throws(() => dispatch(state, 'claim_stage_supplement'), /不能领取/);
      state = dispatch(state, 'open_pack', { tier: 'starter', region: 'PAC' });
      state = dispatch(state, 'acknowledge_pack');
    }
    if (fixture < 3) state = dispatch(state, 'next_fixture');
  }
  assert.equal(state.activeRun.results.length, 4);
  assert.equal(state.activeRun.league.games.length, 10);
  assert.equal(state.activeRun.league.standings.length, 5);
  assert.equal(state.activeRun.growth.length, 3);
  const triggered = new Set(state.activeRun.results.flatMap(result => result.eventLog.filter(event => event.type === 'growth_trigger').map(event => event.growthId)));
  assert.ok(triggered.size >= 2, `两次不同成长应在后续比赛有行为证据，当前仅触发 ${[...triggered]}`);
  state = dispatch(state, 'finish_run');
  assert.equal(state.activeRun, null);
  assert.equal(state.career.runHistory.length, 1);
  assert.ok(Object.keys(state.career.album).length > 0);
  state = dispatch(state, 'begin_run', { runId: 'second-run', seed: 43 });
  assert.equal(state.activeRun.ownedCards.length, 0);
  assert.equal(state.activeRun.growth.length, 0);
});

test('round checkpoint resumes deterministically and duplicate advance is idempotent', () => {
  let state = ready();
  state = dispatch(state, 'start_match');
  const restored = structuredClone(state);
  const startEvent = state.activeRun.match.latestEvents.find(event => event.type === 'round_start');
  assert.equal(new Set(startEvent.units.map(unit => unit.id)).size, 10);
  const savedEvents = state.activeRun.match.latestEvents;
  const lastTick = Math.max(...savedEvents.map(event => event.t));
  const finalFrame = snapshotAt(savedEvents, lastTick, map);
  assert.equal(Object.keys(finalFrame.units).length, 10);
  for (const unit of Object.values(finalFrame.units)) {
    assert.ok(Number.isFinite(unit.position.x) && Number.isFinite(unit.position.y));
  }
  assert.deepEqual(snapshotAt(structuredClone(savedEvents), lastTick, map), finalFrame);
  const command = { id: 'next-round', expectedRevision: state.revision, type: 'advance_match', payload: { decision: null } };
  const a = applyCommand(state, command);
  const b = applyCommand(restored, command);
  assert.deepEqual(a.activeRun.match.window, b.activeRun.match.window);
  assert.deepEqual(a.activeRun.match.latestEvents, b.activeRun.match.latestEvents);
  assert.equal(applyCommand(a, command), a);
});

test('an undefeated or winless completed run receives the correct career record', () => {
  for (const winner of ['A', 'B']) {
    let state = ready();
    state.activeRun.results = Array.from({ length: 4 }, (_, index) => ({
      fixtureId: `fixture-${index + 1}`, opponent: `opponent-${index + 1}`, winner,
      scoreA: winner === 'A' ? 13 : 4, scoreB: winner === 'A' ? 4 : 13
    }));
    state.activeRun.fixtureIndex = 3;
    state = dispatch(state, 'finish_run');
    assert.equal(state.career.runHistory[0].wins, winner === 'A' ? 4 : 0);
    assert.equal(state.career.honors.length, winner === 'A' ? 1 : 0);
  }
});
