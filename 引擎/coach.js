// 教练系统：赛前布置 / 局间暂停 / 中场调整 / IGL 任命
// 教练三维：战术 / 声望 / 临场（30~99）；本期只有"战术"维生效——
// 战术分越高，暂停时读取对手战术族倾向越准，给出的克制调整越靠谱
const cfg = require('./config');
const { OFFENSE, DEFENSE } = require('./tactics');

function clampAttr(v) {
  return Math.max(30, Math.min(99, v == null ? cfg.coach.tacticsDefault : v));
}

function makeCoach({ name, tactics, prestige, clutch }) {
  return {
    name: name || '教练',
    tactics: clampAttr(tactics),
    prestige: clampAttr(prestige), // 建档，本期未启用
    clutch: clampAttr(clutch)      // 建档，本期未启用
  };
}

// 赛前布置：战术比重 + IGL 任命 + 英雄确认标记
// 战术比重：队伍配置与版本强势族（meta）按战术分加权混合——好教练的赛前布置更贴近版本
// IGL 任命：好教练看意识与协同（SEN+SYN）；战术分低的教练偏爱枪男当指挥（aimPenalty 反噬）
function preMatchSetup({ coach, team }) {
  const base = team.tactics || cfg.defaultTactics;
  const k = (coach.tactics - 30) / 69 * cfg.coach.metaBlend;
  const blend = (b, meta) => {
    const out = {};
    for (const f of Object.keys(meta)) out[f] = (b[f] || 0) * (1 - k) + meta[f] * k;
    return out;
  };
  const tacticWeights = { atk: blend(base.atk, cfg.coach.metaAtk), def: blend(base.def, cfg.coach.metaDef) };
  const aimBias = 1 - coach.tactics / 100; // 战术 99 → 0，战术 30 → 0.7
  let iglPick = null, bestScore = -1e9;
  for (const p of team.players) {
    const s = p.SEN + p.SYN * 0.5 - p.AIM * aimBias;
    if (s > bestScore) { bestScore = s; iglPick = p.name; }
  }
  return { tacticWeights, iglPick, agentConfirm: true }; // 英雄分配见 agents.js，此处只做确认标记
}

// 教练状态初始化（每队一个，贯穿整场）
// tacticsScore：CLI/调用方指定的战术分；teams 配置 coach.tactics 优先
function initCoachState(team, tacticsScore) {
  const coach = makeCoach({ name: `${team.name}教练`, tactics: team.coach && team.coach.tactics != null ? team.coach.tactics : tacticsScore });
  const setup = preMatchSetup({ coach, team });
  return {
    coach,
    weights: setup.tacticWeights,
    baseWeights: { atk: { ...setup.tacticWeights.atk }, def: { ...setup.tacticWeights.def } }, // 初始布置（无信号暂停时回摆用）
    iglPick: (team.coach && team.coach.igl) || setup.iglPick, // 队伍配置可指定 IGL 覆盖
    timeoutsLeft: cfg.coach.timeouts,
    halftimeUsed: false
  };
}

// 暂停调整：战术分决定读取对手倾向的准确率；读对则克制族比重提升，读错则随机调歪
// 攻防两侧一起重排：我方进攻针对对手防守倾向，我方防守针对对手进攻倾向
// 无明确信号（无连出/无明显多数）时暂停只回摆到初始布置（重整旗鼓，不瞎调）
// 暂停同时稳住全队心态（打断对手势头，模仿真实暂停的势头阻断作用）
// ctx: { oppTendency: { atk, def }, oppSignal: { atk, def }, rng, scoreGap, units }
function adjust(state, ctx, kind) {
  const pRead = cfg.coach.readBase + (state.coach.tactics - 30) * cfg.coach.readTacticsCoef;
  if (ctx.units) {
    for (const u of ctx.units) {
      u.mentality = Math.max(-1, Math.min(1, (u.mentality || 0) + cfg.coach.timeoutComposure));
    }
  }
  const out = {};
  const reads = {};
  for (const mySide of ['atk', 'def']) {
    const oppSide = mySide === 'atk' ? 'def' : 'atk';
    const oppFamilies = mySide === 'atk' ? DEFENSE : OFFENSE; // 读的是对手在 oppSide 侧的族
    if (!ctx.oppSignal || !ctx.oppSignal[oppSide]) {
      state.weights[mySide] = { ...state.baseWeights[mySide] }; // 无信号：回摆初始布置
      out[mySide] = { ...state.weights[mySide] };
      reads[mySide] = { read: null, readOk: false, counter: null };
      continue;
    }
    let read = ctx.oppTendency && ctx.oppTendency[oppSide];
    let readOk = true;
    if (!read || ctx.rng() >= pRead) {
      read = oppFamilies[Math.floor(ctx.rng() * oppFamilies.length)]; // 读错：随机抓一个
      readOk = false;
    }
    const counter = (mySide === 'atk' ? cfg.coach.counterAtk : cfg.coach.counterDef)[read];
    if (!counter) { // 防御：读到的族不在克制表则不调整
      reads[mySide] = { read, readOk: false, counter: null };
      out[mySide] = { ...state.weights[mySide] };
      continue;
    }
    const cur = state.weights[mySide];
    const next = {};
    for (const [k, w] of Object.entries(cur)) next[k] = w * (1 - cfg.coach.counterShift);
    next[counter] = (next[counter] || 0) + cfg.coach.counterShift; // 克制族绝对加重，总量保持 1
    state.weights[mySide] = next;
    out[mySide] = { ...next };
    reads[mySide] = { read, readOk, counter };
  }

  // 中场大比分落后：换帅求变（仅真人/API 暂停允许；AI 教练不换——测量显示换高 SEN 指挥是负收益）
  let iglSwap = null;
  if (ctx.allowSwap && kind === 'halftime' && ctx.scoreGap <= -cfg.coach.iglSwapGap && ctx.units) {
    let best = null, bestScore = -1e9;
    for (const u of ctx.units) {
      if (u.name === state.iglPick) continue;
      const s = u.sen + (u.mentality || 0) * 20;
      if (s > bestScore) { bestScore = s; best = u; }
    }
    if (best) { iglSwap = best.name; state.iglPick = best.name; }
  }
  return { kind, reads, weights: out, iglSwap };
}

// AI 教练策略（无真人输入时）：连败或对手同族连出时叫暂停；中场自动用掉中场暂停
// ctx: { loseStreak, oppSameStreak, isHalftime, oppTendency, rng, scoreGap, units }
function aiDecide(state, ctx) {
  if (ctx.isHalftime && !state.halftimeUsed) {
    state.halftimeUsed = true;
    return adjust(state, ctx, 'halftime');
  }
  if (state.timeoutsLeft <= 0) return null;
  if (ctx.loseStreak >= cfg.coach.loseStreakTrigger || ctx.oppSameStreak >= cfg.coach.sameFamilyTrigger) {
    state.timeoutsLeft--;
    return adjust(state, ctx, 'timeout');
  }
  return null;
}

module.exports = { makeCoach, preMatchSetup, initCoachState, aiDecide, adjust };
