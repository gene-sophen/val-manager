// 观赛页打包器：把引擎（CommonJS 模块）+ 已解析队伍 + 地图烘焙进单个自包含 HTML
// 用法: node build_spectator.js --a <队伍> --b <队伍> [--seed 42] [--coachA 75] [--coachB 60] [-o 输出.html] [--selftest]
const fs = require('fs');
const path = require('path');
const { mulberry32 } = require('./rng');
const { loadMap } = require('./gamemap');
const { resolveTeam, parseCliSpec } = require('./teams');

// 浏览器端需要的引擎模块（teams/sim/balance/build_* 只在 Node 侧用，不打进去）
const BROWSER_MODULES = [
  'rng.js', 'config.js', 'hooks.js', 'events.js', 'gamemap.js', 'tactics.js',
  'brain.js', 'movement.js', 'combat.js', 'perception.js', 'abilities.js',
  'round.js', 'economy.js', 'agents.js', 'coach.js', 'report.js', 'match.js'
];

function parseArgs(argv) {
  const args = { seed: 42, coachA: 75, coachB: 60, selftest: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--?/, '');
    if (k === 'selftest') { args.selftest = true; continue; }
    args[k] = argv[++i];
  }
  args.seed = parseInt(args.seed, 10) || 0;
  args.coachA = parseInt(args.coachA, 10);
  args.coachB = parseInt(args.coachB, 10);
  return args;
}

// 队伍瘦身：观赛页只需要这些字段（整卡 374KB 不搬）
function packTeam(t) {
  return {
    name: t.name, tactics: t.tactics, tactics2: t.tactics2, coach: t.coach, iglName: t.iglName,
    players: t.players.map((p) => ({
      name: p.name, AIM: p.AIM, SYN: p.SYN, SEN: p.SEN,
      agents: p.agents, igl: !!p.igl, tier: p.tier
    }))
  };
}

// 把引擎模块包成 shim 注册段
function bundleModules() {
  const parts = [];
  // Node 内置模块桩：agents.js 顶层 require('path')，浏览器里给个最小实现
  parts.push(`__define('path', function(module) { module.exports = { join: function() { return [].join.call(arguments, '/'); } }; });`);
  for (const f of BROWSER_MODULES) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    parts.push(`__define(${JSON.stringify(f)}, function(module, exports, require) {\n${src}\n});`);
  }
  const kits = fs.readFileSync(path.join(__dirname, 'agent_kits.json'), 'utf8');
  parts.push(`__define('agent_kits.json', function(module) { module.exports = ${kits}; });`);
  const names = fs.readFileSync(path.join(__dirname, '..', '数据源', 'agents.json'), 'utf8');
  parts.push(`__define('../数据源/agents.json', function(module) { module.exports = ${names}; });`);
  return parts.join('\n');
}

const SHIM_SRC = `
const __modules = {}, __moduleCache = {};
function __define(id, fn) { __modules[id] = fn; }
function __req(from, request) {
  const p = request.startsWith('./') ? request.slice(2) : request;
  for (const c of [p, p + '.js', p + '.json']) {
    if (!__modules[c]) continue;
    if (!__moduleCache[c]) {
      const m = { exports: {} };
      __moduleCache[c] = m;
      __modules[c](m, m.exports, (r) => __req(c, r));
    }
    return __moduleCache[c].exports;
  }
  throw new Error('模块未打包: ' + request);
}
`;

// 一致性自检：打包出来的模块在 Node 沙箱里跑一场，与直接 require 的结果逐字节对比
function selftest(bundle, mapData, teamA, teamB, seed) {
  const driver = `
    const { mulberry32 } = __req('', 'rng.js');
    const { GameMap } = __req('', 'gamemap.js');
    const { simulateMatch } = __req('', 'match.js');
    const map = new GameMap(${JSON.stringify(mapData)});
    return simulateMatch({ teamA: ${JSON.stringify(teamA)}, teamB: ${JSON.stringify(teamB)},
      map, rng: mulberry32(${seed}) });
  `;
  const fn = new Function(`${SHIM_SRC}\n${bundle}\n${driver}`);
  const r1 = fn();
  const { simulateMatch } = require('./match');
  const r2 = simulateMatch({ teamA, teamB, map: loadMap(path.join(__dirname, 'maps', 'ascent.json')), rng: mulberry32(seed) });
  const pick = (r) => JSON.stringify({ winner: r.winner, scoreA: r.scoreA, scoreB: r.scoreB, rounds: r.rounds, totalTicks: r.totalTicks, agg: r.agg });
  const ok = pick(r1) === pick(r2);
  console.log(`自检：打包模块 vs 直接require → ${ok ? '一致 ✓' : '不一致 ✗'}`);
  console.log('  打包侧:', pick(r1));
  if (!ok) console.log('  直接侧:', pick(r2));
  return ok;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.a || !args.b) {
    console.log('用法: node build_spectator.js --a <队伍> --b <队伍> [--seed 42] [--coachA 75] [--coachB 60] [-o 输出.html] [--selftest]');
    process.exit(1);
  }
  const setupRng = mulberry32(args.seed ^ 0x9e37);
  const teamA = resolveTeam(parseCliSpec(args.a), setupRng);
  const teamB = resolveTeam(parseCliSpec(args.b), setupRng);
  const mapData = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps', 'ascent.json'), 'utf8'));
  const bundle = bundleModules();

  if (args.selftest && !selftest(bundle, mapData, packTeam(teamA), packTeam(teamB), args.seed)) {
    process.exit(1);
  }

  const spect = {
    teamA: packTeam(teamA), teamB: packTeam(teamB),
    map: mapData, seed: args.seed,
    coachTacticsA: args.coachA, coachTacticsB: args.coachB
  };
  const tpl = fs.readFileSync(path.join(__dirname, 'spectator.template.html'), 'utf8');
  const html = tpl
    .replace('/*%%BUNDLE%%*/', () => bundle)
    .replace('/*%%SPECT_DATA%%*/null', () => JSON.stringify(spect));
  const out = args.o || path.join(__dirname, 'out', `spectator_${teamA.name}_vs_${teamB.name}_seed${args.seed}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  console.log(`已生成 ${out}（${(html.length / 1024).toFixed(0)}KB）`);
}

main();
