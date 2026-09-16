// 英雄技能系统：kit 挂载 / 释放决策 / 效果落地
// 建模：原型族(archetype) + 专属参数(params) + 招牌机制(sig)
// 释放时机挂 SEN（utilThink 判定），效果效率挂 SYN（沿用 config.utility 的 synBase/synCoef），
// 池外英雄失误率更高（衔接 config.proficiency 的 whiff 体系）
// 反应式技能（闪光/落点烟/燃烧拖延/防守侦察/哨卫预置）在既有触发点施放；
// 主动技能（炮台/治疗/幕墙/假身/位移/自增益/进攻侦察/守包燃烧）并入 brain 候选动作
const cfg = require('./config');
const KITS = require('./agent_kits.json');

const A = cfg.abilities;
const U = cfg.utility;

// ---- 挂载 ----
// 回合开始挂载技能实例：小技能每回合刷新，大招整场一次（ultSpent 持久）
// kit 由 agents.js 分配英雄时挂到单位上（u.kit），池内/池外熟练度标记 u.inPool 供失误判定
function mount(u) {
  const kit = u.kit || KITS[u.agent];
  u.skills = {};
  if (!kit) return;
  for (const s of kit.skills) {
    u.skills[s.key] = { def: s, left: s.key === 'x' ? (u.ultSpent ? 0 : 1) : s.charges };
  }
}

function readySkills(u) {
  const out = [];
  for (const k of Object.keys(u.skills || {})) {
    const sk = u.skills[k];
    if (sk.left > 0) out.push(sk);
  }
  return out;
}

function findSkill(u, archetype) {
  for (const sk of readySkills(u)) if (sk.def.archetype === archetype) return sk;
  return null;
}

// 时机判定（SEN）：该用时能不能想到用
function thinkCast(round, u) {
  return round.rng() < cfg.ai.utilThinkBase + u.sen * cfg.ai.utilThinkSen;
}

// 施放结算：消耗 charge + 失误判定 + ability 事件 + 记账；返回 { power, fumble, skill }
function cast(round, u, sk, extra = {}) {
  if (!sk || sk.left <= 0) return null;
  sk.left--;
  const ult = sk.def.key === 'x';
  if (ult) u.ultSpent = true;
  const P = cfg.proficiency, M = cfg.mentality;
  // 池内/池外失误概率，心态调制（沿用 whiff 体系）
  const fumbleP = (u.inPool ? P.whiffIn : P.whiffOut) * A.fumbleMult * (1 - (u.mentality || 0) * M.eventSwing * 0.5);
  const fumble = round.rng() < fumbleP;
  const power = (fumble ? A.fumblePower : 1) * (sk.def.params.power || 1);
  const arch = sk.def.archetype;
  round.stats[u.side === 'atk' ? 'utilsAtk' : 'utilsDef']++;
  if (arch in round.stats.utilsByType) round.stats.utilsByType[arch]++;
  round.stats.abilityByArchetype[arch] = (round.stats.abilityByArchetype[arch] || 0) + 1;
  round.emit('ability', {
    side: u.side, unit: u.name, agent: u.agent, skill: sk.def.name, key: sk.def.key,
    archetype: arch, node: u.node, post: u.post || null, ult, fumble, ...extra
  });
  return { power, fumble, skill: sk };
}

// 触发点施放：有技能优先用技能（SEN 时机判定），无技能回退通用道具（原 thinkUse 路径）
// force=true 跳过时机判定（预置/已由 brain 决策过的场合）；调用方负责用 power 缩放效果
function triggerCast(round, u, archetype, extra = {}, force = false) {
  const sk = findSkill(u, archetype);
  if (sk) {
    if (!force && !thinkCast(round, u)) return null;
    const r = cast(round, u, sk, extra);
    return r ? { power: r.power, via: 'skill', skill: sk } : null;
  }
  if (!u.utils || u.utils <= 0) return null;
  if (!force && !round.thinkUse(u)) return null;
  u.utils--;
  round.stats[u.side === 'atk' ? 'utilsAtk' : 'utilsDef']++;
  if (archetype in round.stats.utilsByType) round.stats.utilsByType[archetype]++;
  return { power: 1, via: 'generic' };
}

