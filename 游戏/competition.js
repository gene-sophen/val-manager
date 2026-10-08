const config = require('./content/competition.json');
const demo = require('./content/demo-run.json');
const catalog = require('./catalog');
const { stream } = require('./random');
const { GameMap } = require('../引擎/gamemap');
const { simulateMatch } = require('../引擎/match');
const mapData = require('../引擎/maps/ascent.json');
const { calculateStandings } = require('./standings');

function rivalTeam(id) {
  const index = Number(id.slice(1)) - 1;
  const fixture = demo.fixtures[index];
  if (!fixture || `O${index + 1}` !== id) throw new Error(`未知测试队伍: ${id}`);
  const players = fixture.opponent.players.map(cardId => catalog.getCard(cardId));
  return { name: fixture.opponent.name, players, tactics: fixture.opponent.tactics,
    iglName: (players.find(card => card.igl) || players[0]).name };
}

function computeDemoLeague(run) {
  if (run.results.length !== 4) throw new Error('四场玩家比赛尚未结束');
  const games = [];
  let rivalIndex = 0;
  for (const [a, b] of config.games) {
    if (a === 'PLAYER' || b === 'PLAYER') {
      const opponentId = a === 'PLAYER' ? b : a;
      const fixtureId = `fixture-${Number(opponentId.slice(1))}`;
      const result = run.results.find(item => item.fixtureId === fixtureId);
      if (!result) throw new Error(`缺少玩家真实赛果: ${fixtureId}`);
      games.push({ a, b, scoreA: a === 'PLAYER' ? result.scoreA : result.scoreB,
        scoreB: b === 'PLAYER' ? result.scoreA : result.scoreB, fixtureId, source: 'player-match' });
    } else {
      const result = simulateMatch({ teamA: rivalTeam(a), teamB: rivalTeam(b),
        map: new GameMap(mapData), rng: stream(run.seed, 'fixture', 100 + rivalIndex++) });
      games.push({ a, b, scoreA: result.scoreA, scoreB: result.scoreB,
        fixtureId: `${a}-${b}`, source: 'same-engine-simulation' });
    }
  }
  return { version: config.version, label: config.name, games,
    standings: calculateStandings(config.teams, games) };
}

module.exports = { rivalTeam, computeDemoLeague };
