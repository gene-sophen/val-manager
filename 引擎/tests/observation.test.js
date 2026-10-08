const test = require('node:test');
const assert = require('node:assert/strict');
const { canObserve, recordObservations, observedRegionalCounts } = require('../observation');
const { RoundSim } = require('../round');
const { GameMap } = require('../gamemap');
const mapData = require('../maps/ascent.json');
const siteGeometry = require('../maps/ascent_site_test.json');
const abilities = require('../abilities');

test('hidden defensive distribution does not become a free mid-round read', () => {
  const map = new GameMap(mapData);
  const make = (hiddenNode) => {
    const round = Object.create(RoundSim.prototype);
    const attacker = { side: 'atk', alive: true, node: 'mid', post: 'mid_catwalk', sen: 80 };
    const defender = { side: 'def', alive: true, node: hiddenNode, post: null };
    const events = [];
    Object.assign(round, {
      map, atk: [attacker], def: [defender], t: 10, planted: false,
      flags: {}, spike: { carrier: attacker },
      atkIntent: { family: 'mid', site: 'A', pace: { contactTick: 5 } },
      defInfo: { A: { strength: 0, suspicious: false }, B: { strength: 0, suspicious: false } },
      rng: () => 0, emit: (type, event) => events.push({ type, ...event }),
      iglAlive: () => false, sightBlocked: () => false
    });
    round.updateTeamState();
    return { site: round.atkIntent.site, events };
  };
  assert.deepEqual(make('a_site'), make('b_site'));
});

test('a visible defender is counted only in the observed region', () => {
  const map = new GameMap(mapData);
  const attacker = { side: 'atk', alive: true, node: 'a_site', post: 'a_site_default' };
  const visible = { side: 'def', alive: true, node: 'a_site', post: 'a_site_open' };
  const hidden = { side: 'def', alive: true, node: 'b_site', post: null };
  const round = { map, sightBlocked: () => false };
  assert.deepEqual(observedRegionalCounts(round, [attacker], [visible, hidden]), { A: 1, B: 0 });
});

test('recon scans its target site without revealing the other site', () => {
  const map = new GameMap(mapData);
  const make = (hiddenCount) => {
    const events = [];
    const user = { side: 'atk', node: 'a_lobby', name: 'scout', targetSite: 'A', inPool: true,
      mentality: 0, syn: 70, agent: 'scout', post: null, alive: true };
    const round = {
      map, atk: [user], def: [{ node: 'a_site', alive: true },
        ...Array.from({ length: hiddenCount }, () => ({ node: 'b_site', alive: true }))],
      flags: {}, t: 5, rng: () => 0.5,
      stats: { utilsAtk: 0, utilsDef: 0, utilsByType: {}, abilityByArchetype: {} },
      synFactor: () => 1, emit: (type, details) => events.push({ type, ...details })
    };
    const skill = { left: 1, def: { archetype: 'recon', key: 'c', name: 'recon', params: {} } };
    abilities.exec(round, user, skill);
    return { recon: round.flags.atkRecon, result: events.find(event => event.type === 'recon_result') };
  };
  assert.deepEqual(make(0), make(3));
  assert.deepEqual(make(0).recon, { site: 'A', count: 1 });
});

test('a wall and live smoke hide a target; sightings expire after eight ticks', () => {
  const map = new GameMap(mapData, siteGeometry);
  const attacker = { id: 'A:0', side: 'atk', name: 'attacker', alive: true, node: 'a_site',
    post: null, position: { x: 150, y: 285 } };
  const defender = { id: 'B:0', side: 'def', name: 'defender', alive: true, node: 'a_site',
    post: null, position: { x: 180, y: 285 } };
  const events = [];
  const round = { map, t: 0, units: [attacker, defender], geometrySmokes: [],
    observations: { atk: {}, def: {} }, emit: (type, payload) => events.push({ type, ...payload }) };
  assert.equal(canObserve(round, attacker, defender), false);
  defender.position = { x: 145, y: 275 };
  round.geometrySmokes.push({ x: 147, y: 280, radius: 10, until: 3 });
  assert.equal(canObserve(round, attacker, defender), false);
  round.t = 3;
  recordObservations(round);
  assert.equal(round.observations.atk['B:0'].lastSeenTick, 3);
  assert.ok(events.some(event => event.type === 'sighting' && event.targetId === 'B:0'));
  defender.position = { x: 180, y: 285 };
  round.t = 12;
  recordObservations(round);
  assert.equal(round.observations.atk['B:0'], undefined);
});
