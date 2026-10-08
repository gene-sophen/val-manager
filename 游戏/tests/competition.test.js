const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../content/competition.json');
const { computeDemoLeague } = require('../competition');
const { calculateStandings } = require('../standings');

test('fictional demo schedule contains every pair exactly once', () => {
  const pairs = config.games.map(([a, b]) => [a, b].sort().join('|'));
  assert.equal(config.games.length, 10);
  assert.equal(new Set(pairs).size, 10);
  assert.equal(config.games.filter(pair => pair.includes('PLAYER')).length, 4);
  assert.equal(config.status, 'fictional-test-format');
});

test('non-player games use fixed seeds and real player results determine first or last place', () => {
  function run(winner) {
    return { seed: 42, results: Array.from({ length: 4 }, (_, index) => ({
      fixtureId: `fixture-${index + 1}`,
      scoreA: winner === 'A' ? 13 : 0, scoreB: winner === 'A' ? 0 : 13
    })) };
  }
  const undefeated = computeDemoLeague(run('A'));
  const winless = computeDemoLeague(run('B'));
  assert.deepEqual(undefeated, computeDemoLeague(run('A')));
  assert.equal(undefeated.standings.find(row => row.id === 'PLAYER').place, 1);
  assert.equal(winless.standings.find(row => row.id === 'PLAYER').place, 5);
  assert.equal(undefeated.games.filter(game => game.source === 'same-engine-simulation').length, 6);
});

test('standings use explicit wins, round difference, then rounds scored', () => {
  const ranked = calculateStandings(['A', 'B', 'C'], [
    { a: 'A', b: 'B', scoreA: 13, scoreB: 10 },
    { a: 'C', b: 'A', scoreA: 13, scoreB: 11 },
    { a: 'B', b: 'C', scoreA: 13, scoreB: 5 }
  ]);
  assert.deepEqual(ranked.map(row => row.id), ['B', 'A', 'C']);
  assert.deepEqual(ranked.map(row => row.wins), [1, 1, 1]);
  assert.throws(() => calculateStandings(['A', 'B'], [{ a: 'A', b: 'B', scoreA: 13, scoreB: 13 }]), /无效/);
});
