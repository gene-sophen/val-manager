const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../config');
const { RoundSim } = require('../round');

function entryAttempt(together) {
  const entrant = { name: 'entry', side: 'atk', node: 'mid_node', alive: true, syn: 100, holdTicks: 0, dashUntil: -99 };
  const holder = { name: 'holder', side: 'def', node: 'mid_node', alive: true, holdTicks: 3, sen: 60, stun: 0 };
  const partner = { name: 'partner', side: 'atk', node: 'mid_node', alive: true, syn: 100, holdTicks: together ? 0 : 5 };
  const round = Object.create(RoundSim.prototype);
  const fired = [];
  Object.assign(round, {
    t: 1, rng: () => 0.4, atk: [entrant, partner], def: [holder],
    occ: { mid_node: new Set([entrant, holder, partner]) },
    map: { region: () => 'mid' },
    iglAlive: () => false,
    emit: () => {}, addInfo: () => {},
    tryKill: () => { fired.push(true); return false; }
  });
  round.entryFight(entrant);
  return fired.length;
}

test('sync threshold is a defined positive integer', () => {
  assert.equal(cfg.combat.syncMin, 2);
});

test('two recent entrants reduce the holder first-shot chance', () => {
  assert.equal(entryAttempt(false), 1);
  assert.equal(entryAttempt(true), 0);
});