// ---- 枪线封锁 ----
function blockSight(round, a, b, ticks) {
  round.smokedSight[round.map.postKey(a, b)] = round.t + ticks;
}

// 封锁指向某节点的枪线：取暴露度最低（最致命）的 n 条
function smokeSightlinesInto(round, node, ticks, n) {
  const lines = [];
  for (const [a, b, exposure] of round.map.data.sightlines || []) {
    const pa = round.map.posts[a], pb = round.map.posts[b];
    if (!pa || !pb) continue;
    if (pa.node === node || pb.node === node) lines.push([a, b, exposure]);
  }
  lines.sort((x, y) => x[2] - y[2]);
  for (const [a, b] of lines.slice(0, n)) blockSight(round, a, b, ticks);
}

// 区域幕墙（蝰蛇毒幕/星礈大招）：封锁所有一端在 region 内、一端在外的枪线
function wallRegion(round, region, ticks) {
  for (const [a, b] of round.map.data.sightlines || []) {
    const pa = round.map.posts[a], pb = round.map.posts[b];
    if (!pa || !pb) continue;
    const ra = round.map.region(pa.node), rb = round.map.region(pb.node);
    if ((ra === region) !== (rb === region)) blockSight(round, a, b, ticks);
  }
}

// ---- 反应式触发点 ----
// 进攻落点封烟：阻断回防路线；技能烟额外封锁指向包点的守方枪线（炼狱三连烟封 3 条）
function onCommitSmoke(round, u) {
  const r = triggerCast(round, u, 'smoke', { site: round.committedSite });
  if (!r) return false;
  const staging = round.map.data.staging[round.committedSite];
  round.smokedEdges[round.edgeKey(staging, u.node)] = round.t + U.smokeTicks;
  if (r.skill) {
    const P = r.skill.def.params;
    const multi = P.multi || 1;
    smokeSightlinesInto(round, u.node, Math.round((P.ticks || A.smokeSightTicks) * r.power), multi);
  }
  round.emit('smoke', { node: u.node, edge: [staging, u.node], by: u.name, until: round.t + U.smokeTicks });
  return true;
}

// 进点闪光（含大招闪）：返回致盲强度；隔墙闪招牌（铁臂/斯凯）让点内敌人额外震荡滞留
function onEntryFlash(round, entrant) {
  // 每方每 6 tick 最多一颗闪（技能充能脱离了经济约束，防止回防闪连发）
  if (round.t - (round.lastFlashTick[entrant.side] || -99) <= 6) return 0;
  const candidates = [];
  for (const u of round.occ[entrant.node]) {
    if (u.alive && u.side === entrant.side && !u.flashUsedRound && (u.utils > 0 || findSkill(u, 'flash'))) candidates.push(u);
  }
  candidates.sort((a, b) => b.syn - a.syn); // 道具效率高的先想
  for (const c of candidates) {
    const r = triggerCast(round, c, 'flash', { node: entrant.node });
    if (!r) continue;
    c.flashUsedRound = true;
    const flash = U.flashReduce * round.synFactor(c.syn) * r.power;
    round.lastFlashTick[entrant.side] = round.t;
    round.emit('flash', { node: entrant.node, side: entrant.side, by: c.name });
    if (r.skill && r.skill.def.params.throughWall) {
      // 隔墙闪招牌（铁臂/斯凯）：点内敌人短暂失衡（1 tick，避免回防团战一边倒）
      for (const e of round.enemiesAt(entrant.node, entrant.side)) {
        e.stun = Math.max(e.stun, 1);
      }
    }
    return flash;
  }
  return 0;
}

