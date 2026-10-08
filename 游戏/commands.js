const { assertState, createRun } = require('./state');
const { settleEvent } = require('./ledger');
const { registerFive } = require('./roster');
const { packInstances, addAlbum, enterNextStage } = require('./season-flow');
const { applyRosterBase } = require('./team-base');

function phase(run, expected) {
  if (!run || run.phase !== expected) throw new Error('当前阶段不能执行此操作，已确认内容已锁定');
}
function applyCommand(state, command) {
  assertState(state);
  if (state.simulation?.mode === 'preview') throw new Error('预演副本不能执行玩家提交命令');
  if (!command || typeof command.id !== 'string' || !command.id) throw new Error('命令必须有唯一 ID');
  if (state.processedCommandIds.includes(command.id)) return state;
  if (command.expectedRevision !== state.revision) throw new Error('存档版本已变化，请重新载入');
  let next = structuredClone(state);
  const payload = command.payload || {};
  const run = next.activeRun;
  const settle = (scope, eventId, facts, effect) => {
    next = settleEvent(next, { runId: run.id, scope, eventId, participants: [], payload: facts }, effect).state;
  };
  switch (command.type) {
    case 'begin_run': {
      if (run) throw new Error('已有进行中的征战');
      const id = payload.runId || command.id;
      if (next.career.runHistory.some(r => r.runId === id) || next.legacyArchives.some(a => a.snapshot.activeRun?.id === id)
        || Object.values(next.ledger).some(e => e.runId === id)) throw new Error('征战身份已使用');
      next.activeRun = createRun({ id, seed: payload.seed, career: next.career });
      break;
    }
    case 'select_home_team': {
      phase(run, 'choose-home-team');
      if (!run.contentSnapshot.rosters.teams.some(t => t.teamId === payload.teamId && t.selectable)) throw new Error('请选择十二个 CN 主队席位之一');
      run.homeTeamId = payload.teamId;
      run.phase = 'open-starter';
      break;
    }
    case 'open_initial_packs': {
      phase(run, 'open-starter');
      settle('pack', 'starter-three', { region: 'CN', count: 3 }, draft => {
        const active = draft.activeRun;
        for (let i = 0; i < 3; i++) {
          const pack = packInstances(active, 'starter', `${active.id}:starter:${i}`);
          active.packIndex++;
          active.starterPacks.push(pack);
          addAlbum(draft.career, pack.instances);
        }
        active.phase = 'choose-pack';
      });
      break;
    }
    case 'select_initial_pack': {
      phase(run, 'choose-pack');
      const pack = run.starterPacks.find(p => p.id === payload.packId);
      if (!pack) throw new Error('卡包不属于本次开局');
      run.selectedPackId = pack.id;
      run.ownedCards = structuredClone(pack.instances);
      run.phase = 'choose-lineup';
      break;
    }
    case 'confirm_lineup': {
      phase(run, 'choose-lineup');
      const lineup = registerFive(run, payload, run.ownedCards);
      settle('roster', 'initial-five', { instanceIds: lineup.instanceIds }, draft => {
        const active = draft.activeRun;
        applyRosterBase(active, draft.career, lineup, active.ownedCards);
        active.registeredLineup = lineup;
        active.ownedCards = active.ownedCards.filter(i => lineup.instanceIds.includes(i.instanceId));
        active.rosterHistory.push({ stageId: active.stageId, instanceIds: [...lineup.instanceIds], reason: 'initial' });
        active.phase = 'ready';
      });
      break;
    }
    case 'confirm_reinforcement': {
      phase(run, 'reinforcement');
      const pack = run.pendingReinforcement;
      if (!pack) throw new Error('没有待确认补强');
      const candidates = [...run.ownedCards, ...pack.instances];
      const lineup = registerFive(run, payload, candidates);
      settle('roster', `reinforcement:${run.stageId}`, { instanceIds: lineup.instanceIds }, draft => {
        const active = draft.activeRun;
        applyRosterBase(active, draft.career, lineup, candidates);
        for (const i of active.ownedCards) if (!lineup.instanceIds.includes(i.instanceId)) active.departures.push({ ...i, stageId: active.stageId });
        active.ownedCards = candidates.filter(i => lineup.instanceIds.includes(i.instanceId));
        active.registeredLineup = lineup;
        active.rosterHistory.push({ stageId: active.stageId, instanceIds: [...lineup.instanceIds], reason: 'reinforcement' });
        active.pendingReinforcement = null;
        active.phase = 'ready';
      });
      break;
    }
    case 'advance_stage': next = enterNextStage(next); break;
    case 'abandon_run': {
      if (!run || run.match) throw new Error('当前不能退出征战');
      next.career.runHistory.push({ runId: run.id, seed: run.seed, homeTeamId: run.homeTeamId,
        contentVersion: run.contentVersion, status: 'abandoned', stageId: run.stageId, results: structuredClone(run.results) });
      next.activeRun = null;
      break;
    }
    default: throw new Error(`新版尚不支持的命令: ${command.type}`);
  }
  next.revision++;
  next.processedCommandIds.push(command.id);
  return next;
}
module.exports = { applyCommand };
