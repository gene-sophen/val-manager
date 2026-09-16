// 英雄分配：每队 5 人从各自英雄池内分配互不重复的特工；分配不了则用池外（低熟练度）
const path = require('path');

let AGENT_NAMES = null;
function allAgents() {
  if (!AGENT_NAMES) {
    const raw = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', '数据源', 'agents.json'), 'utf8'));
    AGENT_NAMES = [...new Set(Object.values(raw))];
  }
  return AGENT_NAMES;
}

let KITS = null;
// 英雄技能组（agent_kits.json）；无 kit 的英雄走原型通用行为之外的基础道具
function kitOf(agent) {
  if (!KITS) KITS = require('./agent_kits.json');
  return KITS[agent] || null;
}

// 回溯分配：优先池内不重复；失败的选手落到池外（inPool=false）
function assignAgents(players, rng) {
  const used = new Set();
  const result = new Array(5).fill(null);
  // 池子小的先分，降低冲突
  const order = players.map((p, i) => ({ p, i })).sort((a, b) => a.p.agents.length - b.p.agents.length);
  for (const { p, i } of order) {
    const avail = p.agents.filter((a) => !used.has(a));
    if (avail.length) {
      const pick = avail[Math.floor(rng() * avail.length)];
      used.add(pick);
      result[i] = { agent: pick, inPool: true, kit: kitOf(pick) };
    }
  }
  // 池外补位
  for (let i = 0; i < 5; i++) {
    if (result[i]) continue;
    const outside = allAgents().filter((a) => !used.has(a) && !players[i].agents.includes(a));
    const pick = outside[Math.floor(rng() * outside.length)];
    used.add(pick);
    result[i] = { agent: pick, inPool: false, kit: kitOf(pick) };
  }
  return result;
}

module.exports = { assignAgents, allAgents, kitOf };
