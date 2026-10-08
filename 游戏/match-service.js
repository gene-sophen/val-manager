const demo = require('./content/demo-run.json');
const rules = require('./content/rules.json');
const { buildLineup } = require('./lineup');
const { stream } = require('./random');
const catalog = require('./catalog');
const { GameMap } = require('../引擎/gamemap');
const { matchGen } = require('../引擎/match');
const mapData = require('../引擎/maps/ascent.json');
const { activeEffectIds } = require('./growth');

function fixtureAt(index) {
  const fixture = demo.fixtures[index];
  if (!fixture) throw new Error(`赛程不存在: ${index}`);
  return fixture;
}

function matchId(run) { return `${run.id}:${fixtureAt(run.fixtureIndex).id}`; }

function replayFixture(run, decisions = [], options = {}) {
  const fixture = fixtureAt(run.fixtureIndex);
  const lineup = buildLineup(run, run.registeredLineup);
  const teamA = {
    name: lineup.name, players: lineup.players, iglName: lineup.iglName,
    agentAssignments: lineup.agentAssignments, tactics: lineup.tactics,
    roleAssignments: lineup.roleAssignments,
    growthIds: [...new Set([...activeEffectIds(run), run.preparation?.effectId].filter(Boolean))]
  };
  const rng = stream(run.seed, 'match', run.fixtureIndex);
  const opponents = fixture.opponent.players.map(id => catalog.getCard(id));
  const teamB = {
    name: fixture.opponent.name, players: opponents, tactics: fixture.opponent.tactics,
    iglName: (opponents.find(card => card.igl) || opponents[0]).name
  };
  const events = [];
  const generator = matchGen({
    teamA, teamB, map: new GameMap(mapData), rng,
    logger: event => events.push(event), playerCoach: 'A',
    // This four-fixture replay is retained only for the archived prototype tests.
    matchCfg: { ...(options.matchCfg || { firstTo: rules.match.firstTo, halfRounds: rules.match.halfRounds }), coachingPolicy: 'legacy-prototype' }
  });
  let step = generator.next();
  for (const decision of decisions) {
    if (step.done) throw new Error('比赛已经结束，不能再提交指令');
    step = generator.next(decision);
  }
  const round = step.done ? step.value.rounds : step.value.round;
  return {
    matchId: matchId(run), fixtureId: fixture.id, opponent: teamB.name,
    window: step.done ? null : step.value,
    result: step.done ? step.value : null,
    events: step.done ? events : null,
    latestEvents: events.filter(event => event.round === round),
    eventCount: events.length
  };
}

module.exports = { fixtureAt, matchId, replayFixture };
