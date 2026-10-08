const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../catalog');
const { buildLineup } = require('../lineup');
const coach = require('../../引擎/coach');
const { matchGen } = require('../../引擎/match');
const { resolveTeam } = require('../../引擎/teams');
const { loadMap } = require('../../引擎/gamemap');
const { mulberry32 } = require('../../引擎/rng');
const path = require('node:path');

function fixture() {
  const cards = catalog.cards.filter(c => c.tier !== '钻').slice(0, 5);
  const ownedCards = cards.map((card, index) => ({ instanceId: `i-${index}`, cardId: card.cardId, playerId: card.playerId }));
  const agents = ['幽影', '猎枭', '捷风', '零', '炼狱'];
  return {
    run: { ownedCards },
    selection: {
      instanceIds: ownedCards.map(item => item.instanceId),
      iglInstanceId: 'i-0',
      agentAssignments: Object.fromEntries(ownedCards.map((item, index) => [item.instanceId, agents[index]]))
    }
  };
}

test('registered lineup uses owned card versions and explicit agents', () => {
  const { run, selection } = fixture();
  const team = buildLineup(run, selection);
  assert.equal(team.players.length, 5);
  assert.equal(team.iglName, team.players[0].name);
  assert.equal(team.agentAssignments[team.players[0].cardId], '幽影');
});

test('lineup blocks missing cards, duplicate players and duplicate agents', () => {
  const { run, selection } = fixture();
  assert.throws(() => buildLineup(run, { ...selection, instanceIds: ['missing', ...selection.instanceIds.slice(1)] }), /不属于/);
  const duplicate = structuredClone(run);
  duplicate.ownedCards[1] = { instanceId: 'i-1', cardId: duplicate.ownedCards[0].cardId, playerId: duplicate.ownedCards[0].playerId };
  assert.throws(() => buildLineup(duplicate, selection), /同名/);
  assert.throws(() => buildLineup(run, { ...selection, agentAssignments: { ...selection.agentAssignments, 'i-1': '幽影' } }), /特工不能重复/);
  assert.throws(() => buildLineup(run, { ...selection, tactics: { atk: { rush: -1 }, def: { hold: 1 } } }), /无效/);
});

test('two diamond versions cannot be registered together', () => {
  const { run, selection } = fixture();
  const diamonds = catalog.cards.filter(card => card.tier === '钻').slice(0, 2);
  diamonds.forEach((card, index) => {
    run.ownedCards[index] = { instanceId: `i-${index}`, cardId: card.cardId, playerId: card.playerId };
  });
  assert.throws(() => buildLineup(run, selection), /最多一张钻卡/);
});

test('manual coach setup keeps confirmed tactics and IGL', () => {
  const { run, selection } = fixture();
  const tactics = { atk: { rush: 1, mid: 0, lurk: 0, fake: 0 }, def: { hold: 1, push: 0, stack: 0 } };
  const team = buildLineup(run, { ...selection, tactics });
  const state = coach.initCoachState(team, 99, { manual: true });
  assert.deepEqual(state.weights, tactics);
  assert.equal(state.iglPick, team.iglName);
});

test('role choices are validated and converted to lineup indices', () => {
  const { run, selection } = fixture();
  const team = buildLineup(run, { ...selection, roleAssignments: { carrier: 'i-3', lurker: 'i-1', decoy: 'i-2', anchor: 'i-4' } });
  assert.deepEqual(team.roleAssignments, { carrier: 3, lurker: 1, decoy: 2, anchor: 4 });
  assert.throws(() => buildLineup(run, { ...selection, roleAssignments: { carrier: 'missing' } }), /职责/);
});

test('confirmed agents are used by the first actual match round', () => {
  const { run, selection } = fixture();
  const teamA = buildLineup(run, selection);
  const rng = mulberry32(18);
  const teamB = resolveTeam({ name: 'B', tiers: ['银', '银', '银', '银', '银'] }, rng);
  const events = [];
  const generator = matchGen({
    teamA, teamB, map: loadMap(path.join(__dirname, '../../引擎/maps/ascent.json')),
    rng, logger: event => events.push(event), playerCoach: 'A'
  });
  generator.next();
  const start = events.find(event => event.type === 'round_start');
  assert.ok(start);
  for (const card of teamA.players) {
    const unit = start.units.find(item => item.name === card.name);
    assert.equal(unit.agent, teamA.agentAssignments[card.cardId]);
  }
});
