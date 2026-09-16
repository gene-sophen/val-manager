// 感知与信息：信息写入（含假打可疑标记）、防守方对信息反应的执行（从 round.js 拆出）
// Phase2-B：回防/收缩的"决策"已移至 brain.js 效用评分，reactToInfo 只负责执行移动与状态标记
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

  // 防守方信息反应执行：强真实信息（或赌点队本性）全面回防到受威胁侧集结点待命；
  // 中等/可疑信息只做局部收缩——只有中路自由人靠拢（站点锚兵不动，否则被假打拉空），每方向限一人
  reactToInfo(u, target, strength, suspicious) {
    const staging = this.map.data.staging[target];
    const fullRotate = (!suspicious && strength >= cfg.ai.contractInfo) || this.defIntent.family === 'stack';
    if (fullRotate) {
      u.rotating = true;
      u.support = target;
      if (u.node !== staging) this.startMove(u, staging, 'run');
      this.emit('rotate', { unit: u.name, to: target });
    } else {
      if (this.map.region(u.node) !== 'mid' || this.contracted[target]) return;
      this.contracted[target] = true;
      u.support = target; // 收缩后仍可升级为全面回防
      if (u.node !== staging) this.startMove(u, staging, 'run');
      this.emit('contract', { unit: u.name, to: target });
    }
  }
};
