// 整局比赛：经济、换边、战术比重、英雄分配、心态、胜负判定；教练系统（赛前布置/暂停/战报）
// matchGen 是生成器：每回合结束后的教练窗口处 yield，供观赛页（spectator）逐回合驱动并介入；
// simulateMatch 是其自动播放器包装（两队均 AI 教练），Node 批量行为与逐回合驱动完全一致
const cfg = require('./config');
const { RoundSim } = require('./round');
const { buildIntent } = require('./tactics');
const { buyPhase, settleRound } = require('./economy');
const createHooks = require('./hooks');
const { assignAgents } = require('./agents');
const coach = require('./coach');
const report = require('./report');
const events = require('./events');
const { applyRolePreferences } = require('./squad');
const { matchOver, attackSide, validateMatchRules } = require('./match-rules');

// 按比重抽战术族
function sampleFamily(weights, rng) {
  let r = rng(), acc = 0;
  for (const [k, w] of Object.entries(weights)) {
    acc += w;
    if (r <= acc) return k;
  }
  return Object.keys(weights)[0];
}

function makeUnits(team, side, teamKey) {
  const s = team.executionState || { form: 50, bond: 40, mastery: 50, map: 50 };
  const bound = n => Math.max(0, Math.min(100, n));
  return team.players.map((p, i) => ({
    player: p, id: `${teamKey}:${i}`, name: p.name, side, sideIdx: i,
    aim: bound(p.AIM + (s.form - 50) * .04),
    syn: bound(p.SYN + (s.bond - 40) * .035 + (s.mastery - 50) * .025),
    sen: bound(p.SEN + (s.map - 50) * .03),
    wallet: { money: cfg.eco.startMoney },
    lossStreak: 0, savedGun: null,
    mentality: 0, agent: null, inPool: true,
    isIGL: team.iglName === p.name,
    ...(team.effectsVersion?{...require('./external-effects').base(p,s,team.coach),executionState:{...s},externalCoach:{...team.coach}}:{})
  }));
}

// 战术调整只允许在赛前、中场或双方共享的暂停窗口；旧原型须显式兼容。
function playerDecision(state, input, ctx) {
  const adjustment = ctx.isHalftime || ctx.isPregame || ctx.sharedTimeout || ctx.allowFreePlan;
  const requestedChange = input?.timeout || input?.weights || input?.iglPick;
  if (ctx.matchOver && requestedChange) throw new Error('比赛已经结束，不能调整');
  if (!requestedChange && !ctx.sharedTimeout) {
    if (ctx.isHalftime) state.halftimeUsed = true;
    return null;
  }
  input ||= {};
  if (input.iglPick && !ctx.allowFreePlan) throw new Error('指挥由上场队员自动承担');
  if (!adjustment && !input.timeout) throw new Error('普通回合不能调整战术，请使用暂停');
  const normalized = {};
  if (input.weights) {
    for (const side of ['atk', 'def']) {
      const submitted = input.weights[side];
      const expected = Object.keys(state.weights[side]);
      if (!submitted || Object.keys(submitted).some(k => !expected.includes(k))) throw new Error(`无效的${side}战术配置`);
      const sum = expected.reduce((total, key) => total + submitted[key], 0);
      if (!Number.isFinite(sum) || sum <= 0 || expected.some(key => !Number.isFinite(submitted[key]) || submitted[key] < 0)) {
        throw new Error(`无效的${side}战术权重`);
      }
      normalized[side] = Object.fromEntries(expected.map(key => [key, submitted[key] / sum]));
    }
  }
  if (input.iglPick && (!ctx.units || !ctx.units.some(u => u.name === input.iglPick))) throw new Error('IGL 必须是上场选手');
  const timeoutKey = ctx.isOvertime ? 'overtimeTimeoutsLeft' : 'timeoutsLeft';
  const ownTimeout = input.timeout && !ctx.isHalftime && !ctx.isPregame && !ctx.sharedTimeout;
  if (ownTimeout && (!Number.isInteger(state[timeoutKey]) || state[timeoutKey] <= 0)) throw new Error('本阶段暂停次数已经用完');
  if (ownTimeout) state[timeoutKey]--;
  if (ctx.isHalftime) state.halftimeUsed = true;
  if ((input.timeout || ctx.sharedTimeout) && ctx.units) {
    const bonus = (ctx.growthIds || []).includes('timeout-reset') ? 0.1 : 0;
    coach.recoverMentality(ctx.units, state.coach?.clutch ?? 50, bonus);
  }
  if (input.weights) state.weights = normalized;
  let iglSwap = null;
  if (input.iglPick && input.iglPick !== state.iglPick) {
    iglSwap = input.iglPick;
    state.iglPick = input.iglPick;
  }
  return { kind: ctx.isHalftime ? 'halftime' : ((input.timeout || ctx.sharedTimeout) ? 'timeout' : 'plan'), manual: true, reads: null, weights: { ...state.weights }, iglSwap };
}

