// 回合推演核心：tick 时钟 + 节点图机动 + 信息暴露 + 交火结算 + 效用 AI
const cfg = require('./config');
const { buildPlaybook } = require('./playbooks');

const C = cfg.combat;

// 决策质量：SEN -> 选中效用最优项的概率
function decisionQuality(sen) {
  return cfg.ai.senBase + cfg.ai.senRange * (sen - 30) / 66;
}

class RoundSim {
  constructor({ map, atkUnits, defUnits, atkFamily, defFamily, rng, hooks, logger }) {
    this.map = map;
    this.rng = rng;
    this.hooks = hooks;
    this.log = logger || null;
    this.atkFamily = atkFamily;
    this.defFamily = defFamily;
    this.units = [...atkUnits, ...defUnits];
    this.atk = atkUnits;
    this.def = defUnits;

    // 剧本
    this.atkPlan = buildPlaybook(map, 'atk', atkFamily, rng);
    this.defPlan = buildPlaybook(map, 'def', defFamily, rng);

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
    this.defEntryMolly = { A: false, B: false }; // 进点燃烧弹每点限一次
    this.mollyZone = null; // { node, until }
    this.stats = { popOffs: 0, whiffs: 0, utilsAtk: 0, utilsDef: 0, fakeReads: 0, fakePulled: 0, utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 } };

