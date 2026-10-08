// 突发事件（爆种/爆冷）+ 心态：通过钩子接入交战判定
// 高光：关键交火中超常发挥；失误：关键时机掉链子。概率由熟练度档位与心态共同调制
const cfg = require('./config');

const P = cfg.proficiency;
const M = cfg.mentality;

// 是否关键时机：进点抢先/反抢先、残局 1vN
function isKeyMoment(ctx) {
  if (ctx.entry) return true;
  return ctx.round.aliveCount(ctx.att.side) === 1; // 残局
}

function combatHook(ctx, p) {
  const u = ctx.att;
  const round = ctx.round;
  // 心态对战力的小幅修正
  p *= 1 + (u.mentality || 0) * M.combatSwing;
  if(round.suppressedEventSides?.has(u.side))return p;
  if (!isKeyMoment(ctx)) return p;
  // 爆种 / 爆冷
  const popP = (u.inPool ? P.popOffIn : P.popOffOut) * (1 + (u.mentality || 0) * M.eventSwing);
  const whiffP = (u.inPool ? P.whiffIn : P.whiffOut) * (1 - (u.mentality || 0) * M.eventSwing);
  const r = round.rng();
  if (r < popP) {
    round.emit('pop_off', { node: u.node, unit: u.name, agent: u.agent });
    round.stats.popOffs++;
    return p * P.popOffMult;
  }
  if (r < popP + whiffP) {
    round.emit('whiff', { node: u.node, unit: u.name, agent: u.agent });
    round.stats.whiffs++;
    return p * P.whiffMult;
  }
  return p;
}

// 回合结束后的心态更新（在 match 层调用）
function updateMentality(units, won, scoreUs, scoreThem, streak) {
  for (const u of units) {
    let m = u.mentality || 0;
    if (won) m += M.winGain + M.streakBonus * Math.max(streak - 1, 0);
    else m -= M.lossDrop + M.streakBonus * Math.max(streak - 1, 0);
    const gap = scoreUs - scoreThem;
    if (gap <= -3) m -= M.gapPressure * Math.floor(-gap / 3); // 落后承压
    if (gap >= 3) m += M.gapPressure * Math.floor(gap / 3) * 0.5; // 领先略松
    m += M.killBoost * (u.roundKills || 0);
    if (!u.alive && !(u.roundKills > 0)) m -= M.deathDrop;
    u.mentality = Math.max(-1, Math.min(1, m));
  }
}

function attachHooks(hooks) {
  hooks.beforeKillRoll.push(combatHook);
}

module.exports = { attachHooks, updateMentality };