function readContext(key, famSeq, streak, scoreA, scoreB, units, rng, isHalftime, isOvertime) {
  const sequences = famSeq[key === 'A' ? 'B' : 'A'];
  const tendency = {}, streaks = {}, signal = {};
  for (const side of ['atk', 'def']) {
    const seq = sequences[side];
    let run = 0;
    for (let i = seq.length - 1; i >= 0 && seq[i] && seq[i] === seq[seq.length - 1]; i--) run++;
    streaks[side] = run;
    const counts = {};
    for (const family of seq) if (family) counts[family] = (counts[family] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    tendency[side] = top[0];
    signal[side] = seq.length >= 6 && (run >= 3 || top[1] / seq.length >= 0.6);
  }
  return { loseStreak: Math.max(0, -streak[key]), oppSameStreak: Math.max(streaks.atk, streaks.def),
    isHalftime, isOvertime, oppTendency: tendency, oppSignal: signal, rng,
    scoreGap: key === 'A' ? scoreA - scoreB : scoreB - scoreA, units };
}

// matchCfg 可覆盖赛制：{ firstTo, halfRounds }；coachScores 指定两队教练战术分 {A, B}
// playerCoach：'A'/'B' 时该队在教练窗口由调用方（观赛页）决策——yield 窗口信息，恢复值为面板输入
function* matchGen({ teamA, teamB, map, rng, logger, matchCfg, coachScores, playerCoach }) {
  if(map.data?.externalEffectsVersion){teamA=require('./external-effects').bindTeam(teamA);teamB=require('./external-effects').bindTeam(teamB);}
  if (playerCoach && !['A', 'B'].includes(playerCoach)) throw new Error('玩家执教方必须为 A 或 B');
  const mc = { ...cfg.match, ...(matchCfg || {}) };
  if (matchCfg?.firstTo != null && matchCfg?.halfRounds == null) mc.halfRounds = mc.firstTo - 1;
  validateMatchRules(mc);
  const hooks = createHooks();
  events.attachHooks(hooks); // 突发事件（爆种/爆冷）+ 心态修正
  if(map.data.externalEffectsVersion)require('./external-effects').attach(hooks);

  // 教练赛前布置：战术比重 + IGL 任命（覆盖自动识别；teams 配置 coach.igl 可再覆盖）
  const coachSt = {
    A: coach.initCoachState(teamA, coachScores && coachScores.A, { manual: playerCoach === 'A' }),
    B: coach.initCoachState(teamB, coachScores && coachScores.B, { manual: playerCoach === 'B' })
  };
  teamA.iglName = coachSt.A.iglPick;
  teamB.iglName = coachSt.B.iglPick;
  // 战术族使用轨迹（教练读取对手倾向用）
  const famSeq = { A: { atk: [], def: [] }, B: { atk: [], def: [] } };
  const observedSeq = { A: { atk: [], def: [] }, B: { atk: [], def: [] } };

  const unitsA = makeUnits(teamA, 'atk', 'A');
  const unitsB = makeUnits(teamB, 'def', 'B');

  // 英雄分配：各自池内互不重复，分不到则池外低熟练度
  for (const [units, team] of [[unitsA, teamA], [unitsB, teamB]]) {
    const assign = team.agentAssignments
      ? team.players.map(p => {
          const agent = team.agentAssignments[p.cardId];
          if (!agent) throw new Error(`缺少已确认的特工: ${p.name}`);
          return { agent, inPool: p.agents.includes(agent), kit: require('./agents').kitOf(agent) };
        })
      : assignAgents(team.players, rng);
    units.forEach((u, i) => { u.agent = assign[i].agent; u.inPool = assign[i].inPool; u.kit = assign[i].kit; });
  }

  let scoreA = 0, scoreB = 0;
  let roundIdx = 0;
  let totalTicks = 0;
  const roundDetails = [];
  const agg = { popOffs: 0, whiffs: 0, utilsAtk: 0, utilsDef: 0, fakeReads: 0, fakePulled: 0, utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 }, abilityByArchetype: {} };
  // 心态用的连赢/连输计数
  const streak = { A: 0, B: 0 };
  // 手枪局结果（两个半场各一次），用于次回合强起规则
  const pistolWinner = {};
  const moneyOf = (units) => units.reduce((s, u) => s + u.wallet.money, 0);

  const maxNormal = mc.halfRounds * 2;
  while (true) {
    const isOT = roundIdx >= maxNormal;
    const secondHalf = roundIdx >= mc.halfRounds;
    const atkTeam = attackSide(roundIdx, mc);
    const atkUnits = atkTeam === 'A' ? unitsA : unitsB;
    const defUnits = atkTeam === 'A' ? unitsB : unitsA;
    for (const u of atkUnits) u.side = 'atk';
    for (const u of defUnits) u.side = 'def';

    const atkTeamObj = atkTeam === 'A' ? teamA : teamB;
    const defTeamObj = atkTeam === 'A' ? teamB : teamA;
    const defTeamKey = atkTeam === 'A' ? 'B' : 'A';

    // 战术比重：来自教练当前布置；换边时若队伍配置了 tactics2 则先整套换用
    for (const [key, teamObj] of [['A', teamA], ['B', teamB]]) {
      if (secondHalf && !coachSt[key].swapped && teamObj.tactics2) {
        coachSt[key].weights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].baseWeights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].swapped = true;
      }
    }
    const atkFamily = sampleFamily(coachSt[atkTeam].weights.atk, rng);
    const defFamily = sampleFamily(coachSt[defTeamKey].weights.def, rng);
    for(const [units,teamObj,side,family,other]of [[atkUnits,atkTeamObj,'attack',atkFamily,defFamily],[defUnits,defTeamObj,'defense',defFamily,atkFamily]])if(teamObj.tacticalProfile){
      const style=require('../游戏/team-style');
      for(const u of units){u.tacticalExecution=style.execution(teamObj.tacticalProfile,side,family,other);Object.assign(u,require('./external-effects').base(u.player,u.executionState||teamObj.executionState,u.externalCoach||teamObj.coach,u.tacticalExecution));}
    }
    famSeq[atkTeam].atk.push(atkFamily);
    famSeq[defTeamKey].def.push(defFamily);

    // 购买：手枪局 / 强起（手枪局获胜次回合）/ 孤注一掷（对方逼近赛点且经济不良）
    const isPistol = roundIdx === 0 || roundIdx === mc.halfRounds;
    if (isPistol || isOT) for (const u of [...unitsA, ...unitsB]) {
      u.wallet.money = isOT ? mc.overtimeMoney : cfg.eco.startMoney;
      u.savedGun = null; u.lossStreak = 0;
    }
    const startingCredits = { A: unitsA.map(u => u.wallet.money), B: unitsB.map(u => u.wallet.money) };
    const buyCtxFor = (teamKey, units) => {
      const myScore = teamKey === 'A' ? scoreA : scoreB;
      const oppScore = teamKey === 'A' ? scoreB : scoreA;
      const halfKey = secondHalf ? 'second' : 'first';
      return {
        isPistol,
        wonPistolFollow: (roundIdx === 1 || roundIdx === mc.halfRounds + 1) && pistolWinner[halfKey] === teamKey,
        desperate: oppScore >= mc.firstTo - 2
      };
    };
    const buyA = buyPhase(atkUnits, buyCtxFor(atkTeam, atkUnits));
    const buyB = buyPhase(defUnits, buyCtxFor(atkTeam === 'A' ? 'B' : 'A', defUnits));
    atkUnits.forEach((u, i) => { u.gun = buyA.loadout[i].gun; u.armor = buyA.loadout[i].armor; u.utils = buyA.loadout[i].utils; });
    defUnits.forEach((u, i) => { u.gun = buyB.loadout[i].gun; u.armor = buyB.loadout[i].armor; u.utils = buyB.loadout[i].utils; });

    // 回合日志
    let roundLogger = null;
    if (logger) {
      logger({ t: -1, type: 'round_meta', round: roundIdx + 1, atkTeam: atkTeamObj.name, defTeam: defTeamObj.name, atkFamily, defFamily, atkPlan: buyA.plan, atkReason: buyA.reason, defPlan: buyB.plan, defReason: buyB.reason, scoreA, scoreB, atkMoney: moneyOf(atkUnits), defMoney: moneyOf(defUnits) });
      roundLogger = (ev) => { ev.round = roundIdx + 1; logger(ev); };
    }

    // 战术族 -> 战术意图（个体执行由 brain.js 效用 AI 决定）
    const atkIntent = applyRolePreferences(buildIntent(map, 'atk', atkFamily, rng), atkTeamObj.roleAssignments);
    const defIntent = applyRolePreferences(buildIntent(map, 'def', defFamily, rng), defTeamObj.roleAssignments);
    const atkGrowth = atkTeamObj.growthIds || [];
    const defGrowth = defTeamObj.growthIds || [];
    const power=team=>team.players.reduce((sum,p)=>sum+Object.values(require('./external-effects').base(p,team.executionState,team.coach)).reduce((a,b)=>a+b,0),0);
    if (atkFamily === 'mid' && atkGrowth.includes('mid-shift')) atkIntent.pace.commitTick = Math.max(atkIntent.pace.contactTick, atkIntent.pace.commitTick - 3);
    const sim = new RoundSim({
      map, atkUnits, defUnits, atkFamily, defFamily, atkIntent, defIntent,
      ...(map.data.externalEffectsVersion?{externalContext:Object.fromEntries([['A',teamA,teamB],['B',teamB,teamA]].map(([key,own,other])=>[key,{number:roundIdx+1,gap:key==='A'?scoreA-scoreB:scoreB-scoreA,lossStreak:Math.max(0,-streak[key]),matchPoint:scoreA===mc.firstTo-1||scoreB===mc.firstTo-1||isOT,ownPower:power(own),enemyPower:power(other)}]))}:{ }),
      rng, hooks, logger: roundLogger, growthEffects: { atk: atkGrowth, def: defGrowth },
      // 极简战报：回合结束时渲染一句话摘要（挂到 round_end.summary）
      onRoundEnd: logger ? (res, evs) => {
        const wTeam = res.winner === 'atk' ? atkTeam : defTeamKey;
        return report.roundSummary(evs, {
          round: roundIdx + 1, atkTeam: atkTeamObj.name, defTeam: defTeamObj.name, atkFamily,
          scoreA: scoreA + (wTeam === 'A' ? 1 : 0), scoreB: scoreB + (wTeam === 'B' ? 1 : 0),
          nameA: teamA.name, nameB: teamB.name, reason: res.reason
        });
      } : null
    });
    const result = sim.run();
    if (mc.observationPolicy === 'public-events') {
      // Store each opponent estimate in the same shape readContext expects.
      const estimate = require('./coach-observation').estimate;
      observedSeq[atkTeam].atk.push(estimate(sim._roundEvents || [], 'def', map));
      observedSeq[defTeamKey].def.push(estimate(sim._roundEvents || [], 'atk', map));
    }
    settleRound(atkUnits, defUnits, result);
    agg.popOffs += result.stats.popOffs;
    agg.whiffs += result.stats.whiffs;
    agg.utilsAtk += result.stats.utilsAtk;
    agg.utilsDef += result.stats.utilsDef;
    agg.fakeReads += result.stats.fakeReads;
    agg.fakePulled += result.stats.fakePulled;
    for (const k of Object.keys(agg.utilsByType)) agg.utilsByType[k] += result.stats.utilsByType[k];
    for (const [k, v] of Object.entries(result.stats.abilityByArchetype || {})) {
      agg.abilityByArchetype[k] = (agg.abilityByArchetype[k] || 0) + v;
    }

    const winnerTeam = (result.winner === 'atk') ? atkTeam : defTeamKey;
    if (winnerTeam === 'A') { scoreA++; streak.A = Math.max(streak.A, 0) + 1; streak.B = Math.min(streak.B, 0) - 1; }
    else { scoreB++; streak.B = Math.max(streak.B, 0) + 1; streak.A = Math.min(streak.A, 0) - 1; }
    if (isPistol) pistolWinner[secondHalf ? 'second' : 'first'] = winnerTeam;

    // 心态更新（比分与连续得失分驱动）
    events.updateMentality(unitsA, winnerTeam === 'A', scoreA, scoreB, Math.abs(streak.A));
    events.updateMentality(unitsB, winnerTeam === 'B', scoreB, scoreA, Math.abs(streak.B));

    totalTicks += result.ticks;
    roundDetails.push({
      round: roundIdx + 1, atkTeam, winner: winnerTeam, reason: result.reason,
      isOvertime: isOT, overtimeIndex: isOT ? roundIdx - maxNormal : null, startingCredits,
      ticks: result.ticks, planted: result.planted,
      atkFamily, defFamily, atkPlan: buyA.plan, defPlan: buyB.plan,
      atkReason: buyA.reason, defReason: buyB.reason
    });
    if (logger) logger({ t: result.ticks, type: 'score', round: roundIdx + 1, scoreA, scoreB, winner: winnerTeam, reason: result.reason });

    // ---- 教练窗口（仅回合之间）：暂停状态播报 + 决策（玩家侧 yield 给观赛页） ----
    const nextIdx = roundIdx + 1;
    const isHalftime = nextIdx === mc.halfRounds; // 第 12 回合后进入中场窗口
    const finished = matchOver(scoreA, scoreB, mc);
    const nextIsOvertime = nextIdx >= maxNormal;
    if (nextIdx === maxNormal && !finished) for (const key of ['A', 'B']) coachSt[key].overtimeTimeoutsLeft = 1;
    const remaining = () => Object.fromEntries(['A', 'B'].map(key => [key, nextIsOvertime ? coachSt[key].overtimeTimeoutsLeft : coachSt[key].timeoutsLeft]));
    const contexts = Object.fromEntries(['A', 'B'].map(key => [key, readContext(key, mc.observationPolicy === 'public-events' ? observedSeq : famSeq, streak, scoreA, scoreB, key === 'A' ? unitsA : unitsB, rng, isHalftime, nextIsOvertime)]));
    // An AI request is already visible when the human sees the boundary. Two AI
    // requests merge into one pause, A breaks a simultaneous tie deterministically.
    let timeoutCaller = !finished && !isHalftime ? ['A', 'B'].find(key => playerCoach !== key && coach.wantsTimeout(coachSt[key], contexts[key])) || null : null;
    const windowKind = () => finished ? 'ended' : isHalftime ? 'halftime' : timeoutCaller ? (nextIsOvertime ? 'overtime-timeout' : 'timeout') : 'round';
    if (logger) logger({ t: result.ticks, type: 'coach_window', round: roundIdx + 1, scoreA, scoreB, kind: windowKind(), timeoutCaller, matchOver: finished, isOvertime: nextIsOvertime, timeoutsLeft: remaining() });
    let playerInput = null;
    if (playerCoach) {
      // 真人教练窗口：yield 窗口快照，恢复值 = 面板输入 { timeout, weights?, iglPick? }
      playerInput = yield {
        type: 'coach_window', round: roundIdx + 1, scoreA, scoreB, isHalftime, result,
        timeoutsLeft: remaining(), isOvertime: nextIsOvertime,
        regulationTimeoutsLeft: { A: coachSt.A.timeoutsLeft, B: coachSt.B.timeoutsLeft },
        overtimeTimeoutsLeft: { A: coachSt.A.overtimeTimeoutsLeft, B: coachSt.B.overtimeTimeoutsLeft },
        kind: windowKind(), timeoutCaller, canAdjust: !finished && (isHalftime || !!timeoutCaller),
        canRequestTimeout: !finished && !isHalftime && !timeoutCaller && remaining()[playerCoach] > 0,
        weights: { A: JSON.parse(JSON.stringify(coachSt.A.weights)), B: JSON.parse(JSON.stringify(coachSt.B.weights)) },
        iglPick: { A: coachSt.A.iglPick, B: coachSt.B.iglPick },
        economy: { A: moneyOf(unitsA), B: moneyOf(unitsB) },
        matchOver: finished
      };
    }
    if (finished) {
      if (playerInput?.timeout || playerInput?.weights || playerInput?.iglPick) throw new Error('比赛已经结束，不能调整');
      roundIdx++; break;
    }
    if (playerInput?.teamState) {
      const st = playerInput.teamState;
      if (['bond', 'form', 'mastery', 'map'].some(k => !Number.isFinite(st[k]) || st[k] < 0 || st[k] > 100)) throw new Error('无效队伍状态');
      for (const u of playerCoach === 'A' ? unitsA : unitsB) {
        if(map.data.externalEffectsVersion){u.executionState={...st};(playerCoach==='A'?teamA:teamB).executionState={...st};Object.assign(u,require('./external-effects').base(u.player,st,u.externalCoach));continue;}
        // Card values remain immutable. Only match-local execution changes.
        const form = (st.form - 50) * .04;
        u.aim = Math.max(0, Math.min(100, u.player.AIM + form));
        u.syn = Math.max(0, Math.min(100, u.player.SYN + (st.bond - 40) * .035 + (st.mastery - 50) * .025));
        u.sen = Math.max(0, Math.min(100, u.player.SEN + (st.map - 50) * .03));
      }
    }
    if (timeoutCaller) coachSt[timeoutCaller][nextIsOvertime ? 'overtimeTimeoutsLeft' : 'timeoutsLeft']--;
    const playerCalling = !timeoutCaller && !isHalftime && playerInput?.timeout;
    if (playerCalling && coachSt[playerCoach][nextIsOvertime ? 'overtimeTimeoutsLeft' : 'timeoutsLeft'] <= 0) throw new Error('本阶段暂停次数已经用完');
    if (playerCalling) timeoutCaller = playerCoach;
    for (const key of ['A', 'B']) {
      // 中场窗口先落 tactics2 换套，再做暂停调整（调整作用于下半场实际使用的比重）
      const teamObj = key === 'A' ? teamA : teamB;
      if (isHalftime && !coachSt[key].swapped && teamObj.tactics2) {
        coachSt[key].weights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].baseWeights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].swapped = true;
      }
      const myUnits = key === 'A' ? unitsA : unitsB;
      let dec = null;
      if (playerCoach === key) {
        dec = playerDecision(coachSt[key], playerInput, { isHalftime, isOvertime: nextIsOvertime, sharedTimeout: !!timeoutCaller && !playerCalling,
          allowFreePlan: mc.coachingPolicy === 'legacy-prototype', units: myUnits, growthIds: teamObj.growthIds || [] });
      } else {
        if (isHalftime) { coachSt[key].halftimeUsed = true; dec = coach.adjust(coachSt[key], contexts[key], 'halftime'); }
        else if (timeoutCaller) dec = coach.adjust(coachSt[key], contexts[key], 'timeout');
      }
      if (!dec) continue;
      if (dec.iglSwap) { // 换 IGL 热更新
        for (const u of myUnits) u.isIGL = u.name === dec.iglSwap;
      }
      if (logger) logger({
        t: result.ticks, type: dec.kind === 'plan' ? 'coach_plan' : 'timeout', round: roundIdx + 1, side: key, kind: dec.kind,
        coach: coachSt[key].coach.name + (dec.manual ? '(你)' : ''), tactics: coachSt[key].coach.tactics,
        reads: dec.reads, weights: dec.weights, manual: !!dec.manual,
        timeoutCaller, timeoutInitiated: dec.kind === 'timeout' && timeoutCaller === key,
        iglPick: dec.iglSwap || undefined
      });
      if (logger && dec.kind === 'timeout' && playerCoach === key && (teamObj.growthIds || []).includes('timeout-reset')) {
        logger({ t: result.ticks, type: 'growth_trigger', round: roundIdx + 1, side: key, growthId: 'timeout-reset' });
      }
    }

    roundIdx++;
  }

  return {
    winner: scoreA > scoreB ? 'A' : 'B',
    scoreA, scoreB,
    rounds: roundIdx,
    totalTicks,
    roundDetails,
    agg,
    rules: { ...mc }, initialAttacker: mc.initialAttacker,
    timeoutState: Object.fromEntries(['A', 'B'].map(key => [key, { regulation: coachSt[key].timeoutsLeft, overtime: coachSt[key].overtimeTimeoutsLeft }]))
  };
}

// 自动播放包装：两队均 AI 教练（Node 批量模式，行为与逐回合驱动一致）
function simulateMatch(opts) {
  const g = matchGen(opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

module.exports = { simulateMatch, matchGen, sampleFamily, playerDecision };
