const { createRun } = require('./state');
const { drawPack } = require('./packs');
const { stream } = require('../random');
const catalog = require('../catalog');
const { buildLineup } = require('../lineup');
const { replayFixture, fixtureAt, matchId } = require('../match-service');
const { offerGrowth, getGrowth } = require('../growth');
const rules = require('../content/prototype-rules.json');
const { choosePreparation } = require('../preparation');
const { computeDemoLeague } = require('../competition');

function applyCommand(state, command) {
  if (!state || state.schemaVersion !== 1) throw new Error('不支持的存档版本');
  if (!command || typeof command.id !== 'string' || !command.id) throw new Error('命令必须有唯一 ID');
  if (state.processedCommandIds.includes(command.id)) return state;
  if (command.expectedRevision !== state.revision) throw new Error('存档版本已变化，请重新载入');
  const next = structuredClone(state);
  const payload = command.payload || {};
  const run = next.activeRun;
  switch (command.type) {
    case 'begin_run': {
      if (run) throw new Error('已有进行中的征程');
      next.activeRun = createRun({ id: payload.runId || command.id, seed: payload.seed });
      break;
    }
    case 'open_pack': {
      if (!run) throw new Error('尚未开始征程');
      if (run.pendingPack) throw new Error('请先查看已生成的卡包结果');
      const tier = payload.tier || 'starter';
      if (!Number.isInteger(run.unopenedPacks[tier]) || run.unopenedPacks[tier] <= 0) throw new Error('没有可用的对应卡包');
      const picks = drawPack({ region: payload.region, tier, rng: stream(run.seed, 'pack', run.packIndex),
        ownedPlayerIds: run.emergencyPackPending ? run.ownedCards.map(card => card.playerId) : [],
        minimumDistinct: run.emergencyPackPending ? 5 : 0 });
      const instances = picks.map((card, index) => ({
        instanceId: `${run.id}:pack-${run.packIndex}:card-${index}`,
        cardId: card.cardId, playerId: card.playerId
      }));
      run.ownedCards.push(...instances);
      run.unopenedPacks[tier]--;
      run.pendingPack = { packIndex: run.packIndex, tier, region: payload.region, instances };
      run.packIndex++;
      if (run.emergencyPackPending) run.emergencyPackPending = false;
      for (const card of picks) next.career.album[card.cardId] = (next.career.album[card.cardId] || 0) + 1;
      break;
    }
    case 'acknowledge_pack': {
      if (!run || !run.pendingPack) throw new Error('没有待查看的卡包');
      run.pendingPack = null;
      break;
    }
    case 'grant_emergency_pack': {
      if (!run || run.emergencyGranted || run.packIndex === 0) throw new Error('不可领取额外随机补给');
      const distinctPlayers = new Set(run.ownedCards.map(instance => catalog.getCard(instance.cardId).playerId));
      if (distinctPlayers.size >= 5) throw new Error('已经具备五名不同选手');
      run.unopenedPacks.starter = (run.unopenedPacks.starter || 0) + 1;
      run.emergencyGranted = true;
      run.emergencyPackPending = true;
      break;
    }
    case 'set_lineup': {
      if (!run || run.pendingPack || run.match || run.pendingOffer || run.results.length !== run.fixtureIndex) throw new Error('当前不能修改阵容');
      const lineup = buildLineup(run, payload);
      run.registeredLineup = {
        name: lineup.name,
        instanceIds: [...payload.instanceIds],
        iglInstanceId: payload.iglInstanceId,
        agentAssignments: { ...payload.agentAssignments },
        roleAssignments: { ...(payload.roleAssignments || {}) },
        tactics: lineup.tactics
      };
      break;
    }
    case 'choose_preparation': {
      if (!run || run.match || run.pendingPack || run.pendingOffer || run.results.length !== run.fixtureIndex) throw new Error('当前不能备战');
      run.preparation = choosePreparation(run, payload.actionId);
      break;
    }
    case 'start_match': {
      if (!run || !run.registeredLineup || run.pendingPack || run.pendingOffer || run.match) throw new Error('当前不能开始比赛');
      fixtureAt(run.fixtureIndex);
      if (run.results.length !== run.fixtureIndex) throw new Error('请先推进赛程节点');
      const replay = replayFixture(run);
      run.match = {
        id: matchId(run), fixtureId: replay.fixtureId, decisions: [],
        window: replay.window, latestEvents: replay.latestEvents
      };
      break;
    }
    case 'advance_match': {
      if (!run || !run.match) throw new Error('没有进行中的比赛');
      if (run.match.id !== matchId(run)) throw new Error('比赛身份不匹配');
      const decision = payload.decision || null;
      if (decision && (typeof decision !== 'object' || Array.isArray(decision))) throw new Error('无效的教练指令');
      if (decision && run.match.window.matchOver) throw new Error('比赛已结束，不能再下教练指令');
      if (decision?.timeout && !run.match.window.isHalftime && run.match.window.timeoutsLeft.A <= 0) throw new Error('本场暂停次数已用完');
      const decisions = [...run.match.decisions, decision];
      const replay = replayFixture(run, decisions);
      if (replay.result) {
        run.results.push({
          fixtureId: replay.fixtureId, matchId: replay.matchId,
          opponent: replay.opponent, winner: replay.result.winner,
          scoreA: replay.result.scoreA, scoreB: replay.result.scoreB,
          rounds: replay.result.rounds, roundDetails: replay.result.roundDetails,
          agg: replay.result.agg, eventLog: replay.events
        });
        run.match = null;
        const completed = run.results.length;
        if (completed === rules.run.fixtures) run.league = computeDemoLeague(run);
        if (rules.run.smallGrowthAfterFixtures.includes(completed)) {
          run.pendingOffer = offerGrowth(run, replay.fixtureId, completed === rules.run.stageNodeAfterFixture ? 'stage' : 'small');
          run.growthIndex++;
        }
      } else {
        run.match.decisions = decisions;
        run.match.window = replay.window;
        run.match.latestEvents = replay.latestEvents;
      }
      break;
    }
    case 'select_growth': {
      if (!run || !run.pendingOffer) throw new Error('没有待选择成长');
      if (payload.offerId !== run.pendingOffer.id) throw new Error('成长节点不匹配');
      if (!run.pendingOffer.options.includes(payload.optionId)) throw new Error('不在本次候选中');
      getGrowth(payload.optionId);
      run.growth.push({ optionId: payload.optionId, nodeId: run.pendingOffer.nodeId, kind: run.pendingOffer.kind });
      run.claimedRewards.push(run.pendingOffer.id);
      run.pendingOffer = null;
      break;
    }
    case 'skip_growth': {
      if (!run || !run.pendingOffer || run.pendingOffer.options.length) throw new Error('当前不能跳过成长');
      run.claimedRewards.push(run.pendingOffer.id);
      run.pendingOffer = null;
      break;
    }
    case 'claim_stage_supplement': {
      if (!run || run.fixtureIndex !== rules.run.stageNodeAfterFixture - 1 || run.results.length !== rules.run.stageNodeAfterFixture || run.match || run.stageSupplementUsed) throw new Error('当前不能领取阶段补强');
      run.unopenedPacks.starter = (run.unopenedPacks.starter || 0) + 1;
      run.stageSupplementUsed = true;
      break;
    }
    case 'next_fixture': {
      if (!run || run.match || run.pendingOffer || run.pendingPack || run.results.length !== run.fixtureIndex + 1) throw new Error('请先完成本场及奖励');
      if (run.stageSupplementUsed && run.fixtureIndex === rules.run.stageNodeAfterFixture - 1 && run.unopenedPacks.starter > 0) throw new Error('请先打开已领取的阶段补强卡包');
      if (run.fixtureIndex + 1 >= rules.run.fixtures) throw new Error('赛段已结束，请结算征程');
      run.fixtureIndex++;
      run.preparation = null;
      break;
    }
    case 'finish_run': {
      if (!run || run.match || run.pendingOffer || run.results.length !== rules.run.fixtures) throw new Error('征程尚未完成');
      const wins = run.results.filter(result => result.winner === 'A').length;
      const summary = { runId: run.id, seed: run.seed, wins, losses: run.results.length - wins,
        results: run.results.map(result => ({ fixtureId: result.fixtureId, opponent: result.opponent, scoreA: result.scoreA, scoreB: result.scoreB })),
        growthIds: run.growth.map(item => item.optionId),
        leaguePlace: run.league?.standings.find(row => row.id === 'PLAYER')?.place || null };
      next.career.runHistory.push(summary);
      if (wins === rules.run.fixtures) next.career.honors.push({ runId: run.id, id: 'undefeated-slice' });
      next.activeRun = null;
      break;
    }
    default:
      throw new Error(`未知的征程命令: ${command.type}`);
  }
  next.revision++;
  next.processedCommandIds.push(command.id);
  return next;
}

module.exports = { applyCommand };