// 拆包掩护烟：同区队友用 smoke 封锁指向拆包点的枪线
function onDefuseSmoke(round, defuser) {
  const R = round.map.region(defuser.node);
  const mates = round.def.filter((d) => d.alive && round.map.region(d.node) === R);
  for (const m of mates) {
    const sk = findSkill(m, 'smoke');
    if (!sk || !thinkCast(round, m)) continue;
    const r = cast(round, m, sk, { cover: defuser.name });
    if (!r) continue;
    smokeSightlinesInto(round, defuser.node, cfg.round.defuseTicks + 3, 2); // 封最致命的 2 条
    return;
  }
}

// 阵亡处理：不死鸟/暮蝶自我复活（大招），贤者复活队友（大招，SEN 时机判定）
function onDeath(round, victim) {
  const selfUlt = victim.skills && victim.skills.x;
  if (selfUlt && selfUlt.left > 0 && selfUlt.def.archetype === 'ult_revive' && selfUlt.def.params.self) {
    const r = cast(round, victim, selfUlt, { self: true });
    if (r) round.reviveQueue.push({ unit: victim, node: victim.node, at: round.t + (selfUlt.def.params.delay || A.reviveDelay), skillName: selfUlt.def.name, agent: victim.agent });
    return;
  }
  for (const u of round.units) {
    if (!u.alive || u.side !== victim.side || u === victim) continue;
    const sk = u.skills && u.skills.x;
    if (!sk || sk.left <= 0 || sk.def.archetype !== 'ult_revive' || sk.def.params.self) continue;
    if (!thinkCast(round, u)) return; // 没想到用就浪费掉时机
    const r = cast(round, u, sk, { target: victim.name });
    if (r) round.reviveQueue.push({ unit: victim, node: victim.node, at: round.t + (sk.def.params.delay || A.reviveDelay), skillName: sk.def.name, agent: u.agent });
    return;
  }
}

// 奇乐炮台：部署在本人对枪点，自动警戒 sightline 覆盖的区域
function deployTurret(round, u, sk, power) {
  const post = u.post || round.map.postsAt(u.node)[0] || null;
  round.turrets.push({ owner: u, node: u.node, post, power, seen: new Set() });
}

// ---- 每 tick 被动：复活队列 + 炮台扫视 ----
function tick(round) {
  for (let i = round.reviveQueue.length - 1; i >= 0; i--) {
    const rv = round.reviveQueue[i];
    if (round.t < rv.at || round.result) continue;
    round.reviveQueue.splice(i, 1);
    const v = rv.unit;
    if (v.alive) continue;
    v.alive = true;
    v.stun = A.reviveStun;
    v.holdTicks = 0;
    v.node = rv.node;
    v.post = null;
    round.occ[rv.node].add(v);
    round.emit('ability', { side: v.side, unit: v.name, agent: rv.agent, skill: rv.skillName, key: 'x', archetype: 'revive', node: rv.node, ult: true, done: true });
  }
  // 炮台：每 2 tick 对可见敌人做一次低伤害判定；首次发现给信息
  if (round.t % 2) return;
  for (const t of round.turrets) {
    if (!t.owner.alive) continue;
    for (const e of round.units) {
      if (!e.alive || e.side === t.owner.side) continue;
      const visible = e.node === t.node
        || (t.post && e.post && round.map.canSee(t.post, e.post) && !round.sightBlocked(t.post, e.post));
      if (!visible) continue;
      if (!t.seen.has(e)) {
        t.seen.add(e);
        round.addInfo(round.map.region(e.node), A.turretInfo);
        round.emit('ability', { side: t.owner.side, unit: t.owner.name, agent: t.owner.agent, skill: '哨戒炮台', key: 'c', archetype: 'turret', node: e.node, spot: e.name });
      }
      if (round.rng() < A.turretKillP * t.power) round.applyKill(t.owner, e);
    }
  }
}

