const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatch, ready } = require('./helpers/season');
const { enterNextStage } = require('../season-flow');
const catalog = require('../catalog');

function completeStage(state) {
  const next = structuredClone(state);
  next.activeRun.stageHistory.push({ stageId: next.activeRun.stageId, completed: true, qualified: false });
  return enterNextStage(next);
}
test('calendar transitions deliver exactly two CN reinforcement packs even when both Masters are missed', () => {
  let state = ready();
  assert.throws(() => enterNextStage(state), /完成/);
  const delivered = [];
  for (let i = 0; i < 7; i++) {
    state = completeStage(state);
    if (state.activeRun.pendingReinforcement) {
      const pack = state.activeRun.pendingReinforcement;
      delivered.push(pack.tier);
      assert.equal(pack.instances.length, 10);
      assert.ok(pack.instances.every(i => catalog.getCard(i.cardId).region === 'CN'));
      const old = state.activeRun.registeredLineup.instanceIds;
      const albumBefore = Object.values(state.career.album).reduce((a, b) => a + b, 0);
      state = dispatch(state, 'confirm_reinforcement', { instanceIds: old });
      assert.equal(Object.values(state.career.album).reduce((a, b) => a + b, 0), albumBefore);
      assert.throws(() => dispatch(state, 'confirm_reinforcement', { instanceIds: old }), /阶段|补强/);
    }
  }
  assert.deepEqual(delivered, ['enhanced', 'summit']);
  assert.equal(state.activeRun.stageId, 'champions');
  assert.equal(Object.values(state.career.album).reduce((a, b) => a + b, 0), 50);
});
test('reinforcement replacement is atomic, has no bench and cannot recall released instances', () => {
  let state = completeStage(completeStage(ready()));
  const before = structuredClone(state);
  const old = state.activeRun.registeredLineup.instanceIds;
  const normal = state.activeRun.pendingReinforcement.instances.filter(i => catalog.getCard(i.cardId).tier !== '钻').slice(0, 5);
  assert.throws(() => dispatch(state, 'confirm_reinforcement', { instanceIds: [...old, normal[0].instanceId] }), /五/);
  assert.deepEqual(state, before);
  state = dispatch(state, 'confirm_reinforcement', { instanceIds: normal.map(i => i.instanceId) });
  assert.equal(state.activeRun.ownedCards.length, 5);
  assert.equal(state.activeRun.departures.length, 5);
  assert.ok(old.every(id => !state.activeRun.ownedCards.some(i => i.instanceId === id)));
  while (state.activeRun.stageIndex < 5) state = completeStage(state);
  assert.throws(() => dispatch(state, 'confirm_reinforcement', { instanceIds: old }), /候选|属于/);
});
