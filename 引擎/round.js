// 回合推演核心：tick 时钟 + 节点图机动 + 信息暴露 + 交火结算 + 效用 AI
// 模块拆分（Phase2-A 纯代码移动）：movement.js 机动 / combat.js 交火 / perception.js 信息感知
const cfg = require('./config');
const { buildPlaybook } = require('./playbooks');

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

// 混入拆出的模块（movement 机动 / combat 交火 / perception 信息感知）
Object.assign(RoundSim.prototype,
  require('./movement'),
  require('./combat'),
  require('./perception')
);

module.exports = { RoundSim, decisionQuality };
