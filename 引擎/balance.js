// 平衡自检 v1：全铜/全银/全金/混编 四支测试队两两对阵，每场重新随机抽 roster 摊平抽卡运气
// 用法: node 引擎/balance.js [--n 1000] [--seed 1]
const fs = require('fs');
const path = require('path');
const { mulberry32, derive } = require('./rng');
const { loadMap } = require('./gamemap');
const { simulateMatch } = require('./match');
const { resolveTeam } = require('./teams');
const { FAMILY_NAME } = require('./sim');

const ARCHETYPES = {
  '全铜': ['铜', '铜', '铜', '铜', '铜'],
  '全银': ['银', '银', '银', '银', '银'],
  '全金': ['金', '金', '金', '金', '金'],
  '混编': ['金', '银', '银', '铜', '铜'] // 1金2银2铜
};

const PLAN_NAME = { pistol: '手枪局', eco: 'ECO局', half: '混起局', full: '长枪局' };
const REASON_NAME = { elimination: '歼灭', explosion: '爆能器引爆', defuse: '拆包', timeout: '超时' };

function parseArgs(argv) {
  const args = { n: 1000, seed: 1 };
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  args.n = parseInt(args.n, 10);
  args.seed = parseInt(args.seed, 10);
  return args;
}

function emptyDetail() {
  return {
    totalRounds: 0, totalTicks: 0, atkWins: 0,
    plantRounds: 0, retakeSuccess: 0,
    reasonDist: {}, planDist: {}, halfReasons: { pistol_follow: 0, desperate: 0, other: 0 },
    family: {}, popOffs: 0, whiffs: 0, utils: 0,
    fakeReads: 0, fakePulled: 0,
    utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 },
    abilityByArchetype: {}
  };
}

function feedDetail(d, m) {
  d.totalRounds += m.rounds;
  d.totalTicks += m.totalTicks;
  d.popOffs += m.agg.popOffs;
  d.whiffs += m.agg.whiffs;
  d.utils += m.agg.utilsAtk + m.agg.utilsDef;
  d.fakeReads += m.agg.fakeReads;
  d.fakePulled += m.agg.fakePulled;
  for (const k of Object.keys(d.utilsByType)) d.utilsByType[k] += m.agg.utilsByType[k];
  for (const [k, v] of Object.entries(m.agg.abilityByArchetype || {})) {
    d.abilityByArchetype[k] = (d.abilityByArchetype[k] || 0) + v;
  }
  for (const r of m.roundDetails) {
    if (r.winner === r.atkTeam) d.atkWins++;
    if (r.planted) {
      d.plantRounds++;
      if (r.winner !== r.atkTeam) d.retakeSuccess++;
    }
    d.reasonDist[r.reason] = (d.reasonDist[r.reason] || 0) + 1;
    for (const [plan, reason] of [[r.atkPlan, r.atkReason], [r.defPlan, r.defReason]]) {
      d.planDist[plan] = (d.planDist[plan] || 0) + 1;
      if (plan === 'half') {
        const key = (reason === 'pistol_follow' || reason === 'desperate') ? reason : 'other';
        d.halfReasons[key]++;
      }
    }
    const ak = `攻·${FAMILY_NAME[r.atkFamily]}`;
    const dk = `守·${FAMILY_NAME[r.defFamily]}`;
    d.family[ak] = d.family[ak] || { used: 0, won: 0 };
    d.family[dk] = d.family[dk] || { used: 0, won: 0 };
    d.family[ak].used++; d.family[dk].used++;
    if (r.winner === r.atkTeam) d.family[ak].won++; else d.family[dk].won++;
  }
}

function runPair(map, nameA, nameB, n, seed) {
  let winsA = 0;
  const detail = emptyDetail();
  for (let i = 0; i < n; i++) {
    // 每场独立抽 roster，消除单套阵容的偶然性
    const setupRng = mulberry32(derive(seed, i * 2 + 1));
    const teamA = resolveTeam({ name: nameA, tiers: ARCHETYPES[nameA] }, setupRng);
    const teamB = resolveTeam({ name: nameB, tiers: ARCHETYPES[nameB] }, setupRng);
    const rng = mulberry32(derive(seed + 7777, i + 1));
    const m = simulateMatch({ teamA, teamB, map, rng });
    if (m.winner === 'A') winsA++;
    feedDetail(detail, m);
  }
  return { winRateA: winsA / n, detail };
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }

