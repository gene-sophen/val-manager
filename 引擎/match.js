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

// 按比重抽战术族
function sampleFamily(weights, rng) {
  let r = rng(), acc = 0;
  for (const [k, w] of Object.entries(weights)) {
    acc += w;
    if (r <= acc) return k;
  }
  return Object.keys(weights)[0];
}

function makeUnits(team, side) {
  return team.players.map((p, i) => ({
    player: p, name: p.name, side, sideIdx: i,
    aim: p.AIM, syn: p.SYN, sen: p.SEN,
    wallet: { money: cfg.eco.startMoney },
    lossStreak: 0, savedGun: null,
    mentality: 0, agent: null, inPool: true,
    isIGL: team.iglName === p.name
  }));
}

// 玩家教练决策落地：面板给的战术比重/IGL 直接热更新（暂停照扣次数、心态照稳）
function playerDecision(state, input, ctx) {
  if (ctx.isHalftime && !state.halftimeUsed) state.halftimeUsed = true; // 中场窗口经过即消耗
  if (!input || !input.timeout) return null;
  if (!ctx.isHalftime) {
    if (state.timeoutsLeft <= 0) return null;
    state.timeoutsLeft--;
  }
  if (ctx.units) { // 暂停稳心态（与 AI 暂停一致）
    for (const u of ctx.units) u.mentality = Math.max(-1, Math.min(1, (u.mentality || 0) + cfg.coach.timeoutComposure));
  }
  if (input.weights) state.weights = { atk: { ...input.weights.atk }, def: { ...input.weights.def } };
  let iglSwap = null;
  if (input.iglPick && input.iglPick !== state.iglPick) {
    iglSwap = input.iglPick;
    state.iglPick = input.iglPick;
  }
  return { kind: ctx.isHalftime ? 'halftime' : 'timeout', manual: true, reads: null, weights: { ...state.weights }, iglSwap };
}

