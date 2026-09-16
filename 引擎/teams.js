// 队伍配置解析：从 cards_full.json 解析选手，支持文件与档位简写
const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', '数据源', 'cards_full.json');
let _cards = null;
function loadCards() {
  if (!_cards) _cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
  return _cards;
}

const TIER_ALIAS = { '铜': '铜', '银': '银', '金': '金', '钻': '钻', B: '铜', S: '银', G: '金', D: '钻' };

function byTier(tier) { return loadCards().filter((c) => c.tier === tier); }

// 按档位随机抽 n 张不重复卡
function sampleByTier(tier, n, rng) {
  const pool = byTier(tier).slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

// spec 形式：
//   { name, players: [选手名...], tactics?, tactics2? }
//   { name, tiers: ['金','金','银','银','铜'], tactics? }
function resolveTeam(spec, rng) {
  let players;
  if (spec.players) {
    const cards = loadCards();
    players = spec.players.map((name) => {
      const c = cards.find((x) => x.name === name);
      if (!c) throw new Error(`找不到选手卡: ${name}`);
      return c;
    });
  } else if (spec.tiers) {
    players = [];
    const counts = {};
    for (const t of spec.tiers) {
      const tier = TIER_ALIAS[t] || t;
      counts[tier] = (counts[tier] || 0) + 1;
    }
    for (const [tier, n] of Object.entries(counts)) {
      players.push(...sampleByTier(tier, n, rng));
    }
    // 打乱顺序
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
  } else {
    throw new Error('队伍配置需要 players 或 tiers 字段');
  }
  return {
    name: spec.name || '未命名队',
    players,
    tactics: spec.tactics || null,
    tactics2: spec.tactics2 || null,
    coach: spec.coach || null, // 教练配置 { tactics, igl }（可选）
    // IGL：显式指定或自动识别（取队内第一张 igl 标记卡）；noIGL 强制无指挥
    iglName: spec.noIGL ? null : (spec.igl || (players.find((p) => p.igl) || {}).name || null)
  };
}

// CLI 参数：文件路径(.json) 或 tiers:金金银银铜 / tiers:GGSSB
function parseCliSpec(str) {
  if (str.endsWith('.json') && fs.existsSync(str)) {
    return JSON.parse(fs.readFileSync(str, 'utf8'));
  }
  if (str.startsWith('tiers:')) {
    const raw = str.slice(6);
    const tiers = raw.includes(',') ? raw.split(',') : raw.split('');
    return { name: str, tiers: tiers.map((t) => TIER_ALIAS[t] || t) };
  }
  throw new Error(`无法解析队伍配置: ${str}（应为 .json 文件路径或 tiers:GGSSB 形式）`);
}

module.exports = { loadCards, resolveTeam, parseCliSpec, sampleByTier };
