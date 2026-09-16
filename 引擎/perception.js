// 感知与信息：信息写入（含假打可疑标记）、防守方对信息的反应（回防/局部收缩）（从 round.js 拆出，纯代码移动）
const cfg = require('./config');

module.exports = {
  // 信息写入：真实信息（暴露/警戒/交战/侦察/下包）会洗掉假打的可疑标记
  addInfo(region, amount, suspicious = false) {
    const info = this.defInfo[region];
    if (!info) return;
    info.strength = Math.min(info.strength + amount, 12);
    info.tick = this.t;
    info.suspicious = suspicious === null ? info.suspicious : suspicious; // 侦察传 null 保留可疑标记
    this.newInfo = true;
  },

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
};