    // 占位表：node -> Set(unit)
    this.occ = {};
    for (const id of Object.keys(map.nodes)) this.occ[id] = new Set();
    for (const u of this.atk) this.resetUnit(u, map.data.spawns.atk, this.atkPlan);
    for (const u of this.def) this.resetUnit(u, map.data.spawns.def, this.defPlan);
    this.spike.carrier = this.atk[this.atkPlan.carrier] || this.atk[0];
    this.spike.carrier.isCarrier = true;
    this.preplaceUtility();
  }

  // 防守道具预置：默认架点预置 1 点警戒；赌点把全部道具押在赌的点；前压不预置
  preplaceUtility() {
    const fam = this.defPlan.family;
    for (const u of this.def) {
      if (!u.utils || u.utils <= 0) continue;
      const goD = u.directives.find((d) => d.type === 'go');
      if (!goD) continue;
      let n = 0;
      if (fam === 'hold') n = Math.min(1, u.utils);
      else if (fam === 'stack') n = u.utils; // 道具全押赌点
      if (n <= 0) continue;
      u.utils -= n;
      this.stats.utilsDef += n;
      // 分站防守的警戒放在入口通道（提前预警）；赌点全押在包点本身
      const trapNode = fam === 'hold' ? ((this.map.data.trapSpots || {})[goD.node] || goD.node) : goD.node;
      this.traps[trapNode] = (this.traps[trapNode] || 0) + 1;           // 第一点为警戒
      this.stats.utilsByType.trap++;
      if (n > 1) {
        this.presetMolly[goD.node] = (this.presetMolly[goD.node] || 0) + (n - 1); // 其余预置燃烧
        this.stats.utilsByType.molly += n - 1;
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

  // 道具自主决策：SEN 决定"该用时能不能想到用"
  thinkUse(u) {
    return u.utils > 0 && this.rng() < cfg.ai.utilThinkBase + u.sen * cfg.ai.utilThinkSen;
  }

  // 信息写入：真实信息（暴露/警戒/交战/侦察/下包）会洗掉假打的可疑标记
  addInfo(region, amount, suspicious = false) {
    const info = this.defInfo[region];
    if (!info) return;
    info.strength = Math.min(info.strength + amount, 12);
    info.tick = this.t;
    info.suspicious = suspicious === null ? info.suspicious : suspicious; // 侦察传 null 保留可疑标记
    this.newInfo = true;
  }

  resetUnit(u, spawn, plan) {
    u.node = spawn;
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
    u.directives = plan.directives[u.sideIdx].map((d) => ({ ...d }));
    const homeD = u.directives.find((d) => d.type === 'go');
    u.homeNode = homeD ? homeD.node : spawn; // 初始防位，虚警消退后归位用
    u.di = 0;
    this.occ[spawn].add(u);
  }

  emit(type, data) {
    if (this.log) this.log({ t: this.t, type, ...data });
  }

  aliveCount(side) {
    const arr = side === 'atk' ? this.atk : this.def;
    let n = 0;
    for (const u of arr) if (u.alive) n++;
    return n;
  }

  enemiesAt(node, side) {
    const out = [];
    for (const u of this.occ[node]) if (u.alive && u.side !== side) out.push(u);
    return out;
  }

  isContested(node) {
    let a = false, d = false;
    for (const u of this.occ[node]) {
      if (!u.alive) continue;
      if (u.side === 'atk') a = true; else d = true;
      if (a && d) return true;
    }
    return false;
  }

  // ---- 击杀概率模型 ----
  killP(att, tgt, entry) {
    const node = this.map.nodes[att.node];
    let p = C.baseKill;
    p *= 1 + (att.aim - tgt.aim) * C.aimCoef;
    p *= cfg.gun.mod[att.gun];
    p *= tgt.armor === 'heavy' ? cfg.armor.heavy : (tgt.armor === 'light' ? cfg.armor.light : cfg.armor.none);
    p *= att.holdTicks >= 2 ? C.settledBonus : C.moverPenalty;
    const adv = node.advantage;
    p *= adv === att.side ? C.advBonus : (adv === 'neutral' ? 1 : C.disadvPenalty);
    if (tgt.holdTicks >= 2) p *= 1 - node.cover * C.coverResist;
    if (entry) p *= C.entryBonus;
    if (att.stun > 0) p *= cfg.utility.stunFirePenalty; // 被警戒/燃烧震驻时开火不稳
    for (const fn of this.hooks.beforeKillRoll) p = fn({ att, tgt, node, round: this, entry }, p);
    return Math.min(Math.max(p, 0.01), 0.9);
  }

  tryKill(att, tgt, entry) {
    if (!att.alive || !tgt.alive) return false;
    const p = this.killP(att, tgt, entry);
    if (this.rng() < p) {
      this.applyKill(att, tgt);
      return true;
    }
    return false;
  }

  applyKill(killer, victim) {
    victim.alive = false;
    victim.moving = null;
    victim.planting = 0;
    victim.defusing = 0;
    killer.roundKills++;
    this.occ[victim.node].delete(victim);
    this.emit('kill', { node: victim.node, killer: killer.name, victim: victim.name, side: killer.side });
    for (const fn of this.hooks.onKill) fn({ killer, victim, node: victim.node, round: this });
    // 爆能器掉落
    if (victim.isCarrier) {
      victim.isCarrier = false;
      this.spike.carrier = null;
      this.spike.node = victim.node;
      this.pickupAssigned = false;
      this.emit('spike_drop', { node: victim.node });
    }
    // 补枪（SYN）：受害者同节点队友立即反打一枪
    for (const tm of this.occ[victim.node]) {
      if (!tm.alive || tm.side !== victim.side || tm.planting || tm.defusing) continue;
      if (this.rng() < C.tradeBase * tm.syn / 100) {
        if (this.tryKill(tm, killer, false)) break;
      }
    }
  }

  // ---- 机动 ----
  startMove(u, dest, mode) {
    const next = this.map.nextHop[u.node][dest];
    if (!next || next === u.node) return false;
    const edge = this.map.edgeBetween(u.node, next);
    let ticks = edge.ticks;
    let exposure = edge.exposure;
    if (mode === 'walk') {
      ticks = Math.ceil(ticks * cfg.move.silentTickMult);
      exposure *= cfg.move.silentExposureMult;
    }
    if (u.rotating) {
      ticks = Math.max(1, Math.round(ticks * (1 - u.syn * cfg.move.rotateSynCoef)));
      if (this.iglAlive(u.side)) ticks = Math.max(1, Math.round(ticks * cfg.igl.rotateTicksMult)); // IGL 指挥机动
    }
    if (mode === 'run') u.loudUntil = this.t + 6; // 跑动暴露行踪，可被侦察捕捉
    // 烟雾封锁：防守回防穿越烟雾边减速
    const smokeUntil = this.smokedEdges[this.edgeKey(u.node, next)];
    if (u.side === 'def' && smokeUntil && this.t < smokeUntil) ticks += cfg.utility.smokeRotateDelay;
    this.occ[u.node].delete(u);
    u.moving = { from: u.node, to: next, dest, left: ticks, mode, exposure };
    u.holdTicks = 0;
    this.emit('move', { unit: u.name, side: u.side, from: u.node, to: next, ticks }); // 观赛回放用
    return true;
  }

  updateMovement() {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.stun > 0) { u.stun--; continue; } // 被警戒道具滞留
      if (!u.moving) continue;
      u.moving.left--;
      if (u.moving.left > 0) continue;
      const mv = u.moving;
      u.moving = null;
      u.node = mv.to;
      u.holdTicks = 0;
      this.occ[u.node].add(u);
      // 哨卫警戒：进攻方踩点触发；高 SEN 可识破规避，静音慢摸更谨慎
      if (u.side === 'atk' && this.traps[u.node] > 0) {
        this.traps[u.node]--;
        const region = this.map.region(u.node);
        const avoidP = cfg.utility.trapAvoidBase + u.sen * cfg.utility.trapAvoidSen + (mv.mode === 'walk' ? 0.15 : 0);
        if (this.rng() < avoidP) {
          this.emit('trap_spotted', { node: u.node, unit: u.name });
        } else {
          this.addInfo(region, cfg.utility.trapInfo);
          u.stun = cfg.utility.trapStun;
          this.emit('trap', { node: u.node, unit: u.name, region });
        }
      }
      // 信息暴露：进攻方过点被防守方察觉
      if (u.side === 'atk') {
        const region = this.map.region(u.node);
        if (region !== 'spawn' && this.rng() < mv.exposure) {
          this.addInfo(region, cfg.ai.spotInfo);
          this.emit('spotted', { node: u.node, unit: u.name, region });
        }
        // 进攻方踩进包点 => 进攻方向落实；到位选手自主决定是否封烟掩护（阻断回防路线）
        if ((u.node === 'a_site' || u.node === 'b_site') && !this.committedSite) {
          this.committedSite = this.map.region(u.node);
          if (!this.atkSmokeUsed && this.thinkUse(u)) {
            this.atkSmokeUsed = true;
            u.utils--;
            this.stats.utilsAtk++;
            this.stats.utilsByType.smoke++;
            const staging = this.map.data.staging[this.committedSite];
            this.smokedEdges[this.edgeKey(staging, u.node)] = this.t + cfg.utility.smokeTicks;
            this.emit('smoke', { node: u.node, edge: [staging, u.node], by: u.name, until: this.t + cfg.utility.smokeTicks });
          }
        }
      }
      // 预置燃烧（赌点全押）：进攻踩进该点即激活火线封锁，预置火线持续更久
      if (u.side === 'atk' && this.presetMolly[u.node] > 0 && !(this.mollyZone && this.t < this.mollyZone.until)) {
        this.presetMolly[u.node]--;
        this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks + 2 };
        this.emit('molly_entry', { node: u.node, preset: true });
      }
      // 进点燃烧弹：点内守军自主决定是否封火，后续进点者被火线逼停
      if (u.side === 'atk' && (u.node === 'a_site' || u.node === 'b_site') && this.enemiesAt(u.node, 'atk').length > 0) {
        const region = this.map.region(u.node);
        if (!this.defEntryMolly[region]) {
          const candidates = [];
          for (const d of this.def) {
            if (d.alive && d.utils > 0 && this.map.region(d.node) === region) candidates.push(d);
          }
          candidates.sort((a, b) => b.syn - a.syn);
          for (const thrower of candidates) {
            if (this.thinkUse(thrower)) {
              thrower.utils--;
              this.stats.utilsDef++;
              this.stats.utilsByType.molly++;
              this.defEntryMolly[region] = true;
              this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks };
              this.emit('molly_entry', { node: u.node, by: thrower.name });
              break;
            }
          }
        }
      }
      // 穿越火线：被燃烧弹逼停
      if (u.side === 'atk' && this.mollyZone && this.t < this.mollyZone.until && u.node === this.mollyZone.node) {
        u.stun = Math.max(u.stun, 3);
        this.emit('molly_block', { node: u.node, unit: u.name });
      }
      // 进点遭遇：架点方抢先枪
      this.entryFight(u);
      // 到达后继续推进指令
      if (u.alive) this.advance(u);
    }
  }

  entryFight(entrant) {
    const enemies = this.enemiesAt(entrant.node, entrant.side);
    if (!enemies.length) return;
    // 同步进点：2 tick 内同节点友方人数 >=2 时降低被抢先概率（IGL 提升等效协同）
    let sync = 0, synSum = 0;
    for (const u of this.occ[entrant.node]) {
      if (u.alive && u.side === entrant.side && u.holdTicks <= 2) { sync++; synSum += u.syn; }
    }
    if (sync > 0 && this.iglAlive(entrant.side)) synSum += cfg.igl.syncSynBonus * sync;
    // 闪光道具：进点/回防进包点时，在场同方选手自主决定是否丢闪（SYN 决定效果）
    const isSite = entrant.node === 'a_site' || entrant.node === 'b_site';
    const isAtkHit = entrant.side === 'atk' && isSite;
    const isDefRetake = entrant.side === 'def' && this.planted && isSite;
    let flash = 0;
    if (isAtkHit || isDefRetake) {
      const candidates = [];
      for (const u of this.occ[entrant.node]) {
        if (u.alive && u.side === entrant.side && u.utils > 0 && !u.flashUsedRound) candidates.push(u);
      }
      candidates.sort((a, b) => b.syn - a.syn); // 道具效率高的先想
      for (const c of candidates) {
        if (this.thinkUse(c)) {
          c.utils--;
          c.flashUsedRound = true;
          this.stats[entrant.side === 'atk' ? 'utilsAtk' : 'utilsDef']++;
          this.stats.utilsByType.flash++;
          flash = cfg.utility.flashReduce * this.synFactor(c.syn);
          // 2 tick 内的第二颗闪效果减半
          if (this.t - (this.lastFlashTick[entrant.side] || -99) <= 2) flash *= 0.5;
          this.lastFlashTick[entrant.side] = this.t;
          this.emit('flash', { node: entrant.node, side: entrant.side, by: c.name });
          break;
        }
      }
    }
    for (const holder of enemies) {
      if (!holder.alive || holder.planting || holder.defusing || holder.stun > 0) continue;
      if (holder.holdTicks < 2) continue; // 只有已架好枪的单位才有抢先枪
      let pSpot = C.entryShotBase + holder.sen * C.entryShotSen;
      if (sync >= C.syncMin) pSpot -= (synSum / sync) * C.syncReduce;
      pSpot -= flash; // 被致盲
      if (this.rng() < Math.max(pSpot, 0.05)) {
        this.emit('entry_shot', { node: entrant.node, holder: holder.name, entrant: entrant.name });
        this.tryKill(holder, entrant, true);
        if (!entrant.alive) return;
      }
    }
    if (this.isContested(entrant.node)) {
      const region = this.map.region(entrant.node);
      if (region === 'A' || region === 'B') this.addInfo(region, 5);
    }
  }

  // ---- 每 tick 交火 ----
  resolveCombat() {
    for (const nodeId of Object.keys(this.occ)) {
      if (!this.isContested(nodeId)) continue;
      const fighters = [];
      for (const u of this.occ[nodeId]) {
        if (u.alive && !u.planting && !u.defusing) fighters.push(u);
      }
      // 随机出手顺序
      for (let i = fighters.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [fighters[i], fighters[j]] = [fighters[j], fighters[i]];
      }
      for (const u of fighters) {
        if (!u.alive) continue;
        const enemies = this.enemiesAt(nodeId, u.side);
        if (!enemies.length) break;
        const tgt = enemies[Math.floor(this.rng() * enemies.length)];
        this.tryKill(u, tgt, false);
      }
    }
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
          u.di++; // 进入 postPlant（hold）
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

  // ---- 指令执行与决策 ----
  currentDirective(u) { return u.directives[u.di] || null; }

  advance(u) {
    // 战斗中被钉住、被警戒滞留、或正在下包/拆包时不推进
    if (!u.alive || u.moving || u.planting || u.defusing || u.stun > 0) return;
    if (this.enemiesAt(u.node, u.side).length > 0) return;
    let guard = 0;
    while (guard++ < 8) {
      const d = this.currentDirective(u);
      if (!d) return;
      if (d.type === 'go') {
        if (u.node === d.node) { u.di++; continue; }
        this.startMove(u, d.node, d.mode || 'run');
        return;
      }
      if (d.type === 'waitUntil') {
        if (this.t >= d.tick) { u.di++; continue; }
        return;
      }
      if (d.type === 'waitEvent') {
        if (this.flags[d.event]) { u.di++; continue; }
        return;
      }
      if (d.type === 'plant') {
        if (!u.isCarrier) { u.di++; continue; }
        const siteNode = this.map.siteNode(this.committedSite || this.atkPlan.site);
        if (u.node !== siteNode) {
          this.startMove(u, siteNode, 'run');
          return;
        }
        if (this.enemiesAt(u.node, 'atk').length > 0) return;
        u.planting = cfg.round.plantTicks;
        // 燃烧拖延：预置燃烧或点内守军自主现场投掷，延迟下包
        if (this.presetMolly[u.node] > 0) {
          this.presetMolly[u.node]--;
          u.planting += cfg.utility.mollyDelay;
          this.emit('molly', { node: u.node, preset: true });
        } else {
          const siteRegion = this.map.region(u.node);
          const candidates = [];
          for (const d of this.def) {
            if (d.alive && d.utils > 0 && this.map.region(d.node) === siteRegion) candidates.push(d);
          }
          candidates.sort((a, b) => b.syn - a.syn);
          for (const thrower of candidates) {
            if (this.thinkUse(thrower)) {
              thrower.utils--;
              this.stats.utilsDef++;
              this.stats.utilsByType.molly++;
              u.planting += Math.round(cfg.utility.mollyDelay * this.synFactor(thrower.syn));
              this.emit('molly', { node: u.node, by: thrower.name });
              break;
            }
          }
        }
        this.emit('plant_start', { node: u.node, unit: u.name });
        return;
      }
      if (d.type === 'pickup') {
        // 拾取爆能器（包可能已被他人捡走，容错跳过）
        if (this.spike.node && u.node === this.spike.node) {
          this.spike.node = null;
          this.spike.carrier = u;
          u.isCarrier = true;
          this.pickupAssigned = true;
          this.emit('spike_pickup', { node: u.node, unit: u.name });
        }
        u.di++;
        continue;
      }
      if (d.type === 'fakeNoise') {
        // 假打制造动静：跑动暴露 + 交道具佯攻，信息标记为可疑（防守方可识破）
        u.loudUntil = this.t + 8;
        const region = this.map.region(u.node);
        const iglBoost = this.iglAlive('atk') ? 1 : 0; // IGL 在佯攻更逼真
        this.addInfo(region, cfg.fake.noiseInfo + iglBoost, true);
        this.emit('fake_noise', { node: u.node, unit: u.name, region });
        if (u.utils > 0 && this.rng() < cfg.fake.decoyUtilThink) {
          u.utils--;
          this.stats.utilsAtk++;
          this.addInfo(region, 2, true); // 道具声响让假象更可信
          this.emit('fake_util', { node: u.node, unit: u.name });
        }
        u.di++;
        continue;
      }
      if (d.type === 'branch') {
        // 临场展开：按当前敲定的包点展开后续指令
        const bs = this.atkPlan.site;
        const bS = this.map.siteNode(bs);
        const bShort = bs === 'A' ? 'a_short' : 'market';
        const bMain = bs === 'A' ? 'a_main' : 'b_main';
        const bLobby = bs === 'A' ? 'a_lobby' : 'b_lobby';
        let rest;
        if (d.role === 'midHit') {
          rest = [{ type: 'go', node: bShort, mode: 'run' }, { type: 'go', node: bS, mode: 'run' }, { type: 'plant' }, { type: 'hold' }];
        } else if (d.role === 'fakeHit') {
          u.rotating = true; // 假打转点享受 IGL 机动加成
          rest = [{ type: 'go', node: bS, mode: 'run' }, { type: 'plant' }, { type: 'hold' }];
        } else { // mainHit
          rest = [{ type: 'go', node: bMain, mode: 'run' }, { type: 'go', node: bLobby, mode: 'run' }, { type: 'go', node: bS, mode: 'run' }, { type: 'plant' }, { type: 'hold' }];
        }
        u.directives.splice(u.di, 1, ...rest);
        continue;
      }
      if (d.type === 'hold') return;
      u.di++;
    }
  }

  // 效用二选一：quality 概率选最优，否则选另一个
  decideBinary(u, options) {
    for (const fn of this.hooks.beforeDecision) options = fn({ unit: u, round: this }, options);
    const q = decisionQuality(u.sen);
    const best = options[0].u >= options[1].u ? 0 : 1;
    const pick = this.rng() < q ? best : 1 - best;
    return options[pick].action;
  }

  updateAI() {
    // 剧本执行信号
    if (this.atkPlan.executeTick && this.t >= this.atkPlan.executeTick && !this.flags.execute) {
      this.flags.execute = true;
      // 中路接触：中控在手时 IGL 读取两点守军分布，选薄弱侧（SEN 决策质量）
      if (this.atkPlan.family === 'mid') {
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
          if (this.rng() < q) this.atkPlan.site = weaker; // 读对则打薄弱点
          this.emit('mid_read', { site: this.atkPlan.site, defAt });
        }
      }
    }
    if (this.defPlan.executeTick && this.t >= this.defPlan.executeTick) this.flags.execute = true;

    const atkAlive = this.aliveCount('atk');
    const defAlive = this.aliveCount('def');

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

    // 进攻方：时间压力强行进点（保留捡包链）
    if (!this.planted && !this.forceCommitted && this.t >= cfg.round.maxTicks - cfg.round.timePressure) {
      this.forceCommitted = true;
      const site = this.committedSite || this.atkPlan.site;
      const siteNode = this.map.siteNode(site);
      // 包掉了则由最近的人先捡
      let picker = null;
      if (!this.spike.carrier && this.spike.node) {
        let bestDist = 1e9;
        for (const u of this.atk) {
          if (!u.alive) continue;
          const d = this.bfsDist(u.node, this.spike.node);
          if (d < bestDist) { bestDist = d; picker = u; }
        }
      }
      for (const u of this.atk) {
        if (!u.alive) continue;
        if (u === picker) {
          u.directives = [
            { type: 'go', node: this.spike.node, mode: 'run' },
            { type: 'pickup' },
            { type: 'go', node: siteNode, mode: 'run' },
            { type: 'plant' },
            { type: 'hold' }
          ];
        } else {
          u.directives = u.isCarrier
            ? [{ type: 'go', node: siteNode, mode: 'run' }, { type: 'plant' }, { type: 'hold' }]
            : [{ type: 'go', node: siteNode, mode: 'run' }, { type: 'hold' }];
        }
        u.di = 0;
        if (!u.moving && this.enemiesAt(u.node, 'atk').length === 0) this.advance(u);
      }
      this.emit('force_commit', { site });
    }

    // 进攻方：爆能器掉落拾取
    if (!this.planted && !this.spike.carrier && this.spike.node && !this.pickupAssigned) {
      let best = null, bestDist = 1e9;
      for (const u of this.atk) {
        if (!u.alive) continue;
        const d = this.bfsDist(u.node, this.spike.node);
        if (d < bestDist) { bestDist = d; best = u; }
      }
      if (best) {
        this.pickupAssigned = true;
        const site = this.committedSite || this.atkPlan.site;
        best.directives = [
          { type: 'go', node: this.spike.node, mode: 'run' },
          { type: 'pickup' },
          { type: 'go', node: this.map.siteNode(site), mode: 'run' },
          { type: 'plant' },
          { type: 'hold' }
        ];
        best.di = 0;
      }
    }

    for (const u of this.units) {
      if (!u.alive || u.moving || u.planting || u.defusing) continue;
      u.holdTicks++;

      // 拾取爆能器由 advance() 的 pickup 指令处理

      // 防守方：侦察道具（无信息时自主决定是否扫描；只捕捉近期跑动/交战过的进攻方）
      if (u.side === 'def' && u.utils > 0 && !u.reconUsed && this.t >= cfg.utility.reconTick && !this.planted) {
        const maxInfo = Math.max(this.defInfo.A.strength, this.defInfo.B.strength);
        const cur = this.currentDirective(u);
        if (maxInfo < cfg.ai.rotateNeedInfo && cur && cur.type === 'hold' && this.thinkUse(u)) {
          u.reconUsed = true;
          const count = { A: 0, B: 0, mid: 0 };
          let loud = 0;
          for (const a of this.atk) {
            if (!a.alive) continue;
            if ((a.loudUntil || 0) >= this.t) {
              loud++;
              count[this.map.region(a.node)] = (count[this.map.region(a.node)] || 0) + 1;
            }
          }
          if (loud === 0) {
            this.emit('recon_empty', { unit: u.name }); // 扫描无果，道具保留
          } else {
            u.utils--;
            this.stats.utilsDef++;
            this.stats.utilsByType.recon++;
            let region = 'A';
            if (count.B > count.A) region = 'B';
            else if (count.B === count.A && this.rng() < 0.5) region = 'B';
            this.addInfo(region, cfg.utility.reconInfo, null); // 侦察不辨真伪，保留可疑标记
            this.emit('recon', { unit: u.name, region });
          }
        }
      }

      // 防守方：拆包判定（在已下包包点且点内无敌）
      if (u.side === 'def' && this.planted && u.node === this.map.siteNode(this.plantSite)) {
        if (this.enemiesAt(u.node, 'def').length === 0) {
          const action = this.decideBinary(u, [
            { u: 10, action: 'defuse' },
            { u: 2, action: 'wait' }
          ]);
          if (action === 'defuse') {
            u.defusing = cfg.round.defuseTicks;
            this.emit('defuse_start', { node: u.node, unit: u.name });
            continue;
          }
        }
      }

      // 防守方：回防/局部收缩判定（有新信息时）
      if (u.side === 'def' && this.newInfo && !u.rotating && this.enemiesAt(u.node, 'def').length === 0) {
        const cur = this.currentDirective(u);
        const isHolding = cur && cur.type === 'hold';
        const isWaiting = cur && (cur.type === 'waitUntil' || cur.type === 'waitEvent');
        const isAnchor = cur && cur.type === 'hold' && cur.anchor;
        if (isHolding || isWaiting) {
          let target = null, strength = 0;
          for (const r of ['A', 'B']) {
            const info = this.defInfo[r];
            if (info.strength > strength) { strength = info.strength; target = r; }
          }
          const info = target ? this.defInfo[target] : null;
          const plantedThere = this.planted && this.plantSite === target;
          // 前压/等待中的单位只在信息足够强时才放弃当前位置
          const need = isWaiting ? cfg.ai.rotateNeedInfo + 3 : cfg.ai.rotateNeedInfo;
          const atSite = target && u.node === this.map.siteNode(target);
          if (target && !atSite && (strength >= need || plantedThere) && (!isAnchor || plantedThere)) {
            // 假打识破：可疑信息（只有动静没有接触）挂 SEN 判定，识破则不被拉扯
            if (info.suspicious && !plantedThere && u.fakeReadTick !== info.tick) {
              u.fakeReadTick = info.tick;
              let pRead = cfg.fake.readBase + u.sen * cfg.fake.readSen + (this.iglAlive('def') ? cfg.igl.fakeReadBonus : 0);
              if (this.defPlan.family === 'stack') pRead *= 0.6; // 赌点队信息面窄，更难识破假打
              if (this.rng() < pRead) {
                this.stats.fakeReads++;
                this.emit('fake_read', { unit: u.name, region: target });
              } else {
                this.stats.fakePulled++;
                this.emit('fake_pulled', { unit: u.name, region: target });
                this.reactToInfo(u, target, strength, plantedThere, isWaiting, true);
              }
            } else {
              this.reactToInfo(u, target, strength, plantedThere, isWaiting, info.suspicious);
            }
          }
        }
      }

      // 已下包：未在回防/保枪的守方向集结点收拢
      if (u.side === 'def' && this.planted && !u.saved && !u.retaking && !u.defusing) {
        const siteNode = this.map.siteNode(this.plantSite);
        const stagingNode = this.map.data.staging[this.plantSite];
        if (u.node === siteNode) {
          u.retaking = true;
        } else if (this.enemiesAt(u.node, 'def').length === 0) {
          u.retaking = true;
          u.rotating = true;
          u.directives = [
            { type: 'go', node: stagingNode, mode: 'run' },
            { type: 'waitEvent', event: 'retakeHit' },
            { type: 'go', node: siteNode, mode: 'run' },
            { type: 'hold' }
          ];
          u.di = 0;
        }
      }

      // 集结点支援：确认真实交火（非可疑信息）后从集结点进点；虚警消退则归位
      if (u.side === 'def' && !this.planted && this.enemiesAt(u.node, 'def').length === 0) {
        const cur = this.currentDirective(u);
        if (cur && cur.type === 'hold' && cur.support && u.node === this.map.data.staging[cur.support]) {
          const R = cur.support;
          const info = this.defInfo[R];
          if (info.strength >= cfg.ai.contractInfo && !info.suspicious) {
            u.directives = [{ type: 'go', node: this.map.siteNode(R), mode: 'run' }, { type: 'hold' }];
            u.di = 0;
            this.emit('push_in', { unit: u.name, site: R });
          } else if (info.strength < cfg.ai.rotateNeedInfo && u.homeNode && this.map.region(u.homeNode) !== R) {
            u.directives = [{ type: 'go', node: u.homeNode, mode: 'run' }, { type: 'hold' }];
            u.di = 0;
            u.rotating = false;
            this.emit('return_home', { unit: u.name, from: R });
          }
        }
      }

      // 保枪判定
      if (this.t % cfg.ai.saveEvalInterval === 0) {
        if (u.side === 'def' && this.planted) {
          const siteNode = this.map.siteNode(this.plantSite);
          const dist = this.bfsDist(u.node, siteNode);
          // 道具匮乏时回防无望，也算不可回防（v1：回防难的体现）
          let teamUtils = 0;
          for (const d of this.def) if (d.alive) teamUtils += d.utils;
          const canRetake = this.spikeLeft > cfg.round.defuseTicks + dist + 2 && defAlive >= atkAlive && teamUtils > 0;
          if (!canRetake && u.node !== 'ct_spawn') {
            const action = this.decideBinary(u, [
              { u: (atkAlive - defAlive) * 2 + (this.spikeLeft < cfg.round.defuseTicks + dist ? 10 : 0), action: 'save' },
              { u: 3, action: 'fight' }
            ]);
            if (action === 'save') {
              u.saved = true;
              u.rotating = false;
              u.directives = [{ type: 'go', node: 'ct_spawn', mode: 'run' }, { type: 'hold' }];
              u.di = 0;
              this.emit('save', { unit: u.name });
            }
          }
        }
        if (u.side === 'atk' && !this.planted && this.t > 60 && atkAlive <= 2 && defAlive >= atkAlive + 2) {
          const action = this.decideBinary(u, [
            { u: (defAlive - atkAlive) * 2, action: 'save' },
            { u: 3, action: 'fight' }
          ]);
          if (action === 'save') {
            u.saved = true;
            u.directives = [{ type: 'go', node: 't_spawn', mode: 'run' }, { type: 'hold' }];
            u.di = 0;
            this.emit('save', { unit: u.name });
          }
        }
      }

      this.advance(u);
    }
    this.newInfo = false;
  }

  // 防守方对信息的反应：全面回防（下包/强真实信息）或局部收缩（分站防守对中等信息）
  // 可疑信息（假打）：分站/前压最多局部收缩，赌点队本性赌博会被拉动
  reactToInfo(u, target, strength, plantedThere, isWaiting, suspicious) {
    const action = this.decideBinary(u, [
      { u: strength + (plantedThere ? 50 : 0), action: 'rotate' },
      { u: cfg.ai.rotateNeedInfo + 8, action: 'stay' }
    ]);
    if (action !== 'rotate') return;
    const fullRotate = plantedThere || (!suspicious && strength >= cfg.ai.contractInfo) || this.defPlan.family === 'stack';
    u.rotating = true;
    if (plantedThere) {
      // 已下包：先到集结点汇合，等同步信号再一起回防
      u.directives = [
        { type: 'go', node: this.map.data.staging[target], mode: 'run' },
        { type: 'waitEvent', event: 'retakeHit' },
        { type: 'go', node: this.map.siteNode(target), mode: 'run' },
        { type: 'hold' }
      ];
      this.emit('rotate', { unit: u.name, to: target });
    } else if (fullRotate) {
      // 强信息：回防到受威胁侧集结点待命（确认交火后再进点，避免逐个送进包点）
      u.directives = [{ type: 'go', node: this.map.data.staging[target], mode: 'run' }, { type: 'hold', support: target }];
      this.emit('rotate', { unit: u.name, to: target });
    } else {
      // 局部收缩：只有中路自由人向受威胁侧靠拢（站点锚兵不动，否则被假打拉空）；
      // 每个方向最多收缩一人
      if (this.map.region(u.node) !== 'mid' || this.contracted[target]) { u.rotating = false; return; }
      this.contracted[target] = true;
      u.rotating = false; // 收缩后仍可升级为全面回防
      u.directives = [{ type: 'go', node: this.map.data.staging[target], mode: 'run' }, { type: 'hold', support: target }];
      this.emit('contract', { unit: u.name, to: target });
    }
    u.di = 0;
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
      this.updateAI();
      this.t++;
    }
    this.emit('round_end', { winner: this.result.winner, reason: this.result.reason });
    return this.result;
  }
}

module.exports = { RoundSim, decisionQuality };
