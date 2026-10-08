const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../maps/ascent_site_test.json');
const { Geometry } = require('../geometry');
const { GameMap } = require('../gamemap');
const { RoundSim } = require('../round');
const fullMap = require('../maps/ascent.json');

const geometry = new Geometry(data);

test('same old map node can still have blocked sight and no direct walk', () => {
  const left = { x: 150, y: 285 };
  const right = { x: 180, y: 285 };
  assert.equal(geometry.contains(left), true);
  assert.equal(geometry.contains(right), true);
  assert.equal(geometry.lineOfSight(left, right), false);
  assert.equal(geometry.canTraverse(left, right), false);
  const route = geometry.route(left, right);
  assert.ok(route && route.length >= 3);
  for (let i = 1; i < route.length; i++) assert.equal(geometry.canTraverse(route[i - 1], route[i]), true);
});

test('smoke blocks a clear sightline without removing walkability', () => {
  const a = { x: 100, y: 450 }, b = { x: 120, y: 400 };
  const smoke = [{ x1: 85, y1: 420, x2: 150, y2: 420 }];
  assert.equal(geometry.lineOfSight(a, b), true);
  assert.equal(geometry.lineOfSight(a, b, smoke), false);
  assert.equal(geometry.canTraverse(a, b), true);
});

test('a direct route cannot leave the playable corridor', () => {
  const a = { x: 200, y: 600 }, b = { x: 310, y: 120 };
  assert.equal(geometry.canTraverse(a, b), false);
  const route = geometry.route(a, b);
  assert.ok(route && route.length >= 3);
  for (let i = 1; i < route.length; i++) assert.equal(geometry.canTraverse(route[i - 1], route[i]), true);
});

test('the existing A-site combat uses the geometry overlay when it is supplied', () => {
  const map = new GameMap(fullMap, data);
  assert.equal(map.canSee('a_site_default', 'a_site_dice'), false);
  const a = { name: 'A', side: 'atk', alive: true, node: 'a_site', post: 'a_site_default', planting: 0, defusing: 0, holdTicks: 1 };
  const b = { name: 'B', side: 'def', alive: true, node: 'a_site', post: 'a_site_dice', planting: 0, defusing: 0, holdTicks: 1 };
  let shots = 0;
  const round = Object.create(RoundSim.prototype);
  Object.assign(round, {
    map, occ: { a_site: new Set([a, b]) }, units: [a, b], atk: [a], def: [b],
    rng: () => 0, tryKill: () => { shots++; return false; }
  });
  round.resolveCombat();
  assert.equal(shots, 0);
});

test('a moving attacker remains exposed to a defender with a clear line', () => {
  const map = new GameMap(fullMap, data);
  const holder = { name: 'holder', side: 'def', node: 'a_heaven', post: 'a_heaven_rail', alive: true,
    holdTicks: 3, stun: 0, planting: 0, defusing: 0 };
  const mover = { name: 'mover', side: 'atk', node: 'a_lobby', post: null, alive: true,
    position: { x: 145, y: 350 }, moving: { left: 2 }, planting: 0, defusing: 0 };
  const round = Object.create(RoundSim.prototype);
  let shots = 0;
  Object.assign(round, {
    map, occ: { a_heaven: new Set([holder]), a_lobby: new Set() },
    units: [holder, mover], atk: [mover], def: [holder], rng: () => 0,
    tryKill: () => { shots++; return false; }
  });
  round.resolveCombat();
  assert.equal(shots, 1);
});

test('a geometry-enabled move uses a route around the A-site wall', () => {
  const map = new GameMap(fullMap, data);
  const mover = { name: 'mover', side: 'atk', node: 'a_lobby', post: 'a_lobby_open',
    position: { x: 110, y: 425 }, alive: true, syn: 70, sen: 70, rotating: false,
    moving: null, stun: 0, utils: 0, holdTicks: 0 };
  const round = Object.create(RoundSim.prototype);
  const emitted = [];
  Object.assign(round, {
    t: 0, map, units: [mover], atk: [mover], def: [], rng: () => 1, committedSite: 'A',
    occ: { a_lobby: new Set([mover]), a_site: new Set() },
    postOcc: { a_lobby_open: mover }, smokedEdges: {}, walledEdges: {}, traps: {},
    presetMolly: {}, defEntryMolly: { A: false, B: false }, mollyZone: null,
    pickPost: () => 'a_site_dice', iglUnit: () => null,
    emit: (type, event) => emitted.push({ type, ...event }),
    entryFight: () => {}, think: () => {}, edgeKey: (a, b) => `${a}|${b}`
  });
  assert.equal(round.startMove(mover, 'a_site', 'run'), true);
  assert.ok(mover.moving.route.length > 2);
  const steps = mover.moving.total;
  for (let i = 0; i < steps; i++) round.updateMovement();
  assert.deepEqual(mover.position, { x: 170, y: 268 });
  assert.equal(mover.node, 'a_site');
  assert.ok(emitted.some(event => event.type === 'move' && event.route.length > 2));
});
