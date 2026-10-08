const test = require('node:test');
const assert = require('node:assert/strict');
const { offerGrowth, options, activeEffectIds } = require('../growth');

test('growth offers are stable, valid, and exclude owned options', () => {
  const run = { id: 'r', seed: 17, growthIndex: 0, growth: [{ optionId: options[0].id }] };
  const a = offerGrowth(run, 'fixture-1');
  assert.deepEqual(a, offerGrowth(structuredClone(run), 'fixture-1'));
  assert.equal(a.options.length, 3);
  assert.equal(new Set(a.options).size, 3);
  assert.ok(!a.options.includes(options[0].id));
});

test('exhausted growth pool returns explicit fallback', () => {
  const run = { id: 'r', seed: 17, growthIndex: 2, growth: options.map(option => ({ optionId: option.id })) };
  const offer = offerGrowth(run, 'last');
  assert.deepEqual(offer.options, []);
  assert.ok(offer.fallback);
});

test('stage choice has two actual behavior effects and does not leak into small offers', () => {
  const run = { id: 'r', seed: 18, growthIndex: 1, growth: [{ optionId: 'entry-sync' }] };
  const small = offerGrowth(run, 'fixture-1', 'small');
  const stage = offerGrowth(run, 'fixture-2', 'stage');
  assert.ok(small.options.every(id => !id.startsWith('stage-')));
  assert.ok(stage.options.every(id => id.startsWith('stage-')));
  run.growth.push({ optionId: 'stage-information' });
  assert.deepEqual(activeEffectIds(run), ['entry-sync', 'recon-focus', 'mid-shift']);
});
