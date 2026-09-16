// 个体效用 AI（Phase2-B 核心）：每个选手是独立的效用 AI 个体
// 战术意图（tactics.js）只是先验；选手靠自己的 AIM/SEN/SYN + 战场感知做决策，执行有偏差
// 打分 = 战术意图先验 × (0.5 + 决策质量) + 态势项 + 个性项 + 执行偏差噪声（SEN 越低噪声越大）
const cfg = require('./config');
const abilities = require('./abilities');

const B = cfg.brain;

// 决策质量：SEN -> 选中效用最优项的概率
function decisionQuality(sen) {
  return cfg.ai.senBase + cfg.ai.senRange * (sen - 30) / 66;
}

// 沿角色路线取下一节点；limit 为 commit 前允许推进到的路线进度
// 进度按单位记忆（u.routeProg）：处于路线节点之间的中转跳点上时继续向前，不会回头
function routeNext(u, route, limit) {
  if (!route || !route.length) return null;
  const lim = Math.min(limit, route.length - 1);
  const i = route.indexOf(u.node);
  if (i >= 0) u.routeProg = Math.max(u.routeProg || 0, i);
  const prog = u.routeProg || 0;
  if (prog < lim) return route[prog + 1];
  return null;
}

module.exports = {
  decisionQuality,

  // ---- 对枪点（post）----
  releasePost(u) {
    if (u.post && this.postOcc[u.post] === u) delete this.postOcc[u.post];
    u.post = null;
  },

  // 该对枪点跨节点可用的枪线数量（缓存）
  sightCount(pid) {
    if (!this._sightN) {
      this._sightN = {};
      for (const key of Object.keys(this.map.sight)) {
        const [a, b] = key.split('|');
        this._sightN[a] = (this._sightN[a] || 0) + 1;
        this._sightN[b] = (this._sightN[b] || 0) + 1;
      }
    }
    return this._sightN[pid] || 0;
  },

  // 选位：掩体质量 × postCoverW ± 枪线数 × postSightW；决策质量决定选中最优槽的概率
  // defer=true 时只预订槽位不落到单位身上（移动中 post 保持 null）
  // hide=true 时回避枪线（埋伏期：宁选无视线角落也不暴露在敌方枪线下）
  pickPost(u, node, defer, hide) {
    const free = this.map.postsAt(node).filter((p) => !this.postOcc[p] || this.postOcc[p] === u);
    if (!free.length) return null;
    const sightSign = hide ? -1 : 1;
    let best = null, bestS = -1e9, bestCov = -1;
    for (const pid of free) {
      const p = this.map.posts[pid];
      const s = p.cover * B.postCoverW + sightSign * this.sightCount(pid) * B.postSightW;
      // 平分取掩体更高者（掩体主导，枪线只做 tiebreak）
      if (s > bestS + 1e-6 || (Math.abs(s - bestS) <= 1e-6 && p.cover > bestCov)) {
        bestS = s; best = pid; bestCov = p.cover;
      }
    }
    const q = B.postPickBase + B.postPickRange * (u.sen - 30) / 66;
    let pick = best;
    if (this.rng() >= q) pick = free[Math.floor(this.rng() * free.length)]; // 低 SEN 乱站位
    if (u.post && this.postOcc[u.post] === u) delete this.postOcc[u.post];
    this.postOcc[pick] = u;
    if (!defer) u.post = pick;
    this.emit('post_pick', { unit: u.name, node, post: pick, quality: +bestS.toFixed(2), hide: !!hide });
    return pick;
  },

  // 是否有可交火的敌人（同节点或跨节点枪线互见）
  hasVisibleEnemy(u) {
    for (const e of this.units) {
      if (!e.alive || e.side === u.side || e.moving) continue;
      if (e.node === u.node) return true;
      if (u.post && e.post && this.map.canSee(u.post, e.post) && !this.sightBlocked(u.post, e.post)) return true;
    }
    return false;
  },

  // 按意图点位倾向选目标点（每单位缓存，mid 读取后重置；进攻侦察揭示后改打薄弱点）
  pickTargetSite(u, intent) {
    if (!u.targetSite) {
      const kr = this.flags.atkRecon;
      if (kr) {
        const weaker = kr.A <= kr.B ? 'A' : 'B';
        u.targetSite = this.rng() < cfg.abilities.atkReconReadP ? weaker : (weaker === 'A' ? 'B' : 'A');
      } else {
        const w = intent.siteWeights;
        u.targetSite = this.rng() * (w.A + w.B) < w.A ? 'A' : 'B';
      }
    }
    return u.targetSite;
  },

  // 时间压力：越过安全线后推进/下包持续加分
  timePressure() {
    const over = this.t - (cfg.round.maxTicks - cfg.round.timePressure);
    return over > 0 ? 3 + over * B.timePushW : 0;
  },

  // ---- 主决策 ----
  think(u, force) {
    if (!u.alive || u.moving || u.planting || u.defusing) return;
    if (u.stun > 0) return;
    if (!force && ((this.t + u.sideIdx + (u.side === 'def' ? 1 : 0)) % B.thinkInterval) !== 0) return;
    let cands = u.side === 'atk' ? this.atkCandidates(u) : this.defCandidates(u);
    if (!u.saved) cands = cands.concat(abilities.candidates(this, u)); // 英雄技能候选
    if (!cands.length) return;
    for (const fn of this.hooks.beforeDecision) cands = fn({ unit: u, round: this }, cands) || cands;
    const dq = decisionQuality(u.sen);
    // IGL 存活时队友的战术意图先验增强（指挥让行动更贴合计划；强度按 IGL 本人 SEN 缩放）
    const igl = this.iglUnit(u.side);
    const iglBoost = (!u.isIGL && igl) ? 1 + cfg.igl.priorBoost * (igl.sen / 60) : 1;
    let best = null, bestScore = -1e9;
    for (const c of cands) {
      const s = c.prior * iglBoost * (0.5 + dq) + (c.situ || 0) + (c.pers || 0)
        + (this.rng() * 2 - 1) * (100 - u.sen) * B.noiseCoef;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    this.execAction(u, best);
  },

  // ---- 进攻方候选动作 ----
  atkCandidates(u) {
    const intent = this.atkIntent;
    const t = this.t;
    const out = [];
    if (u.saved) { out.push({ action: 'hold', prior: 5 }); return out; }
    // 爆能器掉落：被指派的捡拾者压倒一切（即使在交火中也要去捡）
    if (u.assignedPickup && this.spike.node && !this.spike.carrier) {
      out.push({ action: 'pickup', prior: 50 });
      return out;
    }
    if (this.spike.node && !this.spike.carrier && u.node === this.spike.node) {
      out.push({ action: 'pickup', prior: 30 });
    }
    if (this.enemiesAt(u.node, u.side).length > 0) {
      // 遭遇战：架枪或对枪（高 AIM 炮台倾向主动 peek）
      out.push({ action: 'hold', prior: 1.5 });
      out.push({ action: 'peek', prior: 1.2, pers: (u.aim - 70) * B.peekAimW });
      return out;
    }
    // fake 族佯攻组：制造动静拉扯，随后长途转点汇合真打
    const fo = intent.fakeout;
    if (fo && u.role === 'decoy') {
      if (!u.fakeDone && t >= fo.fakeTick && this.map.region(u.node) === fo.fakeRegion) {
        out.push({ action: 'fakeNoise', prior: 100 });
        return out;
      }
      const realNode = this.map.siteNode(fo.realRegion);
      if (u.fakeDone && t >= fo.hitTick + 8 && u.node !== realNode) {
        out.push({ action: 'rotate', prior: 50, node: realNode });
        return out;
      }
    }
    // 已下包：守包——点内向位置架枪，点外落位收拢（绕后者顺势断回防路线）
    if (this.planted) {
      const siteNode = this.map.siteNode(this.plantSite);
      if (this.map.region(u.node) === this.plantSite) {
        out.push({ action: 'hold', prior: 3 });
      } else {
        out.push({ action: 'push', prior: 3.2, node: siteNode, mode: 'run', pers: (u.syn - 70) * B.followSynW });
        out.push({ action: 'hold', prior: 1.2 });
      }
      if (this.hasVisibleEnemy(u)) out.push({ action: 'peek', prior: 1.5, pers: (u.aim - 70) * B.peekAimW });
      return out;
    }
    const commit = t >= intent.pace.commitTick || this.forceCommitted || !!this.committedSite;
    const site = this.committedSite || this.pickTargetSite(u, intent);
    const siteNode = this.map.siteNode(site);
    const press = this.timePressure();
    // 推进决心：已迈出推进步伐的单位不为噪声所动摇（执行有偏差 ≠ 抽风式摇摆）
    const cBoost = u.committed ? 2.0 : 0;
    // 下包者：直奔包点下包
    if (u.isCarrier && commit) {
      if (u.node === siteNode) out.push({ action: 'plant', prior: 4, situ: press });
      else out.push({ action: 'push', prior: 3 + cBoost, node: siteNode, mode: 'run', situ: press });
    }
    // 沿角色路线推进（commit 前静音慢摸且只到入口，commit 后跑步放开全程）
    const route = intent.routes[u.role] || [];
    const limit = commit ? route.length - 1 : (intent.limitIdx[u.role] || 0);
    const nextNode = routeNext(u, route, limit);
    if (nextNode) {
      out.push({
        action: 'push', prior: B.priorBase + (commit ? 1.5 : 0) + cBoost, node: nextNode,
        mode: commit ? 'run' : 'walk', situ: press,
        pers: (u.syn - 70) * B.followSynW // 高 SYN 更愿意跟上团队节奏
      });
    } else if (commit && !u.isCarrier && u.node !== siteNode) {
      // 路线走完但未到场（转点/驰援）：直接向主攻点靠拢
      out.push({ action: 'push', prior: B.priorBase + 1.0 + cBoost, node: siteNode, mode: 'run', situ: press });
    }
    // 驻守（埋伏期主推；埋伏时避开敌方枪线选位）
    out.push({ action: 'hold', prior: commit ? 0.8 : 2.0, hide: !commit });
    // 主动对枪
    if (this.hasVisibleEnemy(u)) out.push({ action: 'peek', prior: 1.2, pers: (u.aim - 70) * B.peekAimW });
    // 保枪：残局人数劣势且时间无多
    const atkAlive = this.aliveCount('atk'), defAlive = this.aliveCount('def');
    if (t > 60 && atkAlive <= 2 && defAlive >= atkAlive + 2) {
      out.push({ action: 'save', prior: 1, situ: (defAlive - atkAlive) * 2 });
    }
    return out;
  },

  // ---- 防守方候选动作 ----
  defCandidates(u) {
    const intent = this.defIntent;
    const t = this.t;
    const out = [];
    if (u.saved) { out.push({ action: 'hold', prior: 5 }); return out; }
    if (this.enemiesAt(u.node, u.side).length > 0) {
      out.push({ action: 'hold', prior: 1.5 });
      out.push({ action: 'peek', prior: 1.2, pers: (u.aim - 70) * B.peekAimW });
      return out;
    }
    // 已下包：回防 / 拆包 / 保枪
    if (this.planted) {
      const siteNode = this.map.siteNode(this.plantSite);
      const staging = this.map.data.staging[this.plantSite];
      if (u.node === siteNode) {
        u.retaking = true;
        // 拆包 vs 架枪警戒：低 SEN 会犹豫（等队友掩护/多架一会儿再拆）
        // 守包燃烧封锁期间无法开始拆包（火线封住爆能器）
        const denied = this.mollyZone && this.mollyZone.deny && this.mollyZone.node === u.node && this.t < this.mollyZone.until;
        if (!denied && this.enemiesAt(u.node, 'def').length === 0
          && this.rng() < decisionQuality(u.sen) + 0.3) out.push({ action: 'defuse', prior: 10 });
        out.push({ action: 'hold', prior: 7 });
        return out;
      }
      // 保枪判定：回防无望（时间/人数/道具不足）
      const dist = this.bfsDist(u.node, siteNode);
      let teamUtils = 0;
      for (const d of this.def) if (d.alive) teamUtils += d.utils;
      const atkAlive = this.aliveCount('atk'), defAlive = this.aliveCount('def');
      const canRetake = this.spikeLeft > cfg.round.defuseTicks + dist + 2 && defAlive >= atkAlive && teamUtils > 0;
      if (!canRetake && u.node !== this.map.data.spawns.def) {
        out.push({
          action: 'save', prior: 1,
          situ: (atkAlive - defAlive) * 2 + (this.spikeLeft < cfg.round.defuseTicks + dist ? 10 : 0)
        });
      }
      // 回防：集结信号后直接进点，否则先到集结点汇合
      if (this.flags.retakeHit) out.push({ action: 'push', prior: 8, node: siteNode, mode: 'run' });
      else if (u.node === staging) { u.waitRetake = true; out.push({ action: 'hold', prior: 8 }); }
      else out.push({ action: 'retake', prior: 8, node: staging });
      return out;
    }
    // 集结点支援：确认真实交火后进点；虚警消退则归位
    if (u.support && u.node === this.map.data.staging[u.support]) {
      const R = u.support;
      const info = this.defInfo[R];
      if (info.strength >= cfg.ai.contractInfo && !info.suspicious) {
        out.push({ action: 'push', prior: 6, node: this.map.siteNode(R), mode: 'run', event: ['push_in', { site: R }], clearSupport: true });
      } else if (info.strength < cfg.ai.rotateNeedInfo && u.homeNode && this.map.region(u.homeNode) !== R) {
        out.push({ action: 'rotate', prior: 4, node: u.homeNode, event: ['return_home', { from: R }], clearSupport: true });
      } else {
        out.push({ action: 'hold', prior: 5 });
      }
      return out;
    }
    // 信息反应（回防/局部收缩/识破假打）：弱接触信息不拉动阵型，
    // 只有强真实交火、可疑假象（假打博弈）或进攻已展开时才触发
    const react = this.defReactCandidate(u);
    if (react) out.push(react);
    // 前压游荡：roamTick 前顶中路，之后向匪家游猎（已出发的单位不为噪声回头）
    const cBoost = u.committed ? 1.0 : 0;
    if (u.role === 'roam') {
      const route = intent.routes.roam;
      const limit = t >= intent.pace.commitTick ? route.length - 1 : intent.limitIdx.roam;
      const nextNode = routeNext(u, route, limit);
      if (nextNode) out.push({ action: 'push', prior: 3 + cBoost, node: nextNode, mode: 'run' });
      else out.push({ action: 'hold', prior: 2 });
    } else if (u.node !== u.homeNode) {
      out.push({ action: 'push', prior: 3 + cBoost, node: u.homeNode, mode: 'run' });
    } else {
      out.push({ action: 'hold', prior: 2.5 });
    }
    // 侦察道具：无信息时自主扫描（优先 recon 技能；只捕捉近期跑动/交战过的进攻方）
    if ((u.utils > 0 || abilities.findSkill(u, 'recon')) && !u.reconUsed && t >= cfg.utility.reconTick && u.node === u.homeNode) {
      const maxInfo = Math.max(this.defInfo.A.strength, this.defInfo.B.strength);
      if (maxInfo < cfg.ai.rotateNeedInfo) out.push({ action: 'useRecon', prior: 2 });
    }
    if (this.hasVisibleEnemy(u)) out.push({ action: 'peek', prior: 1.2, pers: (u.aim - 70) * B.peekAimW });
    return out;
  },

  // 防守方信息反应候选：强真实信息全面回防，中等/可疑信息局部收缩；可疑信息先挂 SEN 识破判定
  defReactCandidate(u) {
    if (!this.newInfo || u.rotating) return null;
    if (u.role === 'anchor') return null; // 赌点锚兵只在下包后回防
    let target = null, strength = 0;
    for (const r of ['A', 'B']) {
      const info = this.defInfo[r];
      if (info.strength > strength) { strength = info.strength; target = r; }
    }
    if (!target || strength < cfg.ai.rotateNeedInfo) return null;
    if (u.node === this.map.siteNode(target)) return null;
    const info = this.defInfo[target];
    // 触发门槛：进攻已展开 / 强真实交火 / 可疑假象才拉动阵型（零星暴露不回防）
    if (!this.planted && !this.forceCommitted && !info.suspicious && strength < cfg.ai.contractInfo) return null;
    // 假打识破：可疑信息（只有动静没有接触）挂 SEN 判定，识破则不被拉扯
    if (info.suspicious && u.fakeReadTick !== info.tick) {
      u.fakeReadTick = info.tick;
      const iglD = this.iglUnit('def');
      let pRead = cfg.fake.readBase + u.sen * cfg.fake.readSen + (iglD ? cfg.igl.fakeReadBonus * (iglD.sen / 60) : 0);
      if (this.defIntent.family === 'stack') pRead *= 0.6; // 赌点队信息面窄，更难识破假打
      if (this.rng() < pRead) {
        this.stats.fakeReads++;
        this.emit('fake_read', { unit: u.name, region: target });
        return null;
      }
      this.stats.fakePulled++;
      this.emit('fake_pulled', { unit: u.name, region: target });
    }
    return { action: 'react', prior: strength * 0.5, target, strength, suspicious: info.suspicious };
  },

  // ---- 动作执行 ----
  execAction(u, c) {
    u.concealed = c.action === 'hold' && !!c.hide; // 埋伏隐蔽：不进跨节点枪线
    switch (c.action) {
      case 'hold': {
        const posts = this.map.postsAt(u.node);
        if (posts.length) {
          if (!u.post) this.pickPost(u, u.node, false, c.hide);
          else if (c.hide && this.sightCount(u.post) > 0) this.pickPost(u, u.node, false, true); // 埋伏期换掉暴露在枪线下的槽位
        }
        break;
      }
      case 'peek': // 主动对枪：驻守并优先占枪线位（交火由 combat.js 统一结算）
        if (!u.post && this.map.postsAt(u.node).length) this.pickPost(u, u.node);
        u.peeking = this.t;
        break;
      case 'push':
        if (c.clearSupport) u.support = null;
        u.committed = true; // 推进决心：后续思考不被噪声动摇
        if (this.startMove(u, c.node, c.mode || 'run') && c.event) this.emit(c.event[0], { unit: u.name, ...c.event[1] });
        break;
      case 'rotate':
        if (c.clearSupport) u.support = null;
        u.rotating = true;
        if (this.startMove(u, c.node, 'run') && c.event) this.emit(c.event[0], { unit: u.name, ...c.event[1] });
        break;
      case 'react':
        this.reactToInfo(u, c.target, c.strength, c.suspicious);
        break;
      case 'retake':
        u.retaking = true;
        u.waitRetake = true;
        u.rotating = true;
        this.startMove(u, c.node, 'run');
        break;
      case 'save': {
        u.saved = true;
        u.rotating = false;
        const spawn = this.map.data.spawns[u.side];
        if (u.node !== spawn) this.startMove(u, spawn, 'run');
        this.emit('save', { unit: u.name });
        break;
      }
      case 'defuse':
        u.defusing = cfg.round.defuseTicks;
        // 守包燃烧封锁：拆包被迫晚开始
        if (this.mollyZone && this.mollyZone.deny && this.mollyZone.node === u.node && this.t < this.mollyZone.until) {
          u.defusing += cfg.abilities.mollyDenyDelay;
        }
        abilities.onDefuseSmoke(this, u); // 队友封烟掩护拆包（阻断指向包点枪线）
        this.emit('defuse_start', { node: u.node, unit: u.name });
        break;
      case 'useAbility':
        abilities.exec(this, u, c.skill);
        break;
      case 'plant':
        this.doPlant(u);
        break;
      case 'pickup':
        this.doPickup(u);
        break;
      case 'fakeNoise':
        this.doFakeNoise(u);
        break;
      case 'useRecon':
        this.doRecon(u);
        break;
    }
  },

  // 下包（含燃烧拖延：预置燃烧或点内守军自主现场投掷）
  doPlant(u) {
    if (!u.isCarrier || this.planted) return;
    const siteNode = this.map.siteNode(this.committedSite || this.pickTargetSite(u, this.atkIntent));
    if (u.node !== siteNode) { this.startMove(u, siteNode, 'run'); return; }
    if (this.enemiesAt(u.node, 'atk').length > 0) return;
    u.planting = cfg.round.plantTicks;
    if (this.presetMolly[u.node] > 0) {
      this.presetMolly[u.node]--;
      u.planting += cfg.utility.mollyDelay;
      this.emit('molly', { node: u.node, preset: true });
    } else {
      const siteRegion = this.map.region(u.node);
      const candidates = [];
      for (const d of this.def) {
        if (d.alive && (d.utils > 0 || abilities.findSkill(d, 'molly')) && this.map.region(d.node) === siteRegion) candidates.push(d);
      }
      candidates.sort((a, b) => b.syn - a.syn);
      for (const thrower of candidates) {
        const r = abilities.triggerCast(this, thrower, 'molly', { node: u.node, delayPlant: true });
        if (r) {
          // 拖延下包：技能威力不放大拖延时长（时长封顶通用值，只体现 SYN 效率）
          u.planting += Math.round(cfg.utility.mollyDelay * this.synFactor(thrower.syn) * Math.min(r.power, 1));
          this.emit('molly', { node: u.node, by: thrower.name });
          break;
        }
      }
    }
    this.emit('plant_start', { node: u.node, unit: u.name });
  },

  // 拾取爆能器
  doPickup(u) {
    if (!this.spike.node || this.spike.carrier) { u.assignedPickup = false; return; }
    if (u.node === this.spike.node) {
      this.spike.node = null;
      this.spike.carrier = u;
      u.isCarrier = true;
      u.assignedPickup = false;
      this.pickupAssigned = true;
      this.emit('spike_pickup', { node: u.node, unit: u.name });
    } else {
      this.startMove(u, this.spike.node, 'run');
    }
  },

  // 假打制造动静：跑动暴露 + 交道具佯攻，信息标记为可疑（防守方可识破）
  doFakeNoise(u) {
    u.fakeDone = true;
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
  },

  // 防守侦察道具
  // 防守侦察道具：优先消耗 recon 技能（猎枭侦察箭 deep 可捕捉隐蔽目标，信息量更大）
  doRecon(u) {
    if (u.reconUsed) return;
    const sk = abilities.findSkill(u, 'recon') || abilities.findSkill(u, 'ult_recon');
    if (!sk && u.utils <= 0) return;
    u.reconUsed = true;
    const deep = sk && sk.def.params.deep; // 跨节点深侦察：无视隐蔽，捕捉所有存活进攻方
    const count = { A: 0, B: 0, mid: 0 };
    let loud = 0;
    for (const a of this.atk) {
      if (!a.alive) continue;
      if (deep || (a.loudUntil || 0) >= this.t) {
        loud++;
        count[this.map.region(a.node)] = (count[this.map.region(a.node)] || 0) + 1;
      }
    }
    if (loud === 0) {
      this.emit('recon_empty', { unit: u.name }); // 扫描无果，道具保留
      return;
    }
    const power = sk ? (abilities.cast(this, u, sk, { recon: true }) || {}).power : null;
    if (!sk) { u.utils--; this.stats.utilsDef++; this.stats.utilsByType.recon++; }
    let region = 'A';
    if (count.B > count.A) region = 'B';
    else if (count.B === count.A && this.rng() < 0.5) region = 'B';
    this.addInfo(region, Math.round(cfg.utility.reconInfo * (power || 1)), null); // 侦察不辨真伪，保留可疑标记
    this.emit('recon', { unit: u.name, region });
  }
};
