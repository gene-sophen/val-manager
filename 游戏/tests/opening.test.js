const test = require('node:test');
const assert = require('node:assert/strict');
const { createState } = require('../state');
const catalog = require('../catalog');
const { dispatch, opened, ready } = require('./helpers/season');

test('home team comes before three visible CN packs; all thirty openings unlock album atomically', () => {
  const start = dispatch(createState(), 'begin_run', { runId: 'r', seed: 42 });
  assert.throws(() => dispatch(start, 'open_initial_packs'), /主队|阶段/);
  assert.throws(() => dispatch(start, 'select_home_team', { teamId: 'AT' }), /主队|席位/);
  const state = opened();
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.activeRun.homeTeamId, 'EDG');
  assert.equal(state.activeRun.starterPacks.length, 3);
  assert.equal(state.activeRun.ownedCards.length, 0);
  for (const pack of state.activeRun.starterPacks) {
    assert.equal(pack.instances.length, 10);
    assert.equal(new Set(pack.instances.map(i => i.cardId)).size, 10);
    assert.ok(pack.instances.every(i => catalog.getCard(i.cardId).region === 'CN'));
  }
  assert.equal(Object.values(state.career.album).reduce((a, b) => a + b, 0), 30);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored.activeRun.starterPacks, state.activeRun.starterPacks);
  assert.throws(() => dispatch(restored, 'open_initial_packs'), /阶段|已经/);
  assert.deepEqual(dispatch(createState(), 'begin_run', { runId: 'r', seed: 42 }).career.album, {});
});

test('only one whole pack is eligible; selecting five does not require hero or role micro-management', () => {
  const state = opened();
  const chosen = dispatch(state, 'select_initial_pack', { packId: state.activeRun.starterPacks[0].id });
  const normal = chosen.activeRun.ownedCards.filter(i => catalog.getCard(i.cardId).tier !== '钻').slice(0, 5);
  const foreign = state.activeRun.starterPacks[1].instances[0];
  assert.throws(() => dispatch(chosen, 'confirm_lineup', { instanceIds: [foreign.instanceId, ...normal.slice(1).map(i => i.instanceId)] }), /候选|属于/);
  assert.throws(() => dispatch(chosen, 'confirm_lineup', { instanceIds: normal.slice(0, 4).map(i => i.instanceId) }), /五名|五人/);
  const result = dispatch(chosen, 'confirm_lineup', { instanceIds: normal.map(i => i.instanceId) });
  assert.equal(result.activeRun.phase, 'ready');
  assert.equal(result.activeRun.ownedCards.length, 5);
  assert.equal(result.activeRun.registeredLineup.instanceIds.length, 5);
  assert.deepEqual(result.activeRun.registeredLineup.agentAssignments, {});
  assert.throws(() => dispatch(result, 'confirm_lineup', { instanceIds: normal.map(i => i.instanceId) }), /阶段|锁定/);
  assert.throws(() => dispatch(result, 'select_initial_pack', { packId: state.activeRun.starterPacks[1].id }), /阶段|锁定/);
  assert.throws(() => dispatch(result, 'choose_preparation', { actionId: 'training' }), /旧|支持|未知/);
});

test('failed and stale opening commands never partially modify state; exact retries are idempotent', () => {
  const state = opened();
  const before = structuredClone(state);
  assert.throws(() => dispatch(state, 'select_initial_pack', { packId: 'missing' }), /卡包/);
  assert.deepEqual(state, before);
  const command = { id: 'select-once', type: 'select_initial_pack', expectedRevision: state.revision, payload: { packId: state.activeRun.starterPacks[0].id } };
  const { applyCommand } = require('../commands');
  const next = applyCommand(state, command);
  assert.equal(applyCommand(next, command), next);
  assert.throws(() => applyCommand(next, { ...command, id: 'stale' }), /版本/);
});

test('abandoning a partial run preserves album and cannot reuse the same run identity', () => {
  const state = ready();
  const next = dispatch(state, 'abandon_run');
  assert.equal(next.activeRun, null);
  assert.deepEqual(next.career.album, state.career.album);
  assert.equal(next.career.honors.length, 0);
  assert.equal(next.career.runHistory[0].status, 'abandoned');
  assert.throws(() => dispatch(next, 'begin_run', { runId: 'season-42', seed: 1 }), /身份|使用/);
});
