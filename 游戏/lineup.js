const catalog = require('./catalog');
const { allAgents, kitOf } = require('../引擎/agents');
const rules = require('./content/rules.json');
const { OFFENSE, DEFENSE } = require('../引擎/tactics');

function normalizeTactics(tactics) {
  if (!tactics) return null;
  const normalized = {};
  for (const [side, families] of [['atk', OFFENSE], ['def', DEFENSE]]) {
    const submitted = tactics[side];
    if (!submitted || Object.keys(submitted).some(key => !families.includes(key))) throw new Error(`无效的${side}战术族`);
    const values = families.map(key => submitted[key] ?? 0);
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum <= 0 || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error(`无效的${side}战术权重`);
    normalized[side] = Object.fromEntries(families.map((key, index) => [key, values[index] / sum]));
  }
  return normalized;
}

function buildLineup(run, selection) {
  if (!run || !selection || !Array.isArray(selection.instanceIds)) throw new Error('缺少阵容选择');
  if (selection.instanceIds.length !== rules.run.lineupSize) throw new Error('必须选择五名选手');
  if (new Set(selection.instanceIds).size !== rules.run.lineupSize) throw new Error('同一张卡不能重复上场');
  const owned = new Map(run.ownedCards.map(item => [item.instanceId, item]));
  const instances = selection.instanceIds.map(id => {
    const item = owned.get(id);
    if (!item) throw new Error(`选手卡不属于本次征程: ${id}`);
    return item;
  });
  const cards = instances.map(item => catalog.getCard(item.cardId));
  if (new Set(cards.map(card => card.playerId)).size !== rules.run.lineupSize) throw new Error('同名选手不能同时上场');
  if (cards.filter(card => card.tier === '钻').length > rules.run.maxDiamondInLineup) throw new Error('每队最多一张钻卡');
  if (!selection.iglInstanceId || !selection.instanceIds.includes(selection.iglInstanceId)) throw new Error('IGL 必须是上场选手');
  const agents = selection.agentAssignments || {};
  const validAgents = new Set(allAgents());
  const agentList = selection.instanceIds.map(id => {
    const agent = agents[id];
    if (!validAgents.has(agent)) throw new Error(`未选择有效特工: ${id}`);
    return agent;
  });
  if (new Set(agentList).size !== agentList.length) throw new Error('同一特工不能重复上场');
  const igl = cards[selection.instanceIds.indexOf(selection.iglInstanceId)];
  const agentAssignments = Object.fromEntries(cards.map((card, index) => [card.cardId, agentList[index]]));
  const roles = {};
  for (const key of ['carrier', 'lurker', 'decoy', 'anchor']) {
    const chosen = selection.roleAssignments?.[key];
    if (chosen == null) continue;
    if (!selection.instanceIds.includes(chosen)) throw new Error(`职责 ${key} 必须由上场选手承担`);
    roles[key] = selection.instanceIds.indexOf(chosen);
  }
  return {
    name: selection.name || '玩家队伍',
    players: cards,
    iglName: igl.name,
    agentAssignments,
    roleAssignments: roles,
    tactics: normalizeTactics(selection.tactics),
    inPool: Object.fromEntries(cards.map((card, index) => [card.cardId, card.agents.includes(agentList[index])])),
    kits: Object.fromEntries(cards.map((card, index) => [card.cardId, kitOf(agentList[index])]))
  };
}

module.exports = { buildLineup };
