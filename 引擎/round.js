// 回合推演编排：tick 时钟 + 队伍级状态机；个体决策在 brain.js（效用 AI）
// 模块：movement.js 机动 / combat.js 交火 / perception.js 信息感知 / brain.js 个体决策 / abilities.js 英雄技能
const cfg = require('./config');
const { aimAt } = require('./tactics');
const brain = require('./brain');
const abilities = require('./abilities');
const { observedRegionalCounts, recordObservations } = require('./observation');
const { weaponSpec } = require('./actions');

const { decisionQuality } = brain;

class RoundSim {
  constructor({ map, atkUnits, defUnits, atkFamily, defFamily, atkIntent, defIntent, rng, hooks, logger, onRoundEnd, growthEffects, externalContext }) {
    this.map = map;
    this.externalContext=externalContext;
    this.rules = { ...cfg.round, ...map.data.roundRules };
    this.rng = rng;
    this.hooks = hooks;
    // 事件采集：供回合战报（report.js）渲染；onRoundEnd 在 round_end 发出前回调取摘要
    this._roundEvents = logger ? [] : null;
    this.log = logger ? (ev) => { this._roundEvents.push(ev); logger(ev); } : null;
    this.onRoundEnd = onRoundEnd || null;
    this.atkFamily = atkFamily;
    this.defFamily = defFamily;
    // 战术意图（tactics.js 输出，取代指令链剧本）
    this.atkIntent = atkIntent;
    this.defIntent = defIntent;
    this.units = [...atkUnits, ...defUnits];
    this.atk = atkUnits;
    this.def = defUnits;
    this.tradeQueue = [];
    this.growthEffects = growthEffects || { atk: [], def: [] };
    this.growthTriggered = new Set();

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
    this.observations = { atk: {}, def: {} };
    this.pickupAssigned = false;
    if(map.data.spatialVersion===6)this.defInfo=Object.fromEntries([...Object.keys(map.data.sites),'mid'].map(s=>[s,{strength:0,tick:-99,suspicious:false}]));
    this.contracted = Object.fromEntries(Object.keys(map.data.sites).map(s=>[s,false])); // 局部收缩每方向限一人
    // 道具层状态
    this.traps = {};        // node -> 警戒点数量（哨卫道具）
    this.presetMolly = {};  // node -> 预置燃烧数量（赌点全押）
    this.smokedEdges = {};  // "a|b" -> 失效 tick
    this.atkSmokeUsed = false;
    this.lastFlashTick = { atk: -99, def: -99 };
    this.lastStunTick = { atk: -99, def: -99 }; // 震荡技能每方冷却
    this.defEntryMolly = Object.fromEntries(Object.keys(map.data.sites).map(s=>[s,false])); // 进点燃烧弹每点限一次
    this.mollyZone = null; // { node, until, deny? }（deny=守包燃烧，拖延拆包）
    // 英雄技能层状态
    this.turrets = [];      // 奇乐炮台 [{ owner, node, post, power, seen }]
    this.reviveQueue = [];  // 复活队列 [{ unit, node, at, skillName, agent }]
    this.smokedSight = {};  // postKey -> 失效 tick（烟/墙封枪线）
    this.geometrySmokes = []; // 单包点几何烟：位置、半径、失效时间
    this.walledEdges = {};  // "a|b" -> 失效 tick（冰墙类封锁边，双方穿越减速）
    this.trapPower = {};    // node -> 警戒额外滞留（零绊线等招牌加成）
    this.stats = { popOffs: 0, whiffs: 0, utilsAtk: 0, utilsDef: 0, fakeReads: 0, fakePulled: 0, utilsByType: { flash: 0, smoke: 0, molly: 0, recon: 0, trap: 0 }, abilityByArchetype: {} };

    // 占位表：node -> Set(unit)；对枪点占用表：postId -> unit
    this.occ = {};
    for (const id of Object.keys(map.nodes)) this.occ[id] = new Set();
    this.postOcc = {};
    this.initDoors();
    if(require('./behavior-policy').enabled(this))require('./behavior-policy').deploy(this.defIntent,this.def,this.map);
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
      if(require('./behavior-policy').multimapEnabled(this)&&(u.kit||u.agent)&&!abilities.findSkill(u,'trap'))continue;
      const home = u.homeNode;
      if (!home) continue;
      let n = 0;
      if (fam === 'hold' || fam === 'trap') n = Math.min(1, u.utils);
      else if (fam === 'stack') n = u.utils; // 道具全押赌点
      if (n <= 0) continue;
      // 分站防守的警戒放在入口通道（提前预警）；赌点全押在包点本身
      const trapNode = fam === 'hold' || fam === 'trap' ? ((this.map.data.trapSpots || {})[home] || home) : home;
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

  // IGL 存活才有指挥加成；iglUnit 供加成强度按 IGL 本人 SEN/SYN 缩放
  iglUnit(side) {
    const arr = side === 'atk' ? this.atk : this.def;
    for (const u of arr) if (u.alive && u.isIGL) return u;
    return null;
  }

  iglAlive(side) {
    return !!this.iglUnit(side);
  }

  // 道具自主决策：SEN 决定"该用时能不能想到用"，战术道具倾向（utilPosture）调制意愿
  thinkUse(u) {
    const posture = (u.side === 'atk' ? this.atkIntent : this.defIntent).utilPosture;
    return u.utils > 0 && this.rng() < (cfg.ai.utilThinkBase + u.sen * cfg.ai.utilThinkSen) * (0.5 + 0.5 * posture);
  }

  resetUnit(u, spawn, intent) {
    // Buy-phase positioning precedes the live clock. Defenders must not race
    // attackers from spawn to establish their initial defensive formation.
    if (this.map.data.deployment) {
      const home = intent.homes[u.sideIdx] || spawn;
      spawn = this.map.data.deployment[u.side]?.[home] || home;
    }
    u.node = spawn;
    u.position = { x: this.map.nodes[spawn].x, y: this.map.nodes[spawn].y };
    u.lastGroundPosition={...u.position};
    u.post = null; // 当前对枪点 id（spawn 无 posts 则为节点级抽象位置）
    u.alive = true;
    u.hp = 100;
    u.ammo = weaponSpec(u.gun).magazine;
    u.reloadUntil = -1;
    u.lastShotTick = -1;
    u.moving = null;
    if(this.map.data?.dynamicDoors)u.doorAction=null;
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
    u.supportOrder = null;
    u.fallbackUsed=false;u.pressureSince=null;
    u.waitRetake = false;   // 在集结点等回防同步信号
    u.fakeDone = false;     // fake 族佯攻组是否已制造动静
    if(this.map.data?.autonomyModel){u.agentMemory=null;u.agentTarget=null;}
    u.peeking = -99;
    u.committed = false;    // 推进决心（brain：已开始推进后不再摇摆）
    u.routeProg = 0;        // 角色路线推进进度
    if(require('./behavior-policy').enabled(this))u.nextThinkAt=0;
    if(require('./behavior-policy').zonesEnabled(this))u.abilityBusyUntil=0;
    u.concealed = false;    // 埋伏隐蔽中（brain：不进跨节点枪线）
    // 英雄技能运行时状态（ultSpent 跨回合持久，大招整场一次）
    u.dashUntil = -99; u.dashDodge = 0;
    u.aimbuffUntil = -99; u.aimbuffMult = 1;
    u.healUntil = -99;
    abilities.mount(u);
    this.occ[spawn].add(u);
    if(this.map.data?.strictSpatial){u.fireTarget=null;u.fireReadyAt=null;u.targetSeenAt=null;u._movePaused=false;u.angleCheckedAt=-99;this.pickPost(u,spawn);u.holdTicks=u.side==='def'?2:0;}
  }

  emit(type, data) {
    if(this.map.data?.autonomyModel&&type==='shot'){const a=this.units.find(u=>u.id===data.actorId),b=this.units.find(u=>u.id===data.targetId);if(a&&b)data={sourceZ:a.position.z??this.map.geometry.heightAt(a.position),targetZ:b.position.z??this.map.geometry.heightAt(b.position),channel:this.map.engagements?.window(a.position,b.position)||'physical-body-ray',...data};}
    if(type==='ability'&&require('./behavior-policy').nextEnabled(this)){const actor=this.units.find(u=>u.id===data.unitId||u.name===data.unit&&u.side===data.side);if(actor)data={unitId:actor.id,x:actor.position.x,y:actor.position.y,...data};}
    if(this.map.data?.externalEffectsVersion){
      if(type==='ability'&&!data.fumble){const actor=this.units.find(u=>u.name===data.unit&&u.side===data.side);(this.effectAbilities??=[]).push({t:this.t,side:data.side,unitId:actor?.id,position:actor?.position&&{...actor.position}});}
      if(type==='kill')(this.effectKills??=[]).push({t:this.t,...data});
    }
    if (this.log) this.log({ t: this.t, type, ...data });
  }

  hasGrowth(side, id) {
    return (this.growthEffects?.[side] || []).includes(id);
  }

  triggerGrowth(side, id, actor) {
    const key = `${side}:${id}`;
    if (this.growthTriggered.has(key)) return;
    this.growthTriggered.add(key);
    this.emit('growth_trigger', { side, growthId: id, actor: actor || null });
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
        if(require('./behavior-policy').enabled(this)&&this.t<=u.plantStartedAt)continue;
        u.planting=Math.max(0,u.planting-(this.map.data?.tickSeconds||1));
        if (u.planting === 0) {
          this.planted = true;
          this.spikeLeft = (this.rules || cfg.round).spikeTicks;
          this.plantSite = this.map.region(u.node);
          this.planter = u;
          if(this.map.data.dynamicDoors)this.spike.position={...u.position};
          if(this.map.data?.objectiveModel==='defuse-v2'){u.isCarrier=false;this.spike.carrier=null;this.spike.node=u.node;}
          this.defInfo[this.plantSite].strength = 12;
          this.defInfo[this.plantSite].tick = this.t;
          this.defInfo[this.plantSite].suspicious = false;
          this.newInfo = true;
          this.emit('plant', { node: u.node, unit: u.name, site: this.plantSite, spikeTicks: (this.rules || cfg.round).spikeTicks,...(this.map.data.dynamicDoors?{x:u.position.x,y:u.position.y}:{}) });
          if(require('./behavior-policy').multimapEnabled(this))require('./spatial-behavior').onPlant(this);
          // 下包后进攻方迅速落位守包阵型（立即进入架枪状态）
          for (const a of this.atk) if (a.alive) a.holdTicks = 2;
        }
      }
      if (u.defusing > 0) {
        const enhanced=require('./behavior-policy').enabled(this);
        if(enhanced&&this.rules.defuseTicks-u.defusing>=this.rules.defuseTicks/2)this.spike.defuseProgress=this.rules.defuseTicks/2;
        if (enhanced ? (u.hp<u.defuseLastHP||require('./behavior-policy').denied(this,u.position)) : this.map.data?.strictSpatial ? this.visibleEnemiesAt(u).length>0 : this.enemiesAt(u.node, 'def').some(enemy =>
          !u.post || !enemy.post || this.map.canSee(u.post, enemy.post))) {
          u.defusing = 0; // 被打断
          if(this.map.data?.objectiveModel==='defuse-v2'&&this.defuser===u)this.defuser=null;
          this.emit('defuse_abort', { node: u.node, unit: u.name });
        } else {
          if(this.map.data?.objectiveModel==='defuse-v2'&&this.t<=u.defuseStartedAt)continue;
          u.defusing=Math.max(0,u.defusing-(this.map.data?.tickSeconds||1));
          if(enhanced){u.defuseLastHP=u.hp;if(this.rules.defuseTicks-u.defusing>=this.rules.defuseTicks/2&&!this.spike.defuseProgress){this.spike.defuseProgress=this.rules.defuseTicks/2;this.emit('defuse_checkpoint',{unit:u.name,unitId:u.id,seconds:this.spike.defuseProgress});}}
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
    // Public elimination information removes the need to wait for a two-person
    // retake. Re-evaluate saving once; never award a win without travel + defuse.
    if(this.map.data?.objectiveModel==='defuse-v2'&&this.planted&&!this.flags.siteCleared&&this.aliveCount('atk')===0&&!this.reviveQueue.some(rv=>rv.unit.side==='atk')){
      this.flags.siteCleared=true;this.flags.retakeHit=true;
      this.emit('site_cleared',{site:this.plantSite});
      for(const u of this.def){
        if(!u.alive||u.defusing)continue;
        const route=this.map.geometry.route(u.position,this.spike.position,{doors:this.doors});
        const enhanced=require('./behavior-policy').enabled(this),travel=route?route.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-route[i].x,p.y-route[i].y),0)/(enhanced?this.map.data.navigationSpeed.run:32):Infinity;
        if(this.spikeLeft<=this.rules.defuseTicks-(enhanced?this.spike.defuseProgress||0:0)+travel+.25)continue;
        if(u.saved){u.saved=false;this.emit('save_cancel',{unit:u.name,unitId:u.id,site:this.plantSite});}
        if(u.moving)this.interruptMove(u,'return-to-spike');
        this.think(u,true);
      }
    }
    // 中路接触：只根据队员实际观察到的守军位置判断，未知位置不等于空点。
    if (intent.family === 'mid' && !this.flags.execute && this.t >= intent.pace.contactTick) {
      this.flags.execute = true;
      const midControlled = this.atk.some((a) => a.alive && this.map.region(a.node) === 'mid');
      if (midControlled) {
        const seen = observedRegionalCounts(this, this.atk, this.def);
        if (Object.values(seen).reduce((a,b)=>a+b,0) > 0) {
          const weaker = Object.keys(seen).sort((a,b)=>seen[a]-seen[b])[0];
          const carrier = this.spike.carrier;
          let q = decisionQuality(carrier ? carrier.sen : 60);
          if (this.iglAlive('atk')) q = Math.min(q + cfg.igl.readBonus, 0.98);
          if (this.rng() < q) {
            aimAt(intent, this.map, weaker);
            for (const u of this.atk) { u.targetSite = null; u.routeProg = 0; }
          }
          this.emit('mid_read', { site: intent.site, observedDefenders: seen });
        }
      }
    }

    // 可疑信息（假打）无后续接触会快速衰退：防守方逐渐回过味来
    for (const r of Object.keys(this.map.data.sites)) {
      const info = this.defInfo[r];
      if (info.suspicious && info.strength > 0 && this.t - info.tick > 5) {
        info.strength = Math.max(0, info.strength - 0.5);
      }
    }

    // 已下包：守方集结同步（凑齐至少 2 人或爆能器将爆才一起进点）
    if (this.planted && !this.flags.retakeHit && !require('./behavior-policy').multimapEnabled(this)) {
      const siteNode = this.map.siteNode(this.plantSite);
      const stagingNode = this.map.data.staging[this.plantSite];
      let gathered = 0, available = 0;
      for (const u of this.def) {
        if (!u.alive || u.saved || u.defusing) continue;
        available++;
        if (!u.moving && (u.node === stagingNode || u.node === siteNode)) gathered++;
      }
      if (available > 0 && (gathered >= Math.min(2, available) || this.spikeLeft <= (this.rules || cfg.round).defuseTicks + 6)) {
        this.flags.retakeHit = true;
        this.emit('retake', { site: this.plantSite, count: gathered });
      }
    }

    // 进攻方：时间压力强行进点（个体推进/下包先验在 brain 内随时间加压）
    if (!this.planted && !this.forceCommitted && this.t >= (this.rules || cfg.round).maxTicks - (this.rules || cfg.round).timePressure) {
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
    const enhanced=require('./behavior-policy').enabled(this);
    if(enhanced)this.pendingBrainStuns=[];
    for (const u of enhanced?this.units.slice().sort((a,b)=>a.id.localeCompare(b.id)):this.units) {
      if (!u.alive || u.moving || u.planting || u.defusing) continue;
      u.holdTicks+=(this.map.data?.tickSeconds||1);
      this.think(u);
    }
    if(enhanced){for(const {unit,seconds}of this.pendingBrainStuns)unit.stun=Math.max(unit.stun,seconds);this.pendingBrainStuns=null;}
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

  start() {
    if (this.started) return;
    this.started = true;
    this.emit('round_start', {
      atkFamily: this.atkFamily, defFamily: this.defFamily,
      // 观赛回放用：初始站位与装备
      units: this.units.map((u) => ({ id: u.id || `${u.side}:${u.sideIdx}`, name: u.name, side: u.side, node: u.node, role: u.role, carrier: !!u.isCarrier,
        hp: u.hp, ammo: u.ammo, position: u.position && {...u.position},
        gun: u.gun, armor: u.armor, utils: u.utils, agent: u.agent, igl: !!u.isIGL })),
      ...(this.map.data?.dynamicDoors?{doors:{...this.doors}}:{})
    });
    if (this.atkFamily === 'mid' && this.hasGrowth('atk', 'mid-shift')) this.triggerGrowth('atk', 'mid-shift');
    for (const fn of this.hooks.onRoundStart) fn(this);
  }

  finish() {
    if (!this.result || this.finished) return this.result;
    this.finished = true;
    const summary = this.onRoundEnd ? this.onRoundEnd(this.result, this._roundEvents || []) : null;
    this.emit('round_end', { winner: this.result.winner, reason: this.result.reason, ...(summary ? { summary } : {}) });
    return this.result;
  }

  // 一次调用推进一个旧版 1 秒逻辑 tick；后续动作细化时可在此边界迁移时钟。
  step() {
    this.start();
    if (this.result) return this.finish();
    if (this.planted) {
      this.spikeLeft-=(this.map.data?.tickSeconds||1);
      if (this.spikeLeft <= 0) { this.endRound('atk', 'explosion'); return this.finish(); }
    } else if (this.t >= (this.rules || cfg.round).maxTicks) {
      this.endRound('def', 'timeout');
      return this.finish();
    }
    this.updateDoors();
    if(this.map.data?.externalEffectsVersion)require('./external-effects').refresh(this);
    this.updateMovement();
    if(require('./behavior-policy').zonesEnabled(this))require('./behavior-policy').updateHazards(this);
    this.resolveCombat();
    recordObservations(this);
    this.updatePlantDefuse();
    if (this.result) return this.finish();
    const atkAlive = this.aliveCount('atk');
    const defAlive = this.aliveCount('def');
    const pendingDefRevive = this.reviveQueue.some(rv => rv.unit.side === 'def');
    const pendingAtkRevive = this.reviveQueue.some(rv => rv.unit.side === 'atk');
    if (defAlive === 0 && !pendingDefRevive) { this.endRound('atk', 'elimination'); return this.finish(); }
    if (atkAlive === 0 && !pendingAtkRevive && !this.planted) {
      this.endRound('def', 'elimination');
      return this.finish();
    }
    this.updateTeamState();
    this.updateDefenseSupport();
    if(!this.map.data?.strictSpatial||Number.isInteger(this.t))abilities.tick(this);
    this.updateBrains();
    this.t+=(this.map.data?.tickSeconds||1);
    return null;
  }

  run() {
    while (!this.result) this.step();
    this.finish();
    return this.result;
  }
}

// 混入模块：movement 机动 / combat 交火 / perception 信息感知 / brain 个体效用 AI
Object.assign(RoundSim.prototype,
  require('./movement'),
  require('./combat'),
  require('./perception'),
  require('./defense-support'),
  require('./doors'),
  brain
);

module.exports = { RoundSim, decisionQuality };
