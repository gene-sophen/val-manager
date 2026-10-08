// All consumers use these rules for score termination and side selection.
function matchOver(scoreA, scoreB, rules) {
  return Math.max(scoreA, scoreB) >= rules.firstTo && Math.abs(scoreA - scoreB) >= 2;
}
function attackSide(roundIndex, rules) {
  const initial = rules.initialAttacker || 'A';
  if (!['A', 'B'].includes(initial)) throw new Error('初始攻方必须为 A 或 B');
  const opposite = initial === 'A' ? 'B' : 'A';
  if (roundIndex < rules.halfRounds) return initial;
  if (roundIndex < rules.halfRounds * 2) return opposite;
  return (roundIndex - rules.halfRounds * 2) % 2 === 0 ? initial : opposite;
}
function validateMatchRules(rules) {
  if (!Number.isInteger(rules.halfRounds) || rules.halfRounds < 1 || rules.firstTo !== rules.halfRounds + 1
    || !Number.isFinite(rules.overtimeMoney) || rules.overtimeMoney < 0) throw new Error('无效赛制：胜分应为半场回合数加一');
  attackSide(0, rules);
}
module.exports = { matchOver, attackSide, validateMatchRules };
