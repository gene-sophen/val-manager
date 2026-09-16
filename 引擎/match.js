// 整局比赛：经济、换边、战术比重、英雄分配、心态、胜负判定
const cfg = require('./config');
const { RoundSim } = require('./round');
const { buyPhase, settleRound } = require('./economy');
const createHooks = require('./hooks');
const { assignAgents } = require('./agents');
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

// matchCfg 可覆盖赛制：{ firstTo, halfRounds }
function simulateMatch({ teamA, teamB, map, rng, logger, matchCfg }) {
  const mc = { ...cfg.match, ...(matchCfg || {}) };
  const hooks = createHooks();
  events.attachHooks(hooks); // 突发事件（爆种/爆冷）+ 心态修正
  const unitsA = makeUnits(teamA, 'atk');
  const unitsB = makeUnits(teamB, 'def');

  // 英雄分配：各自池内互不重复，分不到则池外低熟练度
  for (const [units, team] of [[unitsA, teamA], [unitsB, teamB]]) {
    const assign = assignAgents(team.players, rng);
    units.forEach((u, i) => { u.agent = assign[i].agent; u.inPool = assign[i].inPool; });
  }

  let scoreA = 0, scoreB = 0;
  let roundIdx = 0;
  let totalTicks = 0;
  const roundDetails = [];
  const agg = { popOffs: 0, whiffs: 0, utilsAtk: 0, utilsDef: 0, fakeReads: 0, fakePulled: 0, utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 } };
  // 心态用的连赢/连输计数
  const streak = { A: 0, B: 0 };
  // 手枪局结果（两个半场各一次），用于次回合强起规则
  const pistolWinner = {};
  // 道具效率统计用的试探标记

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

    // 中场战术布置：换边后可换比重
    const atkTac = (secondHalf && atkTeamObj.tactics2) ? atkTeamObj.tactics2.atk : (atkTeamObj.tactics || cfg.defaultTactics).atk;
    const defTac = (secondHalf && defTeamObj.tactics2) ? defTeamObj.tactics2.def : (defTeamObj.tactics || cfg.defaultTactics).def;
    const atkFamily = sampleFamily(atkTac || cfg.defaultTactics.atk, rng);
    const defFamily = sampleFamily(defTac || cfg.defaultTactics.def, rng);

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
      const moneyOf = (units) => units.reduce((s, u) => s + u.wallet.money, 0);
      logger({ t: -1, type: 'round_meta', round: roundIdx + 1, atkTeam: atkTeamObj.name, defTeam: defTeamObj.name, atkFamily, defFamily, atkPlan: buyA.plan, atkReason: buyA.reason, defPlan: buyB.plan, defReason: buyB.reason, scoreA, scoreB, atkMoney: moneyOf(atkUnits), defMoney: moneyOf(defUnits) });
      roundLogger = (ev) => { ev.round = roundIdx + 1; logger(ev); };
    }

    const sim = new RoundSim({
      map, atkUnits, defUnits, atkFamily, defFamily,
      rng, hooks, logger: roundLogger
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

    const winnerTeam = (result.winner === 'atk') ? atkTeam : (atkTeam === 'A' ? 'B' : 'A');
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

module.exports = { simulateMatch, sampleFamily };
