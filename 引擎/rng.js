// 可复现随机数：mulberry32
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 由主种子派生第 i 场子种子
function derive(seed, i) {
  return (seed * 2654435761 + i * 40503) >>> 0;
}

module.exports = { mulberry32, derive };
