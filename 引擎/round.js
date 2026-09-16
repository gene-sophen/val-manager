// 回合推演编排：tick 时钟 + 队伍级状态机；个体决策在 brain.js（效用 AI）
// 模块：movement.js 机动 / combat.js 交火 / perception.js 信息感知 / brain.js 个体决策 / abilities.js 英雄技能
const cfg = require('./config');
const { aimAt } = require('./tactics');
const brain = require('./brain');
const abilities = require('./abilities');

const { decisionQuality } = brain;

class RoundSim {
  constructor({ map, atkUnits, defUnits, atkFamily, defFamily, atkIntent, defIntent, rng, hooks, logger }) {
    this.map = map;
    this.rng = rng;
    this.hooks = hooks;
    this.log = logger || null;
    this.atkFamily = atkFamily;
    this.defFamily = defFamily;
    // 战术意图（tactics.js 输出，取代指令链剧本）
    this.atkIntent = atkIntent;
    this.defIntent = defIntent;
    this.units = [...atkUnits, ...defUnits];
    this.atk = atkUnits;
    this.def = defUnits;

    // 回合状态
    this.t = 0;
    this.planted = false;
    this.spikeLeft = 0;
    this.plantSite = null;
    this.planter = null;
    this.defuser = null;
    this.committedSite = null;   // 进攻方实际落实的包点
    this.spike = { carrier: null, node: null };
    this.flags = {};
    this.defInfo = { A: { strength: 0, tick: -99, suspicious: false }, B: { strength: 0, tick: -99, suspicious: false }, mid: { strength: 0, tick: -99, suspicious: false } };
    this.newInfo = false;
    this.forceCommitted = false;
    this.pickupAssigned = false;
    this.contracted = { A: false, B: false }; // 局部收缩每方向限一人
    // 道具层状态
    this.traps = {};        // node -> 警戒点数量（哨卫道具）
    this.presetMolly = {};  // node -> 预置燃烧数量（赌点全押）
    this.smokedEdges = {};  // "a|b" -> 失效 tick
    this.atkSmokeUsed = false;
    this.lastFlashTick = { atk: -99, def: -99 };
    this.lastStunTick = { atk: -99, def: -99 }; // 震荡技能每方冷却
    this.defEntryMolly = { A: false, B: false }; // 进点燃烧弹每点限一次
    this.mollyZone = null; // { node, until, deny? }（deny=守包燃烧，拖延拆包）
    // 英雄技能层状态
    this.turrets = [];      // 奇乐炮台 [{ owner, node, post, power, seen }]
    this.reviveQueue = [];  // 复活队列 [{ unit, node, at, skillName, agent }]
    this.smokedSight = {};  // postKey -> 失效 tick（烟/墙封枪线）
    this.walledEdges = {};  // "a|b" -> 失效 tick（冰墙类封锁边，双方穿越减速）
    this.trapPower = {};    // node -> 警戒额外滞留（零绊线等招牌加成）
    this.stats = { popOffs: 0, whiffs: 0, utilsAtk: 0, utilsDef: 0, fakeReads: 0, fakePulled: 0, utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 }, abilityByArchetype: {} };