// ---- brain 主动技能候选 ----
function scoreSkill(round, u, sk) {
  const P = sk.def.params, arch = sk.def.archetype, t = round.t;
  switch (arch) {
    case 'turret': // 奇乐炮台：到防位即部署
      if (u.side !== 'def' || u.node !== u.homeNode) return null;
      if (round.turrets.some((x) => x.owner === u)) return null;
      return { prior: 3 };
    case 'heal': { // 贤者/斯凯：净化同节点被滞留的队友（缠斗后补状态）
      const hurt = [...round.occ[u.node]].some((x) => x.alive && x.side === u.side && x.stun > 0);
      if (hurt) return { prior: 3 };
      return null;
    }
    case 'wall': case 'ult_wall': { // 幕墙/冰墙：防守感知本区来袭时封锁；进攻落点后封守方枪线
      if (u.side === 'def' && !round.planted) {
        const info = round.defInfo[round.map.region(u.node)];
        if (!info || info.strength < cfg.ai.rotateNeedInfo) return null;
        return { prior: arch === 'ult_wall' ? 3.0 : 2.2 };
      }
      if (u.side === 'atk' && round.committedSite && round.map.region(u.node) === round.committedSite && !P.edge) {
        return { prior: 2.2 };
      }
      return null;
    }
    case 'stun': case 'ult_stun': { // 震荡：同节点有敌时（先手的震慑工具，分值压低避免团战一边倒）
      if (round.enemiesAt(u.node, u.side).length === 0) return null;
      return { prior: arch === 'ult_stun' ? 2.6 : 1.8 };
    }
    case 'molly': case 'ult_molly': { // 进攻守包：守方集结完毕反扑瞬间燃烧封锁包点（拦回防+封拆包）
      if (u.side === 'atk' && round.planted && round.map.region(u.node) === round.plantSite
        && round.flags.retakeHit
        && !(round.mollyZone && round.t < round.mollyZone.until)) return { prior: arch === 'ult_molly' ? 3.4 : 3.0 };
      return null;
    }
    case 'decoy': { // 假身：埋伏期制造可疑动静拉扯防守
      if (u.side !== 'atk' || round.planted || round.committedSite) return null;
      if (round.map.region(u.node) === 'spawn') return null;
      return { prior: 1.2 };
    }
    case 'dash': case 'ult_dash': { // 位移进点：进攻方总攻启动时（防守回防不提供——实战价值偏向进点方）
      if (u.side !== 'atk') return null;
      const commit = t >= round.atkIntent.pace.commitTick || round.forceCommitted || !!round.committedSite;
      if (!commit) return null;
      return { prior: arch === 'ult_dash' ? 2.4 : 1.8 };
    }
    case 'aimbuff': case 'ult_aimbuff': { // 自增益：交战中或刚对完枪
      if (round.enemiesAt(u.node, u.side).length > 0 || u.peeking >= t - 3) return { prior: arch === 'ult_aimbuff' ? 2.2 : 1.6 };
      return null;
    }
    case 'recon': { // 进攻侦察：展开前揭示守军分布（防守侦察走 doRecon 通道）
      if (u.side !== 'atk' || round.planted || round.flags.atkRecon) return null;
      if (t < 6 || t > round.atkIntent.pace.commitTick + 6) return null;
      return { prior: 2.0 };
    }
    case 'ult_recon': { // 侦察大招：双方可用——进攻揭示守军，防守无信息时全盘扫描
      if (u.side === 'atk') {
        if (round.planted || round.flags.atkRecon) return null;
        if (t < 6 || t > round.atkIntent.pace.commitTick + 6) return null;
        return { prior: 2.2 };
      }
      const maxInfo = Math.max(round.defInfo.A.strength, round.defInfo.B.strength);
      if (round.planted || maxInfo >= cfg.ai.rotateNeedInfo || t < U.reconTick) return null;
      return { prior: 2.2 };
    }
    default: return null; // smoke/flash/trap/revive 走反应式触发
  }
}

function candidates(round, u) {
  const out = [];
  for (const sk of readySkills(u)) {
    const c = scoreSkill(round, u, sk);
    if (c) out.push({ action: 'useAbility', skill: sk, prior: c.prior });
  }
  return out;
}

