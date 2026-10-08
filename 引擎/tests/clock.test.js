const test = require('node:test');
const assert = require('node:assert/strict');
const { makePlantedRound } = require('./helpers/scenario');

test('stepwise and automatic round execution have identical events and result', () => {
  const options = { spikeLeft: 16, travelTicks: 2, seed: 42 };
  const automatic = makePlantedRound(options);
  const stepped = makePlantedRound(options);
  const expected = automatic.round.run();
  while (!stepped.round.result) stepped.round.step();
  assert.deepEqual(stepped.round.result, expected);
  assert.deepEqual(stepped.events, automatic.events);
  assert.equal(stepped.events.filter(e => e.type === 'round_start').length, 1);
  assert.equal(stepped.events.filter(e => e.type === 'round_end').length, 1);
  stepped.round.step();
  assert.equal(stepped.events.filter(e => e.type === 'round_end').length, 1);
});
