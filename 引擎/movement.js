// 机动：节点间移动、边暴露、静音慢摸、警戒/燃烧触发、进点连锁（从 round.js 拆出，纯代码移动）
const cfg = require('./config');
const abilities = require('./abilities');

module.exports = {
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
      // IGL 指挥机动（效率按 IGL 本人 SYN 缩放）
      const igl = this.iglUnit(u.side);
      if (igl) ticks = Math.max(1, Math.round(ticks * (1 - (1 - cfg.igl.rotateTicksMult) * (igl.syn / 60))));
    }
    if (mode === 'run') u.loudUntil = this.t + 6; // 跑动暴露行踪，可被侦察捕捉
    // 烟雾封锁：防守回防穿越烟雾边减速
    const smokeUntil = this.smokedEdges[this.edgeKey(u.node, next)];
    if (u.side === 'def' && smokeUntil && this.t < smokeUntil) ticks += cfg.utility.smokeRotateDelay;
    // 墙体封锁（冰墙类）：双方穿越都大幅减速
    const wallUntil = this.walledEdges[this.edgeKey(u.node, next)];
    if (wallUntil && this.t < wallUntil) ticks += cfg.abilities.wallTickDelay;
    this.occ[u.node].delete(u);
    this.releasePost(u); // 移动中 post=null，离开节点释放对枪点
    // 预选到达节点的对枪点（高 SEN 偏好掩体好/枪线多的槽位；进攻慢摸埋伏时回避枪线）
    const hide = mode === 'walk' && u.side === 'atk';
    const post = this.map.postsAt(next).length ? this.pickPost(u, next, true, hide) : null;
    u.moving = { from: u.node, to: next, dest, left: ticks, mode, exposure, post };
    u.holdTicks = 0;
    this.emit('move', { unit: u.name, side: u.side, from: u.node, to: next, ticks, post }); // 观赛回放用
    return true;
  },

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
      u.post = mv.post || null; // 落位到预选的对枪点（无 posts 的节点保持节点级）
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
          u.stun = cfg.utility.trapStun + (this.trapPower[u.node] || 0); // 招牌陷阱（零绊线等）滞留更久
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
          if (!this.atkSmokeUsed && abilities.onCommitSmoke(this, u)) this.atkSmokeUsed = true;
        }
      }
      // 预置燃烧（赌点全押）：进攻踩进该点即激活火线封锁，预置火线持续更久
      if (u.side === 'atk' && this.presetMolly[u.node] > 0 && !(this.mollyZone && this.t < this.mollyZone.until)) {
        this.presetMolly[u.node]--;
        this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks + 2 };
        this.emit('molly_entry', { node: u.node, preset: true });
      }
      // 进点燃烧弹：点内守军自主决定是否封火（优先 molly 技能），后续进点者被火线逼停
      if (u.side === 'atk' && (u.node === 'a_site' || u.node === 'b_site') && this.enemiesAt(u.node, 'atk').length > 0) {
        const region = this.map.region(u.node);
        if (!this.defEntryMolly[region]) {
          const candidates = [];
          for (const d of this.def) {
            if (d.alive && (d.utils > 0 || abilities.findSkill(d, 'molly')) && this.map.region(d.node) === region) candidates.push(d);
          }
          candidates.sort((a, b) => b.syn - a.syn);
          for (const thrower of candidates) {
            const r = abilities.triggerCast(this, thrower, 'molly', { node: u.node, entry: true });
            if (r) {
              this.defEntryMolly[region] = true;
              this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks };
              this.emit('molly_entry', { node: u.node, by: thrower.name });
              break;
            }
          }
        }
      }
      // 穿越火线：被燃烧弹逼停（deny=守包燃烧拦防守，普通=进点燃烧拦进攻）
      if (this.mollyZone && this.t < this.mollyZone.until && u.node === this.mollyZone.node
        && (this.mollyZone.deny ? u.side === 'def' : u.side === 'atk')) {
        u.stun = Math.max(u.stun, 3);
        this.emit('molly_block', { node: u.node, unit: u.name });
      }
      // 进点遭遇：架点方抢先枪
      this.entryFight(u);
      // 到达后立即做一次决策（继续推进/落位驻守）
      if (u.alive) this.think(u, true);
    }
  }
};
