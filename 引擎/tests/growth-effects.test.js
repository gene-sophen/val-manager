const test = require('node:test');
const assert = require('node:assert/strict');
const { RoundSim } = require('../round');
const { playerDecision } = require('../match');

function entryAttempt(growthIds, partnerHold, roll) {
  const entrant = { name: 'entry', side: 'atk', node: 'site', alive: true, syn: 100, holdTicks: 0, dashUntil: -99 };
  const partner = { name: 'partner', side: 'atk', node: 'site', alive: true, syn: 100, holdTicks: partnerHold };
  const holder = { name: 'holder', side: 'def', node: 'site', alive: true, holdTicks: 3, sen: 60, stun: 0 };
  const events = [];
  const round = Object.create(RoundSim.prototype);
  let shots = 0;
  Object.assign(round, {
    t: 1, rng: () => roll, atk: [entrant, partner], def: [holder],
    occ: { site: new Set([entrant, partner, holder]) },
    map: { region: () => 'A' }, growthEffects: { atk: growthIds, def: [] },
    growthTriggered: new Set(), iglAlive: () => false,
    emit: (type, data) => events.push({ type, ...data }), addInfo: () => {},
    tryKill: () => { shots++; return false; }
  });
  round.entryFight(entrant);
  return { shots, events };
}

test('synchronized-entry growth changes an actual first-shot boundary', () => {
  assert.equal(entryAttempt([], 1, .31).shots, 1);
  const grown = entryAttempt(['entry-sync'], 1, .31);
  assert.equal(grown.shots, 0);
  assert.ok(grown.events.some(event => event.type === 'growth_trigger' && event.growthId === 'entry-sync'));
});

test('rehearsal extends the real synchronization window', () => {
  assert.equal(entryAttempt([], 4, .5).shots, 1);
  const grown = entryAttempt(['entry-rehearsal'], 4, .5);
  assert.equal(grown.shots, 0);
  assert.ok(grown.events.some(event => event.growthId === 'entry-rehearsal'));
});

test('retake growth shortens a real defensive move and timeout recovery changes mentality', () => {
  function move(growthIds) {
    const unit = { name: 'def', side: 'def', node: 'a', alive: true, rotating: true, syn: 70, sen: 70, post: null,
      position: { x: 0, y: 0 }, moving: null, holdTicks: 0 };
    const round = Object.create(RoundSim.prototype);
    const events = [];
    Object.assign(round, {
      t: 0, map: { nextHop: { a: { b: 'b' } }, edgeBetween: () => ({ ticks: 5, exposure: 0 }),
        postsAt: () => [], nodes: { a: { x: 0, y: 0 }, b: { x: 5, y: 0 } } },
      occ: { a: new Set([unit]) }, postOcc: {}, smokedEdges: {}, walledEdges: {},
      growthEffects: { atk: [], def: growthIds }, growthTriggered: new Set(),
      iglUnit: () => null, edgeKey: () => 'a|b', emit: (type, data) => events.push({ type, ...data })
    });
    round.startMove(unit, 'b', 'run');
    return { ticks: unit.moving.total, events };
  }
  const base = move([]), grown = move(['retake-rally']);
  assert.equal(grown.ticks, base.ticks - 1);
  assert.ok(grown.events.some(event => event.growthId === 'retake-rally'));
  const state = { weights: { atk: { rush: 1 }, def: { hold: 1 } }, iglPick: 'a', timeoutsLeft: 2, halftimeUsed: false };
  const units = [{ name: 'a', mentality: -0.5 }];
  playerDecision(state, { timeout: true }, { isHalftime: false, units, growthIds: ['timeout-reset'] });
  const baseUnits = [{ name: 'a', mentality: -0.5 }];
  playerDecision({ ...state, timeoutsLeft: 2 }, { timeout: true }, { units: baseUnits });
  assert.ok(units[0].mentality > baseUnits[0].mentality);
  assert.ok(units[0].mentality < 0);
});
