const { resolveRunCard } = require('./roster');

const clamp = value => Math.max(0, Math.min(100, value));
const pairKey = (a, b) => JSON.stringify([a, b].sort());
const initialMastery = coach => clamp(40 + 0.2 * coach.战术);
function visibleFamiliarity(total = 0) {
  if (!Number.isFinite(total) || total < 0) throw new Error('熟识累计必须为非负有限数值');
  return 100 * total / (total + 40);
}
function lineupCards(run, lineup, instances = run.ownedCards) {
  const byId = new Map(instances.map(i => [i.instanceId, i]));
  return lineup.instanceIds.map(id => {
    const instance = byId.get(id);
    if (!instance) throw new Error('阵容缺少卡牌实例');
    return resolveRunCard(run, instance.cardId);
  });
}
function bondValue(cards, career, relationships) {
  const familiarity = cards.reduce((sum, c) => sum + visibleFamiliarity(career.familiarity[c.playerId] ?? 0), 0) / 5;
  let sameTeam = 0, rapport = 0;
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    if (cards[i].team && cards[i].team === cards[j].team) sameTeam++;
    rapport += clamp(relationships[pairKey(cards[i].playerId, cards[j].playerId)] ?? 0);
  }
  return clamp(20 + 0.15 * familiarity + 20 * sameTeam / 10 + 0.45 * rapport / 10);
}
// Only registration/replacement is implemented here; match events will supply growth later.
function applyRosterBase(run, career, lineup, candidates) {
  const cards = lineupCards(run, lineup, candidates);
  const previous = run.registeredLineup ? lineupCards(run, run.registeredLineup) : [];
  const ids = new Set(cards.map(c => c.playerId));
  const retained = previous.filter(c => ids.has(c.playerId)).length;
  run.relationships ??= {};
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    run.relationships[pairKey(cards[i].playerId, cards[j].playerId)] ??= 0;
  }
  const base = initialMastery(run.coach);
  run.team = {
    羁绊: bondValue(cards, career, run.relationships), 状态: run.team.状态,
    熟练: previous.length ? clamp(base + retained / 5 * (run.team.熟练 - base)) : base
  };
  run.progressionStatus = 'initial-and-replacement-values-only';
}
module.exports = { pairKey, initialMastery, visibleFamiliarity, bondValue, applyRosterBase };
