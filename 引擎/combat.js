// 交火结算：击杀概率模型、补枪、进点抢先枪、每 tick 同节点交火（从 round.js 拆出，纯代码移动）
const cfg = require('./config');
const abilities = require('./abilities');
const actions = require('./actions');
const { lineIntersectsCircle } = require('./geometry');
const { canObserve } = require('./observation');

const C = cfg.combat;
if (!Number.isInteger(C.syncMin) || C.syncMin < 2 || !Number.isFinite(C.syncReduce)) {
  throw new Error('无效的同步进点配置：combat.syncMin / combat.syncReduce');
}

module.exports = {
  aliveCount(side) {
    const arr = side === 'atk' ? this.atk : this.def;
    let n = 0;
    for (const u of arr) if (u.alive) n++;
    return n;
  },

  enemiesAt(node, side) {
    const out = [];
    for (const u of this.occ[node]) if (u.alive && u.side !== side) out.push(u);
    return out;
  },

  isContested(node) {
    let a = false, d = false;
    for (const u of this.occ[node]) {
      if (!u.alive) continue;
      if (u.side === 'atk') a = true; else d = true;
      if (a && d) return true;
    }
    return false;
  },

  // ---- 击杀概率模型 ----
  // crossFire：跨节点枪线交火（双方 post 互见），目标暴露度减免击杀概率
  killP(att, tgt, entry, crossFire) {
    const node = this.map.nodes[att.node];
    let p = C.baseKill;
    p *= 1 + (att.aim - tgt.aim) * C.aimCoef;
    p *= cfg.gun.mod[att.gun];
    p *= tgt.armor === 'heavy' ? cfg.armor.heavy : (tgt.armor === 'light' ? cfg.armor.light : cfg.armor.none);
    p *= att.holdTicks >= 2 ? C.settledBonus : (att.dashUntil >= this.t ? 1.0 : C.moverPenalty); // dash 位移进点抹平移动惩罚
    const adv = node.advantage;
    p *= adv === att.side ? C.advBonus : (adv === 'neutral' ? 1 : C.disadvPenalty);
    // 掩体减免：目标占了对枪点则用 post.cover（高 SEN 选位好直接受益），否则节点级
    const tgtCover = (tgt.post && this.map.posts[tgt.post]) ? this.map.posts[tgt.post].cover : node.cover;
    if (tgt.holdTicks >= 2) p *= 1 - tgtCover * C.coverResist;
    if (crossFire && att.post && tgt.post) p *= 1 - this.map.exposureBetween(att.post, tgt.post) * cfg.brain.crossFireResist;
    if (entry) p *= C.entryBonus;
    if (att.aimbuffUntil >= this.t) p *= (att.aimbuffMult || cfg.abilities.aimbuffMult); // 自增益技能（猎头/心流/大招）
    if (tgt.healUntil >= this.t) p *= 1 - cfg.abilities.healResist; // 治疗后的短期受击减免
    if (att.stun > 0) p *= cfg.utility.stunFirePenalty; // 被警戒/燃烧/震荡滞留时开火不稳
    if (att.isIGL) p *= 1 - (1 - cfg.igl.aimPenalty) * (70 / att.sen); // IGL 指挥分心代价（意识差的选手分心更严重）
    for (const fn of this.hooks.beforeKillRoll) p = fn({ att, tgt, node, round: this, entry }, p);
    return Math.min(Math.max(p, 0.01), 0.9);
  },

  tryKill(att, tgt, entry, crossFire) {
    if (!att.alive || !tgt.alive) return false;
    if (this.map.data?.strictSpatial) return canObserve(this,att,tgt) ? this.fireShot(att,tgt,false) : false;
    // 单包点二维场景先使用动作/伤害模型；旧整图在校准前保持原有概率模型。
    if (this.map.geometry && att.position && tgt.position
      && this.map.geometry.contains(att.position) && this.map.geometry.contains(tgt.position)) {
      return this.fireShot(att, tgt, entry);
    }
    const p = this.killP(att, tgt, entry, crossFire);
    if (this.rng() < p) {
      this.applyKill(att, tgt);
      return true;
    }
    return false;
  },

  fireShot(att, tgt, entry) {
    const campaign = this.map.data.combatProfile === 'campaign-ballistics';
    if (campaign && att.lastShotTick === this.t) return false;
    if (this.map.data?.strictSpatial ? !canObserve(this,att,tgt) : !this.map.geometry.lineOfSight(att.position,tgt.position)) return false;
    if ((this.geometrySmokes || []).some(smoke => this.t < smoke.until
      && lineIntersectsCircle(att.position, tgt.position, smoke, smoke.radius))) return false;
    const shotTrace=this.map.data.dynamicDoors?this.map.geometry.shootTrace(att.position,tgt.position,{doors:this.doors,smokes:(this.geometrySmokes||[]).filter(s=>this.t<s.until)}):null;
    if(this.map.data.dynamicDoors&&!shotTrace)return false;
    if (!require('./behavior-policy').multimapEnabled(this) && att.post && tgt.post && this.sightBlocked && this.sightBlocked(att.post, tgt.post)) return false;
    const spec = actions.weaponSpec(att.gun);
    if (att.ammo == null) att.ammo = spec.magazine;
    if (tgt.hp == null) tgt.hp = 100;
    if (att.ammo <= 0) {
      if (att.reloadUntil == null || att.reloadUntil < 0) {
        att.reloadUntil = this.t + spec.reloadTicks;
        this.emit('reload_start', { unit: att.name, unitId: att.id, until: att.reloadUntil });
      }
      if (this.t < att.reloadUntil) return false;
      att.ammo = spec.magazine;
      att.reloadUntil = -1;
      this.emit('reload_end', { unit: att.name, unitId: att.id, ammo: att.ammo });
    }
    att.ammo--;
    if (campaign) att.lastShotTick = this.t;
    if(this.map.data.externalEffectsVersion)require('./external-effects').refresh(this,tgt);
    const encounter=this.map.engagements?.query(this,att,tgt);
    let p = actions.hitChance(att, tgt, entry, this.map, this.t, encounter?.visible);
    for (const fn of this.hooks.beforeKillRoll) p = fn({ att, tgt, node: this.map.nodes[att.node], round: this, entry }, p);
    p = Math.max(0.01, Math.min(0.95, p));
    this.emit('shot', { actor: att.name, actorId: att.id, target: tgt.name, targetId: tgt.id,
      x: att.position.x, y: att.position.y, targetX: shotTrace?.x??tgt.position.x, targetY: shotTrace?.y??tgt.position.y, ammo: att.ammo,
      ...(shotTrace?{targetCenterX:tgt.position.x,targetCenterY:tgt.position.y,bodyOffset:shotTrace.bodyOffset,doors:{...this.doors}}:{}),
      ...(encounter?{window:encounter.window,fromPosition:encounter.fromPosition,toPosition:encounter.toPosition,visibleFraction:encounter.visible}: {}) });
    const hit=this.rng()<p;
    if(!hit&&!(att.secondChance&&this.rng()<p))return false;
    let headChance=.05+att.aim*.0025,headCap=.35;
    if(require('./behavior-policy').multimapEnabled(this)){
      headCap=.5;
      // A settled firing pose represents a prepared head line. Both teams can
      // earn this precision; moving/unsighted entries receive no side bonus.
      if(att.post&&!att.moving&&att.holdTicks>=2)headChance+=(this.map.data.balanceProfile?.headLinePrecision??.2)*(att.aim/100)*(att.sen/100);
    }
    const headshot = campaign && this.rng() < Math.max(.05,Math.min(headCap,headChance));
    const damage = actions.damageFor(att, tgt) * (headshot ? 4 : 1);
    if(this._shotBatch){this._shotBatch.push({att,tgt,damage,headshot});return false;}
    tgt.hp = Math.max(0, tgt.hp - damage);
    this.emit('damage', { actor: att.name, actorId: att.id, target: tgt.name, targetId: tgt.id, damage, hp: tgt.hp, hitLocation: headshot ? 'head' : 'body' });
    if (tgt.hp > 0) return false;
    this.applyKill(att, tgt);
    return true;
  },

  applyKill(killer, victim) {
    if(this.map.engagements&&victim.moving?.post&&this.postOcc[victim.moving.post]===victim)delete this.postOcc[victim.moving.post];
    victim.alive = false;
    victim.hp = 0;
    victim.moving = null;
    victim.planting = 0;
    victim.defusing = 0;
    killer.roundKills++;
    this.occ[victim.node].delete(victim);
    this.releasePost(victim); // 释放对枪点槽位
    this.reportDefensiveLoss(victim);
    this.emit('kill', { node: victim.node, x: victim.position && victim.position.x, y: victim.position && victim.position.y,
      killer: killer.name, killerId: killer.id, victim: victim.name, victimId: victim.id, side: killer.side });
    for (const fn of this.hooks.onKill) fn({ killer, victim, node: victim.node, round: this });
    // 爆能器掉落
    if (victim.isCarrier && !(this.planted&&this.map.data.objectiveModel==='defuse-v2')) {
      victim.isCarrier = false;
      this.spike.carrier = null;
      this.spike.node = victim.node;
      if(this.map.data.dynamicDoors)this.spike.position={...(this.map.geometry.contains(victim.position,{doors:this.doors})?victim.position:victim.lastGroundPosition||this.map.nodes[victim.node])};
      this.pickupAssigned = false;
      this.emit('spike_drop', { node: victim.node, x: victim.position && victim.position.x, y: victim.position && victim.position.y });
    }
    if (this.map.geometry && victim.position && this.map.geometry.contains(victim.position)) {
      this.tradeQueue = this.tradeQueue || [];
      this.tradeQueue.push({ killer, victimSide: victim.side, at: this.t + 1 });
    } else {
      // 旧整图模型仍沿用即时补枪；二维场景在下一动作窗口按枪线处理。
      for (const tm of this.occ[victim.node]) {
        if (!tm.alive || tm.side !== victim.side || tm.planting || tm.defusing) continue;
        if (this.rng() < C.tradeBase * tm.syn / 100) {
          if (this.tryKill(tm, killer, false)) break;
        }
      }
    }
    // 复活技能判定（不死鸟/暮蝶自我复活，贤者复活队友）
    abilities.onDeath(this, victim);
  },

  entryFight(entrant) {
    if(require('./behavior-policy').enabled(this)){
      if(entrant.side==='def'&&entrant.supportOrder&&entrant.node===this.map.siteNode(entrant.supportOrder.site))this.emit('support_arrive',{unit:entrant.name,unitId:entrant.id,site:entrant.supportOrder.site});
      if(Object.values(this.map.data.sites).includes(entrant.node))(this.pendingEntryFlashes??=[]).push(entrant);
      return;
    }
    if(this.map.data?.fireModel==='timed-v3') {
      if((this.map.data?.sites?Object.values(this.map.data.sites):['a_site','b_site']).includes(entrant.node))abilities.onEntryFlash(this,entrant);
      return; // Geometry, reaction time and one firing scheduler decide first contact.
    }
    const enemies = this.enemiesAt(entrant.node, entrant.side);
    if (!enemies.length) return;
    // 同步进点：3 tick 内同节点友方人数 >=2 时降低被抢先概率（IGL 提升等效协同）
    // （think 节拍相位差会让同批进点者落点错开 0~2 tick，窗口比指令链时代放宽 1 tick）
    let sync = 0, synSum = 0, usedExtendedWindow = false;
    for (const u of this.occ[entrant.node]) {
      const window = this.hasGrowth && this.hasGrowth(entrant.side, 'entry-rehearsal') ? 4 : 3;
      if (u.alive && u.side === entrant.side && u.holdTicks <= window) {
        sync++; synSum += u.syn;
        if (u.holdTicks > 3) usedExtendedWindow = true;
      }
    }
    if (sync > 0 && this.iglAlive(entrant.side)) synSum += cfg.igl.syncSynBonus * sync;
    // 闪光道具：进点/回防进包点时，在场同方选手自主决定是否丢闪（SYN 决定效果；技能闪更强）
    const isSite = (this.map.data?.sites?Object.values(this.map.data.sites):['a_site','b_site']).includes(entrant.node);
    const isAtkHit = entrant.side === 'atk' && isSite;
    const isDefRetake = entrant.side === 'def' && this.planted && isSite;
    let flash = 0;
    if (isAtkHit || isDefRetake) flash = abilities.onEntryFlash(this, entrant);
    for (const holder of enemies) {
      if (!holder.alive || holder.planting || holder.defusing || holder.stun > 0) continue;
      if (holder.holdTicks < 2) continue; // 只有已架好枪的单位才有抢先枪
      if (holder.post && entrant.post && !this.map.canSee(holder.post, entrant.post)) continue;
      let pSpot = C.entryShotBase + holder.sen * C.entryShotSen;
      if (sync >= C.syncMin) {
        const effect = this.hasGrowth && this.hasGrowth(entrant.side, 'entry-sync') ? 1.25 : 1;
        pSpot -= (synSum / sync) * C.syncReduce * effect;
        if (effect > 1) this.triggerGrowth(entrant.side, 'entry-sync', entrant.name);
        if (usedExtendedWindow) this.triggerGrowth(entrant.side, 'entry-rehearsal', entrant.name);
      }
      pSpot -= flash; // 被致盲
      if (entrant.dashUntil >= this.t) pSpot -= entrant.dashDodge || 0; // dash 位移闪避抢先枪
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
  },

  // ---- 每 tick 交火 ----
  resolveSpatialFire() {
    if(this.map.data?.fireModel==='timed-v3')return this.resolveTimedFire();
    // A visible target has the same firing opportunity across region labels.
    // The legacy .3 cross-region roll was suppressing anchors' covering fire
    // while entry fighters could shoot every tick. Accuracy belongs in the
    // actual shot roll, not an additional region-dependent lottery.
    const fighters = this.units.filter(u => u.alive && !u.moving && !u.planting && !u.defusing && u.stun<=0);
    for (let i=fighters.length-1;i>0;i--) {
      const j=Math.floor(this.rng()*(i+1));[fighters[i],fighters[j]]=[fighters[j],fighters[i]];
    }
    for (const u of fighters) {
      if (!u.alive || u.lastShotTick===this.t) continue;
      const visible = this.units.filter(e => canObserve(this,u,e));
      visible.sort((a,b) => Math.hypot(a.position.x-u.position.x,a.position.y-u.position.y)
        - Math.hypot(b.position.x-u.position.x,b.position.y-u.position.y));
      if (visible.length) this.tryKill(u,visible[0],false);
    }
  },

  resolveTimedFire() {
    if(require('./behavior-policy').enabled(this))return require('./behavior-policy').fire.call(this);
    const ready=[];
    for(const u of this.units) {
      if(!u.alive||u.planting||u.defusing||u.stun>0||u.doorAction)continue;
      const visible=this.units.filter(e=>canObserve(this,u,e)).sort((a,b)=>Math.hypot(a.position.x-u.position.x,a.position.y-u.position.y)-Math.hypot(b.position.x-u.position.x,b.position.y-u.position.y));
      if(!visible.length){if(u.targetSeenAt!=null&&this.t-u.targetSeenAt>1){u.fireTarget=null;u.fireReadyAt=null;}continue;}
      const target=(u.duelChain&&visible.find(e=>e.id===u.fireTarget))||visible[0];u.targetSeenAt=this.t;
      if(this.map.data.externalEffectsVersion)require('./external-effects').refresh(this,target);
      if(u.fireTarget!==target.id){
        const trade=this.map.data.externalEffectsVersion&&require('./external-effects').condition('trade',this,u,target);
        const coordination=trade?Math.max(0,u.syn-50)*.001:0;
        u.fireTarget=target.id;u.fireReadyAt=this.t+.2+(100-u.sen)*.003+this.rng()*.08-coordination;
        const encounter=this.map.engagements?.query(this,u,target);this.emit('contact',{unit:u.name,unitId:u.id,side:u.side,targetId:target.id,x:u.position.x,y:u.position.y,readyAt:u.fireReadyAt,...(encounter?{window:encounter.window,fromPosition:encounter.fromPosition,toPosition:encounter.toPosition,visibleFraction:encounter.visible}:{}) ,...(trade?{tradeResponse:true,coordinationSeconds:coordination}:{})});abilities.onEntryFlash(this,u);
      }
      if(u.moving&&u.moving.traversal!=='zipline'){this.interruptMove(u,'contact');}
      if(this.t+1e-7>=u.fireReadyAt){ready.push({u,target,at:u.fireReadyAt});u.fireReadyAt=this.t+(u.gun===0?.5:.25);}
    }
    // A simultaneous time slice resolves damage after both sides have fired.
    this._shotBatch=[];
    for(const {u,target}of ready.sort((a,b)=>a.at-b.at))this.tryKill(u,target,false);
    const damage=this._shotBatch;this._shotBatch=null;
    for(const {att,tgt,damage:amount,headshot}of damage){if(!tgt.alive)continue;tgt.hp=Math.max(0,tgt.hp-amount);this.emit('damage',{actor:att.name,actorId:att.id,target:tgt.name,targetId:tgt.id,damage:amount,hp:tgt.hp,hitLocation:headshot?'head':'body'});if(tgt.hp===0)this.applyKill(att,tgt);}
  },

  resolveCombat() {
    if (this.map.data?.fireModel==='timed-v3') {this.resolveTimedFire();return;}
    if (this.tradeQueue?.length) {
      const ready = this.tradeQueue.filter(trade => trade.at <= this.t);
      this.tradeQueue = this.tradeQueue.filter(trade => trade.at > this.t);
      for (const trade of ready) {
        if (!trade.killer.alive || !trade.killer.position) continue;
        const teammates = this.units.filter(u => u.alive && u.side === trade.victimSide && u.position
          && this.map.geometry.contains(u.position)
          && Math.hypot(u.position.x - trade.killer.position.x, u.position.y - trade.killer.position.y) <= 140
          && this.map.geometry.lineOfSight(u.position, trade.killer.position));
        for (const teammate of teammates) {
          if (this.rng() >= C.tradeBase * teammate.syn / 100) continue;
          this.emit('trade_attempt', { unit: teammate.name, unitId: teammate.id, target: trade.killer.name, targetId: trade.killer.id });
          this.tryKill(teammate, trade.killer, false);
          if (!trade.killer.alive) break;
        }
      }
    }
    if (this.map.data.spatialFire==='shared-los' && this.map.geometry) {
      this.resolveSpatialFire();
      return;
    }
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
        const enemies = this.enemiesAt(nodeId, u.side).filter(tgt =>
          !u.post || !tgt.post || this.map.canSee(u.post, tgt.post));
        if (!enemies.length) continue;
        const tgt = enemies[Math.floor(this.rng() * enemies.length)];
        this.tryKill(u, tgt, false);
      }
    }
    // 跨节点枪线交火：双方已架好枪且 post 互相可见才能对枪；每对每 tick 按概率交火
    // 同节点混战中的单位无暇跨节点对枪（节点正在交火则跳过）
    const contested = {};
    for (const nodeId of Object.keys(this.occ)) {
      if (this.isContested(nodeId)) contested[nodeId] = true;
    }
    const holders = [];
    for (const u of this.units) {
      if (u.alive && !u.moving && !u.planting && !u.defusing && u.stun <= 0 && u.post && u.holdTicks >= 2 && !contested[u.node]) holders.push(u);
    }
    for (let i = 0; i < holders.length; i++) {
      for (let j = i + 1; j < holders.length; j++) {
        const a = holders[i], b = holders[j];
        if (a.side === b.side || !a.alive || !b.alive) continue;
        if (a.node === b.node) continue; // 同节点已在上面结算
        if (a.concealed || b.concealed) continue; // 埋伏隐蔽中的单位不被枪线锁定（也不探身开枪）
        if (!this.map.canSee(a.post, b.post)) continue;
        if (this.sightBlocked(a.post, b.post)) continue; // 烟/墙封枪线
        if (this.rng() >= cfg.brain.crossFireProb) continue;
        // 随机先后各开一枪
        if (this.rng() < 0.5) {
          this.tryKill(a, b, false, true);
          if (b.alive) this.tryKill(b, a, false, true);
        } else {
          this.tryKill(b, a, false, true);
          if (a.alive) this.tryKill(a, b, false, true);
        }
      }
    }
    // 有二维几何的区域内，移动者持续有位置并可能穿过架枪视线。
    if (this.map.geometry) {
      for (const mover of this.units) {
        if (!mover.alive || !mover.moving || !mover.position || !this.map.geometry.contains(mover.position)) continue;
        for (const holder of holders) {
          if (!holder.alive || holder.side === mover.side || !holder.post) continue;
          const point = this.map.posts[holder.post];
          if (!point || !this.map.geometry.contains(point) || !this.map.geometry.lineOfSight(point, mover.position)) continue;
          if (this.rng() < cfg.brain.crossFireProb) this.tryKill(holder, mover, false, true);
          if (!mover.alive) break;
        }
      }
    }
  }
};