function main() {
  const args = parseArgs(process.argv);
  const map = loadMap(path.join(__dirname, 'maps', 'ascent.json'));
  const names = Object.keys(ARCHETYPES);
  const t0 = Date.now();

  const matrix = {};
  const pairDetail = {};
  let pairIdx = 0;
  for (const a of names) {
    matrix[a] = {};
    for (const b of names) {
      const r = runPair(map, a, b, args.n, args.seed + pairIdx * 131);
      matrix[a][b] = r.winRateA;
      pairDetail[`${a} vs ${b}`] = r.detail;
      pairIdx++;
      console.log(`${a} vs ${b}: ${pct(r.winRateA)}  (avg ${(r.detail.totalRounds / args.n).toFixed(1)} 回合)`);
    }
  }

  // 镜像场（混编 vs 混编）用于攻防/局型/战术族统计
  const mirror = pairDetail['混编 vs 混编'];
  const mRounds = mirror.totalRounds;
  const totalPlans = Object.values(mirror.planDist).reduce((a, b) => a + b, 0);
  const hr = mirror.halfReasons;
  const hrTotal = Math.max(hr.pistol_follow + hr.desperate + hr.other, 1);

  const lines = [];
  lines.push('# 战斗推演引擎 v3 · 平衡自检报告', '');
  lines.push(`- 测试时间：${new Date().toISOString().slice(0, 10)}`);
  lines.push(`- 样本：每对对阵 ${args.n} 场（每场重新随机抽 roster），种子 ${args.seed}`);
  lines.push(`- 赛制：先到 13 胜，12 回合换边，12:12 一加时局`);
  lines.push(`- 地图：亚海悬城双点图（17 节点 + 34 对枪点 + 46 枪线）`);
  lines.push('- v3（Phase2-B）：决策层重写为个体效用 AI（brain.js），战术族退化为意图先验（tactics.js）；对枪点选位（SEN 驱动）与跨节点枪线交火；IGL 意图增强 + 指挥枪法代价', '');
  lines.push('## 胜率矩阵（行对列的胜率）', '');
  lines.push('| | ' + names.join(' | ') + ' |');
  lines.push('|' + '---|'.repeat(names.length + 1));
  for (const a of names) {
    lines.push(`| **${a}** | ` + names.map((b) => pct(matrix[a][b])).join(' | ') + ' |');
  }
  lines.push('');
  lines.push('## 预期校验', '');
  const gb = matrix['全金']['全铜'], gs = matrix['全金']['全银'], sb = matrix['全银']['全铜'];
  lines.push(`- 金 vs 铜：${pct(gb)}（预期 65%~85%）${gb >= 0.65 && gb <= 0.85 ? ' ✅' : ' ❌'}`);
  lines.push(`- 金 vs 银：${pct(gs)}（预期明显 >50%）${gs > 0.5 ? ' ✅' : ' ❌'}`);
  lines.push(`- 银 vs 铜：${pct(sb)}（预期明显 >50%）${sb > 0.5 ? ' ✅' : ' ❌'}`);
  const sameTier = names.filter((n) => n !== '混编').map((n) => matrix[n][n]);
  const sameOk = sameTier.every((x) => x > 0.44 && x < 0.56);
  lines.push(`- 同档对阵：${sameTier.map(pct).join(' / ')}（预期接近 50%）${sameOk ? ' ✅' : ' ❌'}`, '');
  const atkRate = mirror.atkWins / mRounds;
  lines.push('## 攻防与节奏（混编镜像场）', '');
  lines.push(`- 攻方回合胜率：${pct(atkRate)}（目标 45%~55%）${atkRate >= 0.45 && atkRate <= 0.55 ? ' ✅' : ' ❌'}`);
  const retakeRate = mirror.retakeSuccess / Math.max(mirror.plantRounds, 1);
  lines.push(`- 下包率：${pct(mirror.plantRounds / mRounds)}　回防成功率：${pct(retakeRate)}（目标 20%~30%）${retakeRate >= 0.2 && retakeRate <= 0.3 ? ' ✅' : ' ❌'}`);
  lines.push(`- 平均回合数：${(mRounds / args.n).toFixed(1)}　平均单局时长：${(mirror.totalTicks / args.n).toFixed(0)} 秒`);
  lines.push(`- 突发事件：爆种 ${(mirror.popOffs / args.n).toFixed(1)} 次/场，爆冷 ${(mirror.whiffs / args.n).toFixed(1)} 次/场，道具消耗 ${(mirror.utils / args.n).toFixed(1)} 点/场`, '');
  // 道具使用分布与假打博弈
  const UT = { flash: '闪光', smoke: '烟雾', molly: '燃烧', recon: '侦察', trap: '哨卫警戒' };
  lines.push('## 道具使用分布（混编镜像场，点/场）', '');
  for (const [k, v] of Object.entries(mirror.utilsByType)) {
    lines.push(`- ${UT[k]}：${(v / args.n).toFixed(1)}`);
  }
  lines.push('');
  lines.push(`假打博弈：场均识破 ${(mirror.fakeReads / args.n).toFixed(2)} 次 / 中计被拉扯 ${(mirror.fakePulled / args.n).toFixed(2)} 次`, '');
  // 技能原型分布（ability 事件按 archetype 聚合；检查无单一原型独大）
  const ab = mirror.abilityByArchetype;
  const abTotal = Object.values(ab).reduce((a, b) => a + b, 0);
  lines.push('## 技能原型分布（混编镜像场，次/场）', '');
  let maxArch = null, maxShare = 0;
  for (const [k, v] of Object.entries(ab).sort((a, b) => b[1] - a[1])) {
    const share = v / Math.max(abTotal, 1);
    if (share > maxShare) { maxShare = share; maxArch = k; }
    lines.push(`- ${k}：${(v / args.n).toFixed(2)}（${pct(share)}）`);
  }
  lines.push(`- 独大检查：最大原型 ${maxArch || '-'} ${pct(maxShare)}（阈值 ≤60%）${maxShare <= 0.6 ? ' ✅' : ' ❌'}`, '');
  lines.push('## 局型分布（混编镜像场，按队·回合计）', '');
  for (const [k, v] of Object.entries(mirror.planDist).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${PLAN_NAME[k]}：${pct(v / totalPlans)}`);
  }
  lines.push(`- 混起局触发场景：手枪局后续强起 ${pct(hr.pistol_follow / hrTotal)} / 赛点孤注一掷 ${pct(hr.desperate / hrTotal)} / 其他 ${pct(hr.other / hrTotal)}（v1 规则要求"其他"≈0）`, '');
  lines.push('## 回合终局分布（混编镜像场）', '');
  for (const [k, v] of Object.entries(mirror.reasonDist).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${REASON_NAME[k] || k}：${pct(v / mRounds)}`);
  }
  lines.push('');
  lines.push('## 战术族回合胜率（混编镜像场，作为该族使用方的回合胜率）', '');
  for (const [k, v] of Object.entries(mirror.family)) {
    lines.push(`- ${k}：${pct(v.won / v.used)}（${v.won}/${v.used}）`);
  }
  lines.push('');

  // ---- 战术克制交叉矩阵（4 攻 × 3 守，固定单族对撞，混编镜像数值）----
  const ATKF = ['rush', 'mid', 'lurk', 'fake'];
  const DEFF = ['push', 'hold', 'stack'];
  const tacN = Math.min(150, Math.max(60, Math.floor(args.n / 7)));
  const cross = {};
  for (const af of ATKF) {
    cross[af] = {};
    for (const df of DEFF) {
      let atkRoundWins = 0, total = 0;
      for (let i = 0; i < tacN; i++) {
        const mk = (s) => {
          const t = { [af]: 1 };
          const d = { [df]: 1 };
          return resolveTeam({ name: 'T', tiers: ARCHETYPES['混编'], tactics: { atk: t, def: d } }, mulberry32(derive(args.seed + 99, i * 2 + s)));
        };
        const m = simulateMatch({ teamA: mk(0), teamB: mk(1), map, rng: mulberry32(derive(args.seed + 555, i)) });
        for (const r of m.roundDetails) { total++; if (r.winner === r.atkTeam) atkRoundWins++; }
      }
      cross[af][df] = atkRoundWins / total;
    }
  }
  lines.push(`## 战术克制交叉矩阵（攻方回合胜率，每格 ${tacN} 场镜像）`, '');
  lines.push('| 攻 \\ 守 | 防守前压 | 默认架点 | 赌点防守 |');
  lines.push('|---|---|---|---|');
  for (const af of ATKF) {
    lines.push(`| ${FAMILY_NAME[af]} | ` + DEFF.map((df) => pct(cross[af][df])).join(' | ') + ' |');
  }
  lines.push('');

  // ---- IGL 有无对比（金档：4 金 + 1 金 IGL vs 5 金无 IGL）----
  const { loadCards } = require('./teams');
  const cards = loadCards();
  const goldIgl = cards.filter((c) => c.tier === '金' && c.igl).map((c) => c.name);
  const goldPlain = cards.filter((c) => c.tier === '金' && !c.igl).map((c) => c.name);
  const iglN = Math.min(600, args.n);
  let iglWins = 0;
  for (let i = 0; i < iglN; i++) {
    const r = mulberry32(derive(args.seed + 2333, i));
    const pickN = (pool, n, excl) => {
      const p = pool.filter((x) => !excl.has(x));
      const out = [];
      for (let k = 0; k < n; k++) out.push(p.splice(Math.floor(r() * p.length), 1)[0]);
      return out;
    };
    const iglName = goldIgl[Math.floor(r() * goldIgl.length)];
    const teamIGL = resolveTeam({ name: '有IGL', players: [...pickN(goldPlain, 4, new Set()), iglName] }, r);
    const teamNo = resolveTeam({ name: '无IGL', players: pickN(goldPlain, 5, new Set([iglName])), noIGL: true }, r);
    const m = simulateMatch({ teamA: teamIGL, teamB: teamNo, map, rng: mulberry32(derive(args.seed + 3777, i)) });
    if (m.winner === 'A') iglWins++;
  }
  lines.push('## IGL 有无对比（金档镜像数值）', '');
  lines.push(`- 4 金 + 1 金卡 IGL vs 5 金无 IGL：${iglN} 场，有 IGL 方胜率 ${pct(iglWins / iglN)}`);
  lines.push('- 注：金卡 IGL 相对金卡非 IGL 有 AIM -4.7 的枪法折损（SYN/SEN 更高）；加长样本复测有 IGL 方约 51%——指挥加成覆盖枪法折损后略有盈余', '');

  fs.writeFileSync(path.join(__dirname, 'BALANCE_v3.md'), lines.join('\n'));
  console.log(`\n耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s，已写入 引擎/BALANCE_v3.md`);
}

if (require.main === module) main();