// ---- 主动技能执行 ----
function exec(round, u, sk) {
  const P = sk.def.params, arch = sk.def.archetype, t = round.t;
  const r = cast(round, u, sk, {});
  if (!r) return;
  const power = r.power * round.synFactor(u.syn); // 效果效率挂 SYN
  switch (arch) {
    case 'turret':
      deployTurret(round, u, sk, power);
      break;
    case 'heal': {
      const mates = [...round.occ[u.node]].filter((x) => x.alive && x.side === u.side);
      const targets = P.multi ? mates : [mates.find((x) => x.stun > 0) || u];
      for (const m of targets) {
        m.stun = 0;
        m.mentality = Math.max(-1, Math.min(1, (m.mentality || 0) + (P.mentality || A.healMentality) * power));
        m.healUntil = t + (P.ticks || A.healTicks);
      }
      break;
    }
    case 'wall': case 'ult_wall': {
      const ticks = Math.round((P.ticks || 12) * power);
      const R = u.side === 'atk' ? round.committedSite : round.map.region(u.node);
      if (P.region) {
        wallRegion(round, R, ticks); // 蝰蛇毒幕：封一片跨界枪线
      } else {
        // 冰墙类：封锁本区入口边（穿越大幅减速）
        const staging = round.map.data.staging[R];
        const siteNode = round.map.siteNode(R);
        if (staging && siteNode) round.walledEdges[round.edgeKey(staging, siteNode)] = t + ticks;
      }
      break;
    }
    case 'stun': case 'ult_stun': {
      const ticks = P.ticks || A.stunTicks;
      for (const e of round.enemiesAt(u.node, u.side)) e.stun = Math.max(e.stun, ticks);
      if (P.throughWall) { // 铁臂招牌：隔墙震荡波及相邻节点
        for (const { to } of round.map.adj[u.node]) {
          for (const e of round.enemiesAt(to, u.side)) e.stun = Math.max(e.stun, ticks);
        }
      }
      break;
    }
    case 'molly': case 'ult_molly': // 守包燃烧：封锁包点，拖延拆包
      round.mollyZone = { node: round.map.siteNode(round.plantSite), until: t + Math.round((P.zoneTicks || U.mollyZoneTicks) * power), deny: true };
      break;
    case 'decoy': {
      const R = round.map.region(u.node);
      round.addInfo(R, (P.info || A.decoyInfo) * power, true); // 可疑信息，防守方可识破
      u.loudUntil = t + 5;
      break;
    }
    case 'dash': case 'ult_dash': // 位移进点：抹平移动惩罚 + 闪避抢先枪
      u.dashUntil = t + (P.ticks || 3);
      u.dashDodge = P.dodge || 0.2;
      break;
    case 'aimbuff': case 'ult_aimbuff':
      u.aimbuffUntil = t + (P.ticks || A.aimbuffTicks);
      u.aimbuffMult = P.mult || A.aimbuffMult;
      break;
    case 'recon': case 'ult_recon': {
      if (u.side === 'atk') {
        // 揭示守军两点分布，全队改打薄弱点（brain.pickTargetSite 消费）
        const count = { A: 0, B: 0 };
        for (const d of round.def) {
          if (!d.alive) continue;
          const R = round.map.region(d.node);
          if (R === 'A' || R === 'B') count[R]++;
        }
        round.flags.atkRecon = count;
      } else {
        // 防守侦察大招：全盘扫描（deep 无视隐蔽），真实信息
        const count = { A: 0, B: 0, mid: 0 };
        for (const a of round.atk) {
          if (!a.alive) continue;
          count[round.map.region(a.node)] = (count[round.map.region(a.node)] || 0) + 1;
        }
        let region = 'A';
        if (count.B > count.A) region = 'B';
        else if (count.B === count.A && round.rng() < 0.5) region = 'B';
        round.addInfo(region, Math.round(U.reconInfo * power), null);
      }
      break;
    }
  }
}

module.exports = { mount, readySkills, findSkill, cast, triggerCast, thinkCast, onCommitSmoke, onEntryFlash, onDefuseSmoke, onDeath, tick, candidates, exec, smokeSightlinesInto, wallRegion };
