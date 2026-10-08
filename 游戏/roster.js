function resolveRunCard(run, cardId) {
  const card = run.contentSnapshot.cards.find(c => c.cardId === cardId);
  if (!card) throw new Error(`冻结卡库缺少选手卡: ${cardId}`);
  return card;
}
function registerFive(run, selection, candidates) {
  const ids = selection?.instanceIds;
  if (!Array.isArray(ids) || ids.length !== 5) throw new Error('必须选择五名选手');
  if (new Set(ids).size !== 5) throw new Error('同一张卡不能重复上场');
  const allowed = new Map(candidates.map(item => [item.instanceId, item]));
  const instances = ids.map(id => {
    const instance = allowed.get(id);
    if (!instance) throw new Error('选手卡不属于当前候选范围');
    return instance;
  });
  const cards = instances.map(i => resolveRunCard(run, i.cardId));
  if (new Set(cards.map(c => c.playerId)).size !== 5) throw new Error('同名选手不能同时上场');
  if (cards.some(c => c.region !== 'CN')) throw new Error('征战阵容只使用 CN 卡库');
  if (cards.filter(c => c.tier === '钻').length > 1) throw new Error('每队最多一张钻卡');
  const igl = cards.findIndex(c => c.igl);
  return {
    name: typeof selection.name === 'string' ? selection.name.trim().slice(0, 30) || '我的战队' : run.registeredLineup?.name || '我的战队',
    instanceIds: [...ids], iglInstanceId: instances[igl < 0 ? cards.reduce((best, c, i) => c.SEN > cards[best].SEN ? i : best, 0) : igl].instanceId,
    agentAssignments: {}, roleAssignments: {}, tactics: null
  };
}
module.exports = { resolveRunCard, registerFive };
