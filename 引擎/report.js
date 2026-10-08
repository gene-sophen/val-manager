// 极简战报：每回合一句话中文摘要（模板渲染事件流，只读不改）
// 样例："R7｜金卡快攻 爆弹冲点打A｜brawk 三杀破点｜金卡快攻 5:2 银卡默认（拆包）"
const FAMILY_NAME = {
  rush: '爆弹强攻', mid: '默认控图', lurk: '分路渗透', fake: '佯攻转点',
  push: '前压争夺', hold: '分区控图', stack: '赌点防守',
  contact: '接触反打', trap: '诱敌设伏', flank: '侧翼绕后', retake: '稳守反清'
};
const REASON_NAME = { elimination: '歼灭', explosion: '爆能器引爆', defuse: '拆包', timeout: '超时' };
const NUM = ['', '', '双', '三', '四', '五'];

// 队名缩短：去掉常见后缀/前缀，便于一句话阅读
function shortName(name) {
  return String(name || '').replace(/^tiers:/, '').replace(/队$/, '');
}

// ctx: { round, atkTeam, defTeam, atkFamily, scoreA, scoreB, nameA, nameB, reason, winnerSide }
// events: 本回合事件数组
function roundSummary(events, ctx) {
  const kills = events.filter((e) => e.type === 'kill');
  // 高光：优先多杀，其次首杀
  const byKiller = {};
  for (const k of kills) byKiller[k.killer] = (byKiller[k.killer] || 0) + 1;
  const top = Object.entries(byKiller).sort((a, b) => b[1] - a[1])[0];
  let highlight;
  if (top && top[1] >= 2) highlight = `${top[0]} ${NUM[Math.min(top[1], 5)]}杀${top[1] >= 3 ? '破点' : ''}`;
  else if (kills.length) highlight = `${kills[0].killer} 首杀`;
  else highlight = '无交火';
  const plant = events.find((e) => e.type === 'plant');
  const site = plant ? plant.site : '';
  const reason = REASON_NAME[ctx.reason];
  const tail = reason && reason !== '歼灭' ? `（${reason}）` : '';
  return `R${ctx.round}｜${shortName(ctx.atkTeam)} ${FAMILY_NAME[ctx.atkFamily] || ctx.atkFamily}${site ? '打' + site : ''}`
    + `｜${highlight}｜${shortName(ctx.nameA)} ${ctx.scoreA}:${ctx.scoreB} ${shortName(ctx.nameB)}${tail}`;
}

// 整场战报：按回合分组渲染（round_end.summary 已生成则直接取用）
function matchReport(matchEvents) {
  const metas = {};
  for (const e of matchEvents) {
    if (e.type === 'round_meta') metas[e.round] = e;
  }
  const byRound = {};
  for (const e of matchEvents) {
    if (e.round == null || e.type === 'round_meta') continue;
    (byRound[e.round] = byRound[e.round] || []).push(e);
  }
  const out = [];
  for (const r of Object.keys(byRound).map(Number).sort((a, b) => a - b)) {
    const end = byRound[r].find((e) => e.type === 'round_end');
    const meta = metas[r];
    if (!end || !meta) continue;
    if (end.summary) { out.push(end.summary); continue; }
    const score = byRound[r].find((e) => e.type === 'score');
    out.push(roundSummary(byRound[r], {
      round: r, atkTeam: meta.atkTeam, defTeam: meta.defTeam, atkFamily: meta.atkFamily,
      scoreA: score ? score.scoreA : meta.scoreA, scoreB: score ? score.scoreB : meta.scoreB,
      nameA: meta.atkTeam, nameB: meta.defTeam, reason: end.reason
    }));
  }
  return out;
}

module.exports = { roundSummary, matchReport };
