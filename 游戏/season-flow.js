const { settleEvent } = require('./ledger');
const { drawPack } = require('./packs');
const { stream } = require('./random');

const STAGES = Object.freeze([
  { id: 'kickoff', name: '启点赛' }, { id: 'masters1', name: '大师赛①' },
  { id: 'stage1-regular', name: '第一赛段常规赛', reinforcement: 'enhanced' },
  { id: 'stage1-playoffs', name: '第一赛段季后赛' }, { id: 'masters2', name: '大师赛②' },
  { id: 'stage2-regular', name: '第二赛段常规赛', reinforcement: 'summit' },
  { id: 'stage2-playoffs', name: '第二赛段季后赛' }, { id: 'champions', name: '冠军赛' }
]);
function packInstances(run, tier, packId) {
  const cards = drawPack({ region: 'CN', tier, rng: stream(run.seed, 'pack', run.packIndex),
    config: run.contentSnapshot.packs, poolCards: run.contentSnapshot.cards });
  return { id: packId, tier, region: 'CN', instances: cards.map((c, index) => ({
    instanceId: `${packId}:card:${index}`, cardId: c.cardId, playerId: c.playerId
  })) };
}
function addAlbum(career, instances) {
  for (const i of instances) career.album[i.cardId] = (career.album[i.cardId] || 0) + 1;
}
function enterNextStage(state) {
  const run = state.activeRun;
  if (!run || run.phase !== 'ready' || run.match) throw new Error('当前阶段尚未完成或仍在补强');
  if (!run.stageHistory.some(s => s.stageId === run.stageId && s.completed)) throw new Error('当前赛事阶段尚未完成');
  const nextStage = STAGES[run.stageIndex + 1];
  if (!nextStage) throw new Error('赛年阶段已结束');
  return settleEvent(state, { runId: run.id, scope: 'stage', eventId: `enter:${nextStage.id}`, participants: [], payload: { from: run.stageId, to: nextStage.id } }, draft => {
    const next = draft.activeRun;
    next.stageIndex++;
    next.stageId = nextStage.id;
    if (!nextStage.reinforcement) return;
    const pack = packInstances(next, nextStage.reinforcement, `${next.id}:reinforcement:${nextStage.id}`);
    next.packIndex++;
    next.pendingReinforcement = pack;
    next.reinforcementStages.push(nextStage.id);
    next.phase = 'reinforcement';
    addAlbum(draft.career, pack.instances);
  }).state;
}
module.exports = { STAGES, packInstances, addAlbum, enterNextStage };
