const test = require('node:test');
const assert = require('node:assert/strict');
const { simulateMatch } = require('../match');
const { resolveTeam } = require('../teams');
const { GameMap } = require('../gamemap');
const { mulberry32 } = require('../rng');
const mapData = require('../maps/ascent.json');
const cfg = require('../config');

test('the full node map completes consecutive games with legal scores and defuse evidence', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const setup = mulberry32(seed);
    const teamA = resolveTeam({ name: 'A', tiers: ['金', '银', '银', '铜', '铜'] }, setup);
    const teamB = resolveTeam({ name: 'B', tiers: ['金', '银', '银', '银', '铜'] }, setup);
    const events = [];
    const result = simulateMatch({ teamA, teamB, map: new GameMap(mapData), rng: mulberry32(seed + 900), logger: event => events.push(event) });
    assert.equal(result.scoreA + result.scoreB, result.rounds, `seed ${seed}`);
    assert.ok(Math.abs(result.scoreA - result.scoreB) >= 2, `seed ${seed}`);
    assert.ok(Math.max(result.scoreA, result.scoreB) >= cfg.match.firstTo, `seed ${seed}`);
    if (result.rounds <= 24) assert.equal(Math.max(result.scoreA, result.scoreB), 13);
    else assert.equal(Math.abs(result.scoreA - result.scoreB), 2);
    assert.ok(result.roundDetails.every(round => round.ticks <= cfg.round.maxTicks + cfg.round.spikeTicks + 1), `seed ${seed}`);
    const defuses = result.roundDetails.filter(round => round.reason === 'defuse');
    for (const round of defuses) assert.ok(events.some(event => event.round === round.round && event.type === 'defuse'), `seed ${seed}, round ${round.round}`);
  }
});

test('same-named players on both sides have stable distinct event identities', () => {
  const rng = mulberry32(99);
  const spec = { name: 'Mirror', tiers: ['银', '银', '银', '银', '银'] };
  const teamA = resolveTeam(spec, rng);
  const teamB = { ...teamA, name: 'Mirror B' };
  const events = [];
  simulateMatch({ teamA, teamB, map: new GameMap(mapData), rng: mulberry32(102), logger: event => events.push(event), matchCfg: { firstTo: 2, halfRounds: 1 } });
  const start = events.find(event => event.type === 'round_start');
  assert.equal(new Set(start.units.map(unit => unit.id)).size, 10);
  assert.ok(events.filter(event => event.type === 'kill').every(event => event.killerId && event.victimId));
});
