const test = require('node:test');
const assert = require('node:assert/strict');
const { createRun } = require('../legacy/state');
const { offerPreparation, choosePreparation } = require('../preparation');

test('one deterministic event offers three mutually exclusive preparations', () => {
  const run = createRun({ id: 'r', seed: 21 });
  assert.deepEqual(offerPreparation(run), offerPreparation(structuredClone(run)));
  assert.equal(offerPreparation(run).actions.length, 3);
  run.preparation = choosePreparation(run, 'training');
  assert.equal(run.preparation.effectId, 'entry-rehearsal');
  assert.throws(() => choosePreparation(run, 'recovery'), /已使用/);
});

test('scouting reports fixed tendency with provenance, not hidden round instructions', () => {
  const run = createRun({ id: 'r', seed: 22 });
  const result = choosePreparation(run, 'scout');
  assert.equal(result.effectId, null);
  assert.equal(result.tendency.atk.source, '固定队伍公开倾向');
  assert.equal(result.tendency.def.family, 'hold');
  assert.ok(!('roundPlan' in result));
});