    // 占位表：node -> Set(unit)；对枪点占用表：postId -> unit
    this.occ = {};
    for (const id of Object.keys(map.nodes)) this.occ[id] = new Set();
    this.postOcc = {};
    for (const u of this.atk) this.resetUnit(u, map.data.spawns.atk, this.atkIntent);
    for (const u of this.def) this.resetUnit(u, map.data.spawns.def, this.defIntent);
    this.spike.carrier = this.atk[this.atkIntent.carrier] || this.atk[0];
    this.spike.carrier.isCarrier = true;
    this.preplaceUtility();
  }

  // 防守道具预置：默认架点预置 1 点警戒；赌点把全部道具押在赌的点；前压不预置
  // 哨卫英雄优先消耗 trap/molly 技能充能（招牌陷阱更疼），其余回退通用道具点
  preplaceUtility() {
    const fam = this.defIntent.family;
    for (const u of this.def) {
      if (!u.utils || u.utils <= 0) continue;
      const home = u.homeNode;
      if (!home) continue;
      let n = 0;
      if (fam === 'hold') n = Math.min(1, u.utils);
      else if (fam === 'stack') n = u.utils; // 道具全押赌点
      if (n <= 0) continue;
      // 分站防守的警戒放在入口通道（提前预警）；赌点全押在包点本身
      const trapNode = fam === 'hold' ? ((this.map.data.trapSpots || {})[home] || home) : home;
      const trapSk = abilities.findSkill(u, 'trap');
      if (trapSk) { // 哨卫技能警戒（零绊线/奇乐警报机器人等）
        abilities.cast(this, u, trapSk, { node: trapNode, preset: true });
        const snare = trapSk.def.params.snare || 0;
        if (snare) this.trapPower[trapNode] = Math.max(this.trapPower[trapNode] || 0, snare);
      } else {
        u.utils--;
        this.stats.utilsDef++;
        this.stats.utilsByType.trap++;
      }
      this.traps[trapNode] = (this.traps[trapNode] || 0) + 1;           // 第一点为警戒
      if (n > 1) {
        const mollySk = abilities.findSkill(u, 'molly');
        if (mollySk && fam === 'stack') abilities.cast(this, u, mollySk, { node: home, preset: true });
        else { u.utils -= n - 1; this.stats.utilsDef += n - 1; this.stats.utilsByType.molly += n - 1; }
        this.presetMolly[home] = (this.presetMolly[home] || 0) + (n - 1); // 其余预置燃烧
      }
    }
  }

  edgeKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  spendUtils(side) { // v2 起道具由选手自主决策，此函数保留给外部钩子调用
    const arr = side === 'atk' ? this.atk : this.def;
    let best = null;
    for (const u of arr) {
      if (u.alive && u.utils > 0 && (!best || u.syn > best.syn)) best = u;
    }
    if (best) {
      best.utils--;
      this.stats[side === 'atk' ? 'utilsAtk' : 'utilsDef']++;
    }
    return best;
  }

  synFactor(syn) {
    return cfg.utility.synBase + cfg.utility.synCoef * syn / 100;
  }

  // IGL 存活才有指挥加成
  iglAlive(side) {
    const arr = side === 'atk' ? this.atk : this.def;
    for (const u of arr) if (u.alive && u.isIGL) return true;
    return false;
  }

  // 道具自主决策：SEN 决定"该用时能不能想到用"，战术道具倾向（utilPosture）调制意愿
  thinkUse(u) {
    const posture = (u.side === 'atk' ? this.atkIntent : this.defIntent).utilPosture;
    return u.utils > 0 && this.rng() < (cfg.ai.utilThinkBase + u.sen * cfg.ai.utilThinkSen) * (0.5 + 0.5 * posture);
  }

  resetUnit(u, spawn, intent) {
    u.node = spawn;
    u.post = null; // 当前对枪点 id（spawn 无 posts 则为节点级抽象位置）
    u.alive = true;
    u.moving = null;
    u.holdTicks = 0;
    u.planting = 0;
    u.defusing = 0;
    u.rotating = false;
    u.saved = false;
    u.retaking = false;
    u.stun = 0;
    u.reconUsed = false;
    u.loudUntil = 0;
    u.fakeReadTick = -99;
    u.flashUsedRound = false;
    u.roundKills = 0;
    u.isCarrier = false;
    // 个体战术状态
    u.role = intent.roles[u.sideIdx];
    u.homeNode = intent.homes[u.sideIdx] || spawn; // 防守=初始防位；进攻=第一阶段集合点
    u.targetSite = null;    // 主攻目标点缓存（按 siteWeights 首次抽取）
    u.assignedPickup = false;
    u.support = null;       // 集结点支援方向
    u.waitRetake = false;   // 在集结点等回防同步信号
    u.fakeDone = false;     // fake 族佯攻组是否已制造动静
    u.peeking = -99;
    u.committed = false;    // 推进决心（brain：已开始推进后不再摇摆）
    u.routeProg = 0;        // 角色路线推进进度
    u.concealed = false;    // 埋伏隐蔽中（brain：不进跨节点枪线）
    // 英雄技能运行时状态（ultSpent 跨回合持久，大招整场一次）
    u.dashUntil = -99; u.dashDodge = 0;
    u.aimbuffUntil = -99; u.aimbuffMult = 1;
    u.healUntil = -99;
    abilities.mount(u);
    this.occ[spawn].add(u);
  }

  emit(type, data) {
    if (this.log) this.log({ t: this.t, type, ...data });
  }

  // 枪线是否被烟/墙阻断
  sightBlocked(postA, postB) {
    return (this.smokedSight[this.map.postKey(postA, postB)] || 0) > this.t;
  }

  // ---- 下包 / 拆包 ----
  updatePlantDefuse() {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.planting > 0) {
        u.planting--;
        if (u.planting === 0) {
          this.planted = true;
          this.spikeLeft = cfg.round.spikeTicks;
          this.plantSite = this.map.region(u.node);
          this.planter = u;
          this.defInfo[this.plantSite].strength = 12;
          this.defInfo[this.plantSite].tick = this.t;
          this.defInfo[this.plantSite].suspicious = false;
          this.newInfo = true;
          this.emit('plant', { node: u.node, unit: u.name, site: this.plantSite, spikeTicks: cfg.round.spikeTicks });
          // 下包后进攻方迅速落位守包阵型（立即进入架枪状态）
          for (const a of this.atk) if (a.alive) a.holdTicks = 2;
        }
      }
      if (u.defusing > 0) {
        if (this.enemiesAt(u.node, 'def').length > 0) {
          u.defusing = 0; // 被打断
          this.emit('defuse_abort', { node: u.node, unit: u.name });
        } else {
          u.defusing--;
          if (u.defusing === 0 && this.planted) {
            this.planted = false;
            this.defuser = u;
            this.emit('defuse', { node: u.node, unit: u.name });
            this.endRound('def', 'defuse');
          }
        }
      }
    }
  }

  // ---- 队伍级状态机（每 tick）：执行信号 / 信息衰退 / 集结同步 / 时间压力 / 捡包指派 ----
  updateTeamState() {
    const intent = this.atkIntent;
    // 中路接触：中控在手时 IGL 读取两点守军分布，选薄弱侧（SEN 决策质量）
    if (intent.family === 'mid' && !this.flags.execute && this.t >= intent.pace.contactTick) {
      this.flags.execute = true;
      const midControlled = this.atk.some((a) => a.alive && this.map.region(a.node) === 'mid');
      if (midControlled) {
        const defAt = { A: 0, B: 0 };
        for (const d of this.def) {
          if (!d.alive) continue;
          const r = this.map.region(d.node);
          if (r === 'A' || r === 'B') defAt[r]++;
        }
        const weaker = defAt.A <= defAt.B ? 'A' : 'B';
        const carrier = this.spike.carrier;
        let q = decisionQuality(carrier ? carrier.sen : 60);
        if (this.iglAlive('atk')) q = Math.min(q + cfg.igl.readBonus, 0.98); // IGL 读取更准
        if (this.rng() < q) {
          aimAt(intent, this.map, weaker); // 读对则打薄弱点
          for (const u of this.atk) { u.targetSite = null; u.routeProg = 0; }
        }
        this.emit('mid_read', { site: intent.site, defAt });
      }
    }

    // 可疑信息（假打）无后续接触会快速衰退：防守方逐渐回过味来
    for (const r of ['A', 'B']) {
      const info = this.defInfo[r];
      if (info.suspicious && info.strength > 0 && this.t - info.tick > 5) {
        info.strength = Math.max(0, info.strength - 0.5);
      }
    }

    // 已下包：守方集结同步（凑齐至少 2 人或爆能器将爆才一起进点）
    if (this.planted && !this.flags.retakeHit) {
      const siteNode = this.map.siteNode(this.plantSite);
      const stagingNode = this.map.data.staging[this.plantSite];
      let gathered = 0, available = 0;
      for (const u of this.def) {
        if (!u.alive || u.saved || u.defusing) continue;
        available++;
        if (!u.moving && (u.node === stagingNode || u.node === siteNode)) gathered++;
      }
      if (available > 0 && (gathered >= Math.min(2, available) || this.spikeLeft <= cfg.round.defuseTicks + 6)) {
        this.flags.retakeHit = true;
        this.emit('retake', { site: this.plantSite, count: gathered });
      }
    }

    // 进攻方：时间压力强行进点（个体推进/下包先验在 brain 内随时间加压）
    if (!this.planted && !this.forceCommitted && this.t >= cfg.round.maxTicks - cfg.round.timePressure) {
      this.forceCommitted = true;
      this.emit('force_commit', { site: this.committedSite || intent.site });
    }

    // 进攻方：爆能器掉落拾取指派（最近的存活进攻方）
    if (!this.planted && !this.spike.carrier && this.spike.node && !this.pickupAssigned) {
      let best = null, bestDist = 1e9;
      for (const u of this.atk) {
        if (!u.alive) continue;
        const d = this.bfsDist(u.node, this.spike.node);
        if (d < bestDist) { bestDist = d; best = u; }
      }
      if (best) {
        this.pickupAssigned = true;
        best.assignedPickup = true;
      }
    }
  }

  // ---- 个体决策：驻守累积 + 每 thinkInterval tick 一次效用决策 ----
  updateBrains() {
    for (const u of this.units) {
      if (!u.alive || u.moving || u.planting || u.defusing) continue;
      u.holdTicks++;
      this.think(u);
    }
    this.newInfo = false;
  }

  bfsDist(from, to) {
    if (from === to) return 0;
    // 借助 nextHop 表计步数
    let cur = from, n = 0;
    while (cur !== to && n < 30) {
      const next = this.map.nextHop[cur][to];
      if (!next) return 30;
      cur = next;
      n++;
    }
    return n;
  }

  endRound(winner, reason) {
    this.result = { winner, reason, ticks: this.t, planted: this.planted || reason === 'explosion' || reason === 'defuse', planter: this.planter, defuser: this.defuser, stats: this.stats };
  }

  run() {
    this.emit('round_start', {
      atkFamily: this.atkFamily, defFamily: this.defFamily,
      // 观赛回放用：初始站位与装备
      units: this.units.map((u) => ({ name: u.name, side: u.side, node: u.node, gun: u.gun, armor: u.armor, utils: u.utils, agent: u.agent, igl: !!u.isIGL }))
    });
    for (const fn of this.hooks.onRoundStart) fn(this);
    while (!this.result) {
      if (this.planted) {
        this.spikeLeft--;
        if (this.spikeLeft <= 0) { this.endRound('atk', 'explosion'); break; }
      } else if (this.t >= cfg.round.maxTicks) {
        this.endRound('def', 'timeout');
        break;
      }
      this.updateMovement();
      this.resolveCombat();
      this.updatePlantDefuse();
      if (this.result) break;
      // 歼灭判定
      const atkAlive = this.aliveCount('atk');
      const defAlive = this.aliveCount('def');
      if (defAlive === 0) { this.endRound('atk', 'elimination'); break; }
      if (atkAlive === 0) {
        // 进攻方全灭：无论是否下包守方都赢（无人守包则守方拆包）
        this.endRound('def', this.planted ? 'defuse' : 'elimination');
        if (this.planted) this.defuser = this.def.find((u) => u.alive) || null;
        break;
      }
      this.updateTeamState();
      abilities.tick(this); // 技能被动：复活队列 + 炮台扫视
      this.updateBrains();
      this.t++;
    }
    this.emit('round_end', { winner: this.result.winner, reason: this.result.reason });
    return this.result;
  }
}

// 混入模块：movement 机动 / combat 交火 / perception 信息感知 / brain 个体效用 AI
Object.assign(RoundSim.prototype,
  require('./movement'),
  require('./combat'),
  require('./perception'),
  brain
);

module.exports = { RoundSim, decisionQuality };
