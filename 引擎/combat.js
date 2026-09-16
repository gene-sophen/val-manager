// 交火结算：击杀概率模型、补枪、进点抢先枪、每 tick 同节点交火（从 round.js 拆出，纯代码移动）
const cfg = require('./config');
const abilities = require('./abilities');

const C = cfg.combat;

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
    const p = this.killP(att, tgt, entry, crossFire);
    if (this.rng() < p) {
      this.applyKill(att, tgt);
      return true;
    }
    return false;
  },

  applyKill(killer, victim) {
    victim.alive = false;
    victim.moving = null;
    victim.planting = 0;
    victim.defusing = 0;
    killer.roundKills++;
    this.occ[victim.node].delete(victim);
    this.releasePost(victim); // 释放对枪点槽位
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
    // 复活技能判定（不死鸟/暮蝶自我复活，贤者复活队友）
    abilities.onDeath(this, victim);
  },

  entryFight(entrant) {
    const enemies = this.enemiesAt(entrant.node, entrant.side);
    if (!enemies.length) return;
    // 同步进点：3 tick 内同节点友方人数 >=2 时降低被抢先概率（IGL 提升等效协同）
    // （think 节拍相位差会让同批进点者落点错开 0~2 tick，窗口比指令链时代放宽 1 tick）
    let sync = 0, synSum = 0;
    for (const u of this.occ[entrant.node]) {
      if (u.alive && u.side === entrant.side && u.holdTicks <= 3) { sync++; synSum += u.syn; }
    }
    if (sync > 0 && this.iglAlive(entrant.side)) synSum += cfg.igl.syncSynBonus * sync;
    // 闪光道具：进点/回防进包点时，在场同方选手自主决定是否丢闪（SYN 决定效果；技能闪更强）
    const isSite = entrant.node === 'a_site' || entrant.node === 'b_site';
    const isAtkHit = entrant.side === 'atk' && isSite;
    const isDefRetake = entrant.side === 'def' && this.planted && isSite;
    let flash = 0;
    if (isAtkHit || isDefRetake) flash = abilities.onEntryFlash(this, entrant);
    for (const holder of enemies) {
      if (!holder.alive || holder.planting || holder.defusing || holder.stun > 0) continue;
      if (holder.holdTicks < 2) continue; // 只有已架好枪的单位才有抢先枪
      let pSpot = C.entryShotBase + holder.sen * C.entryShotSen;
      if (sync >= C.syncMin) pSpot -= (synSum / sync) * C.syncReduce;
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
  }
};
