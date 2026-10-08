// 将征程规则和同一份比赛引擎打进可本地打开的单页入口。
const fs = require('fs');
const path = require('path');

const files = [
  '引擎/rng.js', '引擎/config.js', '引擎/hooks.js', '引擎/events.js',
  '引擎/geometry.js', '引擎/gamemap.js', '引擎/observation.js',
  '引擎/tactics.js', '引擎/squad.js', '引擎/brain.js', '引擎/movement.js', '引擎/actions.js', '引擎/combat.js',
  '引擎/perception.js', '引擎/abilities.js', '引擎/snapshot.js', '引擎/round.js',
  '引擎/economy.js', '引擎/agents.js', '引擎/coach.js', '引擎/report.js',
  '引擎/match.js', '引擎/match-rules.js', '引擎/agent_kits.json', '引擎/maps/ascent.json',
  '数据源/agents.json', '数据源/cards_full.json', '数据源/diamond_cards.json',
  '游戏/catalog.js', '游戏/packs.js', '游戏/random.js', '游戏/state.js',
  '游戏/ledger.js', '游戏/roster.js', '游戏/season-flow.js', '游戏/team-base.js',
  '游戏/lineup.js', '游戏/match-service.js', '游戏/growth.js',
  '游戏/preparation.js', '游戏/review.js', '游戏/standings.js', '游戏/competition.js', '游戏/commands.js', '游戏/storage.js',
  '游戏/content/rules.json', '游戏/content/packs.json',
  '游戏/content/rosters/2026-production-v1.json', '游戏/content/maps.json',
  '游戏/content/coaches.json', '游戏/content/content-manifest.json',
  '游戏/content/demo-run.json', '游戏/content/growth.json', '游戏/content/preparation.json', '游戏/content/competition.json'
];

const shim = `
const __modules = Object.create(null), __cache = Object.create(null);
function __define(id, factory) { __modules[id] = factory; }
function __resolve(from, request) {
  if (request === 'path') return 'path';
  const raw = request.startsWith('.') ? from.split('/').slice(0, -1).concat(request.split('/')) : request.split('/');
  const stack = [];
  for (const part of raw) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop(); else stack.push(part);
  }
  const id = stack.join('/');
  for (const candidate of [id, id + '.js', id + '.json']) if (__modules[candidate]) return candidate;
  throw new Error('模块未打包: ' + from + ' -> ' + request);
}
function __require(from, request) {
  const id = __resolve(from, request);
  if (!__cache[id]) {
    const module = { exports: {} };
    __cache[id] = module;
    __modules[id](module, module.exports, child => __require(id, child));
  }
  return __cache[id].exports;
}
__define('path', function(module) { module.exports = { join: (...parts) => parts.join('/') }; });
`;

function bundle() {
  return shim + files.map(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    return file.endsWith('.json')
      ? `__define(${JSON.stringify(file)}, function(module) { module.exports = ${source}; });`
      : `__define(${JSON.stringify(file)}, function(module, exports, require) {\n${source}\n});`;
  }).join('\n');
}

function build(outputPath = path.join(__dirname, 'out', 'playable.html')) {
  const bundled = bundle();
  // Bundle smoke test catches missing transitive modules before writing the page.
  const smoke = new Function(`${bundled}\nreturn __require('', '游戏/state.js').createState().schemaVersion;`);
  if (smoke() !== 2) throw new Error('网页规则包自检失败');
  const template = fs.readFileSync(path.join(__dirname, 'play.template.html'), 'utf8');
  const html = template.replace('/*%%BUNDLE%%*/', () => bundled);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

if (require.main === module) {
  const output = process.argv[2] || undefined;
  console.log(`已生成 ${build(output)}（征程与观赛共用同一引擎）`);
}

module.exports = { build, bundle };
