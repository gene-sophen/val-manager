// 修正钩子：v0 全部为空，预留给突发事件 / 暗属性触发器 / 特性 / 明星时刻 / 教练三维
// 每个钩子是一个函数数组，按注册顺序调用
module.exports = function createHooks() {
  return {
    // 交火判定前：fn(ctx, p) => p'；ctx = { att, tgt, node, round }
    beforeKillRoll: [],
    // 决策前：fn(ctx, utilities) => utilities'；ctx = { unit, round, options }
    beforeDecision: [],
    // 回合开始：fn(round)
    onRoundStart: [],
    // 击杀发生后：fn(ctx) ctx = { killer, victim, node, round }
    onKill: []
  };
};
