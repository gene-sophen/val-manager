// 批量无渲染模拟 CLI
// 用法: node 引擎/sim.js --a <队伍配置> --b <队伍配置> --n 1000 [--seed 42] [--log] [--firstTo 13] [--halfRounds 12]
const fs = require('fs');
const path = require('path');
const { mulberry32, derive } = require('./rng');
const { loadMap } = require('./gamemap');
const { simulateMatch } = require('./match');
const { resolveTeam, parseCliSpec } = require('./teams');

function parseArgs(argv) {
  const args = { n: 1, seed: 42, log: false };
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1];
    if (k === 'log') { args.log = true; i--; continue; }
    args[k] = v;
  }
  args.n = parseInt(args.n, 10) || 1;
  args.seed = parseInt(args.seed, 10) || 0;
  return args;
}

const PLAN_NAME = { pistol: '手枪局', eco: 'ECO局', half: '混起局', full: '长枪局' };
const FAMILY_NAME = {
  rush: '爆弹冲点', mid: '中路接触', lurk: '边线渗透', fake: '假打转点',
  push: '防守前压', hold: '默认架点', stack: '赌点防守'
};

// 聚合多场模拟的统计
function runBatch(specA, specB, n, seed, opts = {}) {
  const map = loadMap(path.join(__dirname, 'maps', 'ascent.json'));
  const setupRng = mulberry32(derive(seed, 0));
  const teamA = resolveTeam(specA, setupRng);
  const teamB = resolveTeam(specB, setupRng);

  const stats = {
    teamA: teamA.name, teamB: teamB.name,
    winsA: 0, winsB: 0,
    totalRounds: 0, totalTicks: 0,
    scoreDist: {},        // "13:7" -> 场数
    reasonDist: {},       // 回合终局方式
    planDist: {},         // 局型出现率（队·回合）
    halfReasons: { pistol_follow: 0, desperate: 0, other: 0 }, // 混起局的触发场景
    family: {},           // 战术族: { used, won }（按使用该族的一方统计回合胜负）
    atkWins: 0, defWins: 0,
    plantRounds: 0,
    retakeSuccess: 0,     // 下包后防守方赢回回合（回防成功）
    popOffs: 0, whiffs: 0, utils: 0
  };
  const matchCfg = {};
  if (opts.firstTo) matchCfg.firstTo = opts.firstTo;
  if (opts.halfRounds) matchCfg.halfRounds = opts.halfRounds;

  let logged = false;
  const outDir = path.join(__dirname, 'out');

  for (let i = 0; i < n; i++) {
    const rng = mulberry32(derive(seed, i + 1));
    let logger = null;
    let events = null;
    if (opts.log && (!logged || opts.logAll)) {
      events = [];
      logger = (ev) => events.push(ev);
    }
    const m = simulateMatch({ teamA, teamB, map, rng, logger, matchCfg });
    if (events) {
      fs.mkdirSync(outDir, { recursive: true });
      const safe = (s) => s.replace(/[\\/:*?"<>|]/g, '_');
      fs.writeFileSync(
        path.join(outDir, `match_${safe(teamA.name)}_vs_${safe(teamB.name)}_seed${seed}.jsonl`),
        events.map((e) => JSON.stringify(e)).join('\n') + '\n'
      );
      logged = true;
    }

    if (m.winner === 'A') stats.winsA++; else stats.winsB++;
    stats.totalRounds += m.rounds;
    stats.totalTicks += m.totalTicks;
    const score = `${m.scoreA}:${m.scoreB}`;
    stats.scoreDist[score] = (stats.scoreDist[score] || 0) + 1;
    for (const r of m.roundDetails) {
      stats.reasonDist[r.reason] = (stats.reasonDist[r.reason] || 0) + 1;
      if (r.planted) {
        stats.plantRounds++;
        if (r.winner !== r.atkTeam) stats.retakeSuccess++; // 下包后守方赢 = 回防成功
      }
      if (r.winner === r.atkTeam) stats.atkWins++; else stats.defWins++;
      for (const [plan, reason] of [[r.atkPlan, r.atkReason], [r.defPlan, r.defReason]]) {
        const name = PLAN_NAME[plan];
        stats.planDist[name] = (stats.planDist[name] || 0) + 1;
        if (plan === 'half') {
          const key = (reason === 'pistol_follow' || reason === 'desperate') ? reason : 'other';
          stats.halfReasons[key]++;
        }
      }
      // 战术族统计
      const atkKey = `攻·${FAMILY_NAME[r.atkFamily]}`;
      const defKey = `守·${FAMILY_NAME[r.defFamily]}`;
      stats.family[atkKey] = stats.family[atkKey] || { used: 0, won: 0 };
      stats.family[defKey] = stats.family[defKey] || { used: 0, won: 0 };
      stats.family[atkKey].used++;
      stats.family[defKey].used++;
      if (r.winner === r.atkTeam) stats.family[atkKey].won++;
      else stats.family[defKey].won++;
    }
    stats.popOffs += m.agg.popOffs;
    stats.whiffs += m.agg.whiffs;
    stats.utils += m.agg.utilsAtk + m.agg.utilsDef;
  }
  return stats;
}

function printStats(stats, n) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  console.log(`\n===== ${stats.teamA} vs ${stats.teamB} · ${n} 场 =====`);
  console.log(`胜率: ${stats.teamA} ${pct(stats.winsA / n)} / ${stats.teamB} ${pct(stats.winsB / n)}`);
  console.log(`平均回合数: ${(stats.totalRounds / n).toFixed(1)}  平均时长: ${(stats.totalTicks / n).toFixed(0)} 秒`);
  console.log(`攻防回合胜率: 攻方 ${pct(stats.atkWins / (stats.atkWins + stats.defWins))} / 守方 ${pct(stats.defWins / (stats.atkWins + stats.defWins))}`);
  const totalRounds = stats.totalRounds;
  console.log(`下包率: ${pct(stats.plantRounds / totalRounds)}  回防成功率: ${pct(stats.retakeSuccess / Math.max(stats.plantRounds, 1))}`);
  console.log(`突发事件: 爆种 ${(stats.popOffs / n).toFixed(1)} 次/场, 爆冷 ${(stats.whiffs / n).toFixed(1)} 次/场, 道具使用 ${(stats.utils / n).toFixed(1)} 点/场`);
  console.log('\n回合终局方式:');
  const reasonName = { elimination: '歼灭', explosion: '爆能器引爆', defuse: '拆包', timeout: '超时' };
  for (const [k, v] of Object.entries(stats.reasonDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reasonName[k] || k}: ${pct(v / totalRounds)}`);
  }
  const totalPlans = Object.values(stats.planDist).reduce((a, b) => a + b, 0);
  console.log('\n局型出现率:');
  for (const [k, v] of Object.entries(stats.planDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${pct(v / totalPlans)}`);
  }
  const hr = stats.halfReasons;
  const hrTotal = hr.pistol_follow + hr.desperate + hr.other;
  if (hrTotal > 0) {
    console.log(`  混起局触发场景: 手枪局后续强起 ${pct(hr.pistol_follow / hrTotal)} / 赛点孤注一掷 ${pct(hr.desperate / hrTotal)} / 其他 ${pct(hr.other / hrTotal)}`);
  }
  console.log('\n战术族回合胜率:');
  for (const [k, v] of Object.entries(stats.family)) {
    console.log(`  ${k}: ${pct(v.won / v.used)} (${v.won}/${v.used})`);
  }
  console.log('\n比分分布(top8):');
  const sorted = Object.entries(stats.scoreDist).sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [k, v] of sorted) console.log(`  ${k}: ${v}`);
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (!args.a || !args.b) {
    console.error('用法: node 引擎/sim.js --a <队伍.json|tiers:GGSSB> --b <同左> --n 1000 [--seed 42] [--log]');
    process.exit(1);
  }
  const matchCfg = {};
  if (args.firstTo) matchCfg.firstTo = parseInt(args.firstTo, 10);
  if (args.halfRounds) matchCfg.halfRounds = parseInt(args.halfRounds, 10);
  const t0 = Date.now();
  const stats = runBatch(parseCliSpec(args.a), parseCliSpec(args.b), args.n, args.seed, {
    log: args.log, firstTo: matchCfg.firstTo, halfRounds: matchCfg.halfRounds
  });
  printStats(stats, args.n);
  const dt = (Date.now() - t0) / 1000;
  console.log(`\n耗时 ${dt.toFixed(1)}s (${(args.n / dt).toFixed(1)} 场/秒)`);
}

module.exports = { runBatch, printStats, FAMILY_NAME };
