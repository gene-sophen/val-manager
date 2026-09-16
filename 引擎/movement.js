// 机动：节点间移动、边暴露、静音慢摸、警戒/燃烧触发、进点连锁（从 round.js 拆出，纯代码移动）
const cfg = require('./config');

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
      if (this.iglAlive(u.side)) ticks = Math.max(1, Math.round(ticks * cfg.igl.rotateTicksMult)); // IGL 指挥机动
    }
    if (mode === 'run') u.loudUntil = this.t + 6; // 跑动暴露行踪，可被侦察捕捉
    // 烟雾封锁：防守回防穿越烟雾边减速
    const smokeUntil = this.smokedEdges[this.edgeKey(u.node, next)];
    if (u.side === 'def' && smokeUntil && this.t < smokeUntil) ticks += cfg.utility.smokeRotateDelay;
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
      // 到达后立即做一次决策（继续推进/落位驻守）
      if (u.alive) this.think(u, true);
    }
  }
};
