function reviewMatch(result) {
  if (!result) throw new Error('缺少真实比赛结果');
  const events = result.eventLog || [];
  const plants = events.filter(event => event.type === 'plant');
  const growth = events.filter(event => event.type === 'growth_trigger');
  const atkRounds = result.roundDetails.filter(round => round.atkTeam === 'A');
  const atkWins = atkRounds.filter(round => round.winner === 'A');
  const facts = {
    score: `${result.scoreA}:${result.scoreB}`,
    attackWins: atkWins.length, attackRounds: atkRounds.length,
    plants: plants.length,
    growthTriggers: Object.fromEntries([...new Set(growth.map(event => event.growthId))].map(id => [id, growth.filter(event => event.growthId === id).length]))
  };
  let observation;
  let suggestion;
  let evidence;
  if (atkRounds.length && atkWins.length * 2 < atkRounds.length) {
    observation = `进攻方赢下 ${atkWins.length}/${atkRounds.length} 回合`;
    suggestion = '下场可尝试提高中路或变速战术权重，并观察能否更稳定地下包。';
    evidence = atkRounds.map(round => round.round);
  } else if (plants.length) {
    observation = `全场完成 ${plants.length} 次下包`;
    suggestion = '下场可比较下包后的回防与守包过程，再决定是否调整站位。';
    evidence = plants.map(event => event.round);
  } else {
    observation = '当前比赛记录没有足够的进攻过程证据';
    suggestion = '下一场先观察突破前的集合与技能时序。';
    evidence = [];
  }
  return { facts, observation, suggestion, evidenceRounds: [...new Set(evidence)],
    basis: '事实来自本场事件；建议是待验证的调整，并非因果结论。' };
}

module.exports = { reviewMatch };
