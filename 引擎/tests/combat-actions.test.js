const test = require('node:test');
const assert = require('node:assert/strict');
const { RoundSim } = require('../round');
const { GameMap } = require('../gamemap');
const geometry = require('../maps/ascent_site_test.json');
const mapData = require('../maps/ascent.json');

function duel(roll = 0) {
  const map = new GameMap(mapData, geometry);
  const attacker = { id: 'A:0', name: 'attacker', side: 'atk', alive: true, node: 'a_site', post: 'a_site_default',
    position: { x: 150, y: 300 }, gun: 0, ammo: 1, aim: 80, holdTicks: 3, stun: 0, roundKills: 0 };
  const target = { id: 'B:0', name: 'target', side: 'def', alive: true, node: 'a_site', post: 'a_site_gen',
    position: { x: 145, y: 285 }, gun: 0, hp: 100, aim: 70, holdTicks: 3, armor: 'none' };
  const events = [];
  const round = Object.create(RoundSim.prototype);
  Object.assign(round, { t: 0, map, units: [attacker, target], atk: [attacker], def: [target],
    occ: { a_site: new Set([attacker, target]) }, postOcc: {}, smokedSight: {}, tradeQueue: [], reviveQueue: [],
    hooks: { beforeKillRoll: [], onKill: [] }, rng: () => roll,
    emit: (type, data) => events.push({ type, ...data }),
    releasePost: () => {} });
  return { round, attacker, target, events };
}

test('geometry duel uses shot, damage, and health before death', () => {
  const { round, attacker, target, events } = duel();
  assert.equal(round.tryKill(attacker, target, false), false);
  assert.equal(target.hp, 66);
  assert.equal(attacker.ammo, 0);
  assert.deepEqual(events.map(event => event.type), ['shot', 'damage']);
});

test('a wall blocks shot generation and ammunition loss', () => {
  const { round, attacker, target, events } = duel();
  attacker.position = { x: 150, y: 285 };
  target.position = { x: 180, y: 285 };
  assert.equal(round.tryKill(attacker, target, false), false);
  assert.equal(attacker.ammo, 1);
  assert.equal(events.length, 0);
});

test('active geometric smoke blocks a clear visual shot until expiry', () => {
  const { round, attacker, target, events } = duel();
  round.geometrySmokes = [{ x: 147, y: 293, radius: 10, until: 5 }];
  assert.equal(round.tryKill(attacker, target, false), false);
  assert.equal(events.length, 0);
  round.t = 5;
  round.tryKill(attacker, target, false);
  assert.ok(events.some(event => event.type === 'shot'));
});

test('empty magazine blocks firing until reload completes', () => {
  const { round, attacker, target, events } = duel();
  round.tryKill(attacker, target, false);
  round.t = 1;
  assert.equal(round.tryKill(attacker, target, false), false);
  assert.ok(events.some(event => event.type === 'reload_start'));
  const shotCount = events.filter(event => event.type === 'shot').length;
  round.t = 2;
  assert.equal(round.tryKill(attacker, target, false), false);
  assert.equal(events.filter(event => event.type === 'shot').length, shotCount);
  round.t = 3;
  round.tryKill(attacker, target, false);
  assert.ok(events.some(event => event.type === 'reload_end'));
  assert.equal(events.filter(event => event.type === 'shot').length, shotCount + 1);
});

test('a kill schedules a trade for a later tick rather than recursive instant retaliation', () => {
  const { round, attacker, target, events } = duel();
  target.hp = 20;
  round.tryKill(attacker, target, false);
  assert.equal(target.alive, false);
  assert.equal(round.tradeQueue.length, 1);
  assert.equal(round.tradeQueue[0].at, 1);
  assert.deepEqual(events.slice(-2).map(event => event.type), ['damage', 'kill']);
});