// matchCfg 可覆盖赛制：{ firstTo, halfRounds }；coachScores 指定两队教练战术分 {A, B}
// playerCoach：'A'/'B' 时该队在教练窗口由调用方（观赛页）决策——yield 窗口信息，恢复值为面板输入
function* matchGen({ teamA, teamB, map, rng, logger, matchCfg, coachScores, playerCoach }) {
  const mc = { ...cfg.match, ...(matchCfg || {}) };
  const hooks = createHooks();
  events.attachHooks(hooks); // 突发事件（爆种/爆冷）+ 心态修正

  // 教练赛前布置：战术比重 + IGL 任命（覆盖自动识别；teams 配置 coach.igl 可再覆盖）
  const coachSt = {
    A: coach.initCoachState(teamA, coachScores && coachScores.A),
    B: coach.initCoachState(teamB, coachScores && coachScores.B)
  };
  teamA.iglName = coachSt.A.iglPick;
  teamB.iglName = coachSt.B.iglPick;
  // 战术族使用轨迹（教练读取对手倾向用）
  const famSeq = { A: { atk: [], def: [] }, B: { atk: [], def: [] } };

  const unitsA = makeUnits(teamA, 'atk');
  const unitsB = makeUnits(teamB, 'def');

  // 英雄分配：各自池内互不重复，分不到则池外低熟练度
  for (const [units, team] of [[unitsA, teamA], [unitsB, teamB]]) {
    const assign = assignAgents(team.players, rng);
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
    const isOT = roundIdx >= maxNormal; // 平局一加时局
    const secondHalf = roundIdx >= mc.halfRounds;
    const atkTeam = isOT
      ? (rng() < 0.5 ? 'A' : 'B')                 // 加时掷硬币定攻方
      : (secondHalf ? 'B' : 'A');
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
    famSeq[atkTeam].atk.push(atkFamily);
    famSeq[defTeamKey].def.push(defFamily);

    // 购买：手枪局 / 强起（手枪局获胜次回合）/ 孤注一掷（对方逼近赛点且经济不良）
    const isPistol = roundIdx === 0 || roundIdx === mc.halfRounds;
    if (isOT) {
      for (const u of [...unitsA, ...unitsB]) { u.wallet.money = mc.overtimeMoney; u.savedGun = null; }
    }
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
    const atkIntent = buildIntent(map, 'atk', atkFamily, rng);
    const defIntent = buildIntent(map, 'def', defFamily, rng);
    const sim = new RoundSim({
      map, atkUnits, defUnits, atkFamily, defFamily, atkIntent, defIntent,
      rng, hooks, logger: roundLogger,
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
      ticks: result.ticks, planted: result.planted,
      atkFamily, defFamily, atkPlan: buyA.plan, defPlan: buyB.plan,
      atkReason: buyA.reason, defReason: buyB.reason
    });
    if (logger) logger({ t: result.ticks, type: 'score', round: roundIdx + 1, scoreA, scoreB, winner: winnerTeam, reason: result.reason });

    // ---- 教练窗口（仅回合之间）：暂停状态播报 + 决策（玩家侧 yield 给观赛页） ----
    if (logger) logger({ t: result.ticks, type: 'coach_window', round: roundIdx + 1, scoreA, scoreB, timeoutsLeft: { A: coachSt.A.timeoutsLeft, B: coachSt.B.timeoutsLeft } });
    const nextIdx = roundIdx + 1;
    const isHalftime = nextIdx === mc.halfRounds; // 第 12 回合后进入中场窗口
    let playerInput = null;
    if (playerCoach) {
      // 真人教练窗口：yield 窗口快照，恢复值 = 面板输入 { timeout, weights?, iglPick? }
      playerInput = yield {
        type: 'coach_window', round: roundIdx + 1, scoreA, scoreB, isHalftime, result,
        timeoutsLeft: { A: coachSt.A.timeoutsLeft, B: coachSt.B.timeoutsLeft },
        weights: { A: JSON.parse(JSON.stringify(coachSt.A.weights)), B: JSON.parse(JSON.stringify(coachSt.B.weights)) },
        iglPick: { A: coachSt.A.iglPick, B: coachSt.B.iglPick },
        economy: { A: moneyOf(unitsA), B: moneyOf(unitsB) },
        matchOver: scoreA + 1 > mc.firstTo || scoreB + 1 > mc.firstTo || nextIdx > maxNormal
      };
    }
    for (const key of ['A', 'B']) {
      // 中场窗口先落 tactics2 换套，再做暂停调整（调整作用于下半场实际使用的比重）
      const teamObj = key === 'A' ? teamA : teamB;
      if (isHalftime && !coachSt[key].swapped && teamObj.tactics2) {
        coachSt[key].weights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].baseWeights = { atk: { ...teamObj.tactics2.atk }, def: { ...teamObj.tactics2.def } };
        coachSt[key].swapped = true;
      }
      const oppKey = key === 'A' ? 'B' : 'A';
      const myScore = key === 'A' ? scoreA : scoreB, oppScore = key === 'A' ? scoreB : scoreA;
      const myUnits = key === 'A' ? unitsA : unitsB;
      let dec = null;
      if (playerCoach === key) {
        dec = playerDecision(coachSt[key], playerInput, { isHalftime, units: myUnits });
      } else {
        // 对手两侧的连出场次与倾向（我方进攻针对其防守倾向，反之亦然）
        const seqs = famSeq[oppKey];
        const tend = {}, streaks = {}, signal = {};
        for (const side of ['atk', 'def']) {
          const seq = seqs[side];
          let run = 0;
          for (let i = seq.length - 1; i >= 0 && seq[i] === seq[seq.length - 1]; i--) run++;
          streaks[side] = run;
          const counts = {};
          for (const f of seq) counts[f] = (counts[f] || 0) + 1;
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
          tend[side] = top[0];
          // 明确信号：样本 ≥6 且（同族连出 ≥3 或多数族占比 ≥60%）；不足则暂停只回摆/稳心态不针对
          // （均匀对手的短期噪声不是信号，针对幻影倾向调整只会自伤）
          signal[side] = seq.length >= 6 && (run >= 3 || top[1] / seq.length >= 0.6);
        }
        dec = coach.aiDecide(coachSt[key], {
          loseStreak: Math.max(0, -streak[key]), oppSameStreak: Math.max(streaks.atk, streaks.def), isHalftime,
          oppTendency: tend, oppSignal: signal, rng, scoreGap: myScore - oppScore, units: myUnits
        });
      }
      if (!dec) continue;
      if (dec.iglSwap) { // 换 IGL 热更新
        for (const u of myUnits) u.isIGL = u.name === dec.iglSwap;
      }
      if (logger) logger({
        t: result.ticks, type: 'timeout', round: roundIdx + 1, side: key, kind: dec.kind,
        coach: coachSt[key].coach.name + (dec.manual ? '(你)' : ''), tactics: coachSt[key].coach.tactics,
        reads: dec.reads, weights: dec.weights, manual: !!dec.manual,
        iglPick: dec.iglSwap || undefined
      });
    }

    roundIdx++;
    if (scoreA >= mc.firstTo || scoreB >= mc.firstTo) break;
    if (isOT) break; // 加时一局定胜负
  }

  return {
    winner: scoreA > scoreB ? 'A' : 'B',
    scoreA, scoreB,
    rounds: roundIdx,
    totalTicks,
    roundDetails,
    agg
  };
}

// 自动播放包装：两队均 AI 教练（Node 批量模式，行为与逐回合驱动一致）
function simulateMatch(opts) {
  const g = matchGen(opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

module.exports = { simulateMatch, matchGen, sampleFamily };
