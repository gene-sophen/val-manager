// 教练系统：赛前布置 / 局间暂停 / 中场调整 / IGL 任命
// 教练三维：战术 / 声望 / 临场（0~100）；战术影响读取，临场影响负状态恢复。
// 战术分越高，暂停时读取对手战术族倾向越准，给出的克制调整越靠谱
const cfg = require('./config');
const style = require('../游戏/team-style');
const { OFFENSE, DEFENSE } = require('./tactics');

function clampAttr(v) {
  const value = v == null ? cfg.coach.tacticsDefault : v;
  if (!Number.isFinite(value)) throw new Error('教练属性必须为有限数值');
  return Math.max(0, Math.min(100, value));
}

function makeCoach({ name, tactics, prestige, clutch }) {
  return {
    name: name || '教练',
    tactics: clampAttr(tactics),
    prestige: clampAttr(prestige), // 声望经成长/熟识反哺队伍，不直接叠命中
    clutch: clampAttr(clutch)      // 暂停负状态恢复
  };
}

// 赛前布置：战术比重 + IGL 任命 + 英雄确认标记
// 战术比重：队伍配置与版本强势族（meta）按战术分加权混合——好教练的赛前布置更贴近版本
// IGL 任命：好教练看意识与协同（SEN+SYN）；战术分低的教练偏爱枪男当指挥（aimPenalty 反噬）
function preMatchSetup({ coach, team }) {
  const base = team.tacticalProfile ? {atk:style.weights('attack',style.order(team.tacticalProfile,'attack')),def:style.weights('defense',style.order(team.tacticalProfile,'defense'))} : team.tactics || cfg.defaultTactics;
  const k = team.tacticalProfile ? 0 : Math.max(0, (coach.tactics - 30) / 70) * cfg.coach.metaBlend;
  const blend = (b, meta) => {
    const out = {};
    for (const f of Object.keys(meta)) out[f] = (b[f] || 0) * (1 - k) + meta[f] * k;
    return out;
  };
  const campaign = 'contact' in base.atk;
  const uniform = weights => Object.fromEntries(Object.keys(weights).map(f => [f, 1 / Object.keys(weights).length]));
  const tacticWeights = { atk: blend(base.atk, campaign ? uniform(base.atk) : cfg.coach.metaAtk), def: blend(base.def, campaign ? uniform(base.def) : cfg.coach.metaDef) };
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
function initCoachState(team, tacticsScore, options = {}) {
  const coach = makeCoach({ name: `${team.name}教练`, ...team.coach, tactics: team.coach && team.coach.tactics != null ? team.coach.tactics : tacticsScore });
  const setup = preMatchSetup({ coach, team });
  const weights = options.manual ? (team.tactics || cfg.defaultTactics) : setup.tacticWeights;
  return {
    coach,
    ...(team.tacticalProfile?{tacticalProfile:style.snapshot(team.tacticalProfile)}:{}),
    weights: { atk: { ...weights.atk }, def: { ...weights.def } },
    baseWeights: { atk: { ...weights.atk }, def: { ...weights.def } },
    iglPick: options.manual ? (team.iglName || setup.iglPick) : ((team.coach && team.coach.igl) || setup.iglPick),
    timeoutsLeft: cfg.coach.timeouts,
    overtimeTimeoutsLeft: 0,
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
    recoverMentality(ctx.units, state.coach.clutch);
  }
  const out = {};
  const reads = {};
  for (const mySide of ['atk', 'def']) {
    const oppSide = mySide === 'atk' ? 'def' : 'atk';
    if(state.tacticalProfile){
      const own=mySide==='atk'?'attack':'defense',other=oppSide==='atk'?'attack':'defense';let read=null,readOk=false;
      if(ctx.oppSignal?.[oppSide]){read=style.keys[other].indexOf(ctx.oppTendency?.[oppSide]);readOk=read>=0&&ctx.rng()<pRead;if(!readOk)read=Math.floor(ctx.rng()*5);}
      const order=style.order(state.tacticalProfile,own,read==null?[]:[read],Math.max(0,Math.min(1,pRead)));
      state.weights[mySide]=style.weights(own,order);out[mySide]={...state.weights[mySide]};reads[mySide]={read:read==null?null:style.keys[other][read],readOk,counter:read==null?null:style.keys[own][order[0]]};continue;
    }
    const campaign = 'contact' in state.weights.atk;
    const oppFamilies = campaign ? (mySide === 'atk' ? require('./tactics').CAMPAIGN_DEFENSE : require('./tactics').CAMPAIGN_OFFENSE) : (mySide === 'atk' ? DEFENSE : OFFENSE);
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
    const counter = (campaign ? (mySide === 'atk'
      ? { push: 'rush', hold: 'fake', trap: 'mid', flank: 'contact', retake: 'lurk' }
      : { rush: 'trap', mid: 'push', fake: 'hold', lurk: 'flank', contact: 'retake' })
      : (mySide === 'atk' ? cfg.coach.counterAtk : cfg.coach.counterDef))[read];
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
  const timeoutKey = ctx.isOvertime ? 'overtimeTimeoutsLeft' : 'timeoutsLeft';
  if (wantsTimeout(state, ctx)) {
    state[timeoutKey]--;
    return adjust(state, ctx, 'timeout');
  }
  return null;
}

function wantsTimeout(state, ctx) {
  const key = ctx.isOvertime ? 'overtimeTimeoutsLeft' : 'timeoutsLeft';
  return !ctx.isHalftime && state[key] > 0 && (ctx.loseStreak >= cfg.coach.loseStreakTrigger || ctx.oppSameStreak >= cfg.coach.sameFamilyTrigger);
}
function recoverMentality(units, clutch = 50, bonus = 0) {
  const fraction = Math.min(1, 0.1 + 0.002 * clampAttr(clutch) + bonus);
  for (const unit of units) if (unit.mentality < 0) unit.mentality *= 1 - fraction;
}
module.exports = { makeCoach, preMatchSetup, initCoachState, aiDecide, adjust, wantsTimeout, recoverMentality };
