const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../config');
const { makePlantedRound } = require('./helpers/scenario');

test('eliminating all attackers does not shortcut an impossible defuse', () => {
  const { round, events } = makePlantedRound({ spikeLeft: 5, travelTicks: 20 });
  const result = round.run();
  assert.equal(result.winner, 'atk');
  assert.equal(result.reason, 'explosion');
  assert.equal(events.filter(e => e.type === 'defuse').length, 0);
});

test('defenders with enough time must reach the site and complete a real defuse', () => {
  const { round, events } = makePlantedRound({ spikeLeft: 16, travelTicks: 2 });
  const result = round.run();
  assert.equal(result.winner, 'def');
  assert.equal(result.reason, 'defuse');
  assert.equal(result.defuser.name, 'defender-0');
  assert.ok(events.some(e => e.type === 'arrive'));
  assert.ok(events.some(e => e.type === 'defuse_start'));
  assert.ok(events.some(e => e.type === 'defuse'));
  assert.ok(events.findIndex(e => e.type === 'defuse') < events.findIndex(e => e.type === 'round_end'));
});

test('defuse cannot complete if the spike reaches zero at the tick boundary', () => {
  const { round, events } = makePlantedRound({ spikeLeft: cfg.round.defuseTicks });
  const result = round.run();
  assert.equal(result.reason, 'explosion');
  assert.ok(events.some(e => e.type === 'defuse_start'));
  assert.equal(events.filter(e => e.type === 'defuse').length, 0);
});

test('a non-eliminated attacker can interrupt a defuse before it completes', () => {
  const { round, events } = makePlantedRound({ spikeLeft: 14, attackerAlive: true, interruptAt: 2 });
  const result = round.run();
  assert.equal(result.reason, 'defuse');
  assert.ok(events.some(e => e.type === 'defuse_abort'));
  assert.equal(events.filter(e => e.type === 'defuse').length, 1);
});

test('when both teams have no survivors after a plant, defenders cannot defuse', () => {
  const { round, events } = makePlantedRound({ spikeLeft: 10, defenders: 0 });
  const result = round.run();
  assert.equal(result.winner, 'atk');
  assert.equal(result.reason, 'elimination');
  assert.equal(events.filter(e => e.type === 'defuse').length, 0);
});

test('a queued defender revival is resolved before an elimination victory', () => {
  const { round, events, def } = makePlantedRound({ spikeLeft: 12, attackerAlive: true });
  def[0].alive = false;
  def[0].hp = 0;
  round.occ.a_site.delete(def[0]);
  round.reviveQueue.push({ unit: def[0], node: 'a_site', at: 2, agent: 'test', skillName: 'revive' });
  round.step();
  assert.equal(round.result, null);
  round.step();
  assert.equal(round.result, null);
  round.step();
  assert.equal(def[0].alive, true);
  assert.equal(def[0].hp, 100);
  assert.equal(round.result, null);
  assert.ok(events.some(event => event.type === 'ability' && event.archetype === 'revive' && event.hp === 100));
});
