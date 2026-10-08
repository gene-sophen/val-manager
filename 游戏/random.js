const { derive, mulberry32 } = require('../引擎/rng');

const STREAMS = Object.freeze({ pack: 1000, growth: 2000, fixture: 3000, match: 4000 });

function stream(seed, kind, index) {
  if (!Number.isInteger(seed) || !Number.isInteger(index) || index < 0 || !(kind in STREAMS)) {
    throw new Error('无效的随机序列参数');
  }
  return mulberry32(derive(seed, STREAMS[kind] + index));
}

module.exports = { stream };
