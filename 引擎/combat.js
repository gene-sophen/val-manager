// 交火结算：击杀概率模型、补枪、进点抢先枪、每 tick 同节点交火（从 round.js 拆出，纯代码移动）
const cfg = require('./config');

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
  },

  tryKill(att, tgt, entry) {
    if (!att.alive || !tgt.alive) return false;
    const p = this.killP(att, tgt, entry);
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
  },

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
  }
};
