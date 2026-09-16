// 战斗推演引擎 v0 · 全部可调数值集中在此，便于平衡迭代
module.exports = {
  match: {
    firstTo: 13,        // 先到 N 胜（可压缩为 9 等）
    halfRounds: 12,     // 半场回合数，之后换边
    overtimeMoney: 5000 // 加时局双方经济
  },
  round: {
    maxTicks: 100,      // 回合时长（1 tick = 1 秒）
    spikeTicks: 45,     // 爆能器引爆倒计时
    plantTicks: 4,      // 下包耗时
    defuseTicks: 7,     // 拆包耗时（无拆包器）
    timePressure: 25    // 剩余秒数低于此值进攻方强行进点
  },
  eco: {
    startMoney: 800,
    winReward: 3000,
    lossBase: 1900,         // 连败首档
    lossStreakStep: 500,    // 每多一连败 +500
    lossStreakMax: 2,       // 连败补偿封顶档数（1900/2400/2900）
    killReward: 200,
    plantReward: 300,       // 下包者
    defuseReward: 300,      // 拆包者
    lossPlantBonus: 300,    // 进攻方下包后落败，每人补偿
    maxMoney: 9000,
    rifleCost: 2900,
    smgCost: 1600,
    heavyArmorCost: 1000,
    lightArmorCost: 650,
    fullBuyAvg: 3400,       // 团队人均达到则全起
    halfBuyAvg: 2100        // 达到则半起，否则 eco
  },
  gun: {
    // 档位 0 手枪 / 1 冲锋枪（半起）/ 2 步枪；作为击杀概率乘子
    mod: [0.78, 1.0, 1.32]
  },
  armor: {
    // 目标护甲对"被击杀概率"的乘子
    none: 1.0,
    light: 0.88,
    heavy: 0.72
  },
  combat: {
    baseKill: 0.14,         // 每 tick 单对交火基础击杀概率
    aimCoef: 0.0009,         // AIM 差对击杀概率的线性系数
    settledBonus: 1.22,     // 架枪（驻留>=2 tick）加成
    moverPenalty: 0.84,     // 移动/刚进点惩罚
    advBonus: 1.25,         // 节点架枪优势方加成
    disadvPenalty: 0.85,     // 节点劣势方惩罚
    coverResist: 0.35,       // 掩体质量减免比例（仅驻守目标享受）
    entryShotBase: 0.59,    // 架点者对进点者抢先一枪的基础概率
    entryShotSen: 0.002,    // 每点 SEN 增加抢先概率
    entryBonus: 1.6,       // 抢先一枪的伤害乘子
    tradeBase: 0.4,        // 补枪基础概率（乘 SYN/100）
    syncReduce: 0.002,      // 同步进点（>=2人同到）按平均 SYN 降低被抢先概率
    multiTargetPenalty: 0.12 // 同节点每多一个敌人，单人输出分散惩罚（暂不启用）
  },
  move: {
    silentTickMult: 1.5,    // 静音慢摸耗时倍率
    silentExposureMult: 0.35, // 静音慢摸暴露度倍率
    rotateSynCoef: 0.0015   // 回防耗时倍率 = 1 - SYN*coef
  },
  ai: {
    senBase: 0.45,          // 决策质量 = senBase + senRange*(SEN-30)/66
    senRange: 0.16,
    rotateNeedInfo: 5,
    spotInfo: 3,            // 每次暴露给的信息强度
    contractInfo: 9,        // 分站防守：信息强度达此为全面回防，低于此为局部收缩
    saveEvalInterval: 5,    // 保枪判定间隔（tick）
    defuseHesitate: 2,      // 低 SEN 拆包犹豫 tick 数
    utilThinkBase: 0.45,    // 道具自主决策：想到要使用的基础概率
    utilThinkSen: 0.005     // 每点 SEN 增加想到概率
  },
  // 假打转点（第 4 进攻族）
  fake: {
    fakeTick: 18,           // 假打组开始制造动静的 tick（±4 随机）
    hitTick: 40,            // 真打组启动的 tick（±6 随机）
    noiseInfo: 5,           // 假动静产生的信息强度（标记为可疑）
    readBase: 0.3,          // 识破假打基础概率（挂 SEN）
    readSen: 0.005,         // 每点 SEN 增加识破概率
    decoyUtilThink: 0.7     // 假打组交道具佯攻的意愿概率
  },
  // IGL 指挥加成（队内 IGL 存活时生效）
  igl: {
    syncSynBonus: 14,       // 同步进点等效 SYN 加成
    rotateTicksMult: 0.88,  // 回防/转点耗时乘子
    fakeReadBonus: 0.10,    // 识破/假打质量加成
    readBonus: 0.10         // 中路读取等战术决策质量加成
  },
  // 默认战术比重（队伍配置缺省时使用）
  defaultTactics: {
    atk: { rush: 0.25, mid: 0.25, lurk: 0.25, fake: 0.25 },
    def: { push: 0.3, hold: 0.4, stack: 0.3 }
  },
  // 道具系统（区域抽象，不做弹道）；每点charge一次使用
  utility: {
    costPerPoint: 300,
    points: { pistol: 1, eco: 0, half: 1, full: 2 }, // 各局型每人的道具点数
    flashReduce: 0.28,     // 闪光降低抢先枪概率（乘道具效率）
    smokeTicks: 12,        // 烟雾持续 tick
    smokeRotateDelay: 2,   // 防守穿越烟雾边每边 +tick
    mollyDelay: 4,         // 燃烧拖延下包 tick（乘道具效率）
    mollyZoneTicks: 6,     // 进点燃烧弹封锁窗口
    reconTick: 14,         // 防守侦察启动 tick（无信息时）
    reconInfo: 4,          // 侦察给出的信息强度
    trapInfo: 4,           // 哨卫警戒给出的信息强度（低于回防阈值，需佐证）
    trapStun: 3,           // 触发警戒的进攻方滞留 tick
    trapAvoidBase: 0.3,    // 进攻方识破警戒的基础概率
    trapAvoidSen: 0.003,   // 每点 SEN 增加识破概率
    stunFirePenalty: 0.3,  // 被震驻时开火概率乘子
    synBase: 0.7,          // 道具效率 = synBase + synCoef*SYN/100
    synCoef: 0.6
  },
  // 英雄池熟练度驱动的突发事件（高光/失误）
  proficiency: {
    popOffIn: 0.022,        // 池内高光概率（关键交火判定）
    popOffOut: 0.01,       // 池外高光概率
    whiffIn: 0.02,        // 池内失误概率
    whiffOut: 0.07,        // 池外失误概率
    popOffMult: 1.6,       // 高光：本次击杀概率乘子
    whiffMult: 0.55        // 失误：本次击杀概率乘子
  },
  // 心态：每选手 [-1,1]，小幅修正战力并调制爆种/爆冷概率
  mentality: {
    combatSwing: 0.05,     // 心态对交火战力的最大修正
    winGain: 0.12,
    lossDrop: 0.12,
    streakBonus: 0.04,     // 连赢/连输每档追加
    gapPressure: 0.05,     // 每落后 3 分追加承压
    killBoost: 0.05,       // 个人击杀升温
    deathDrop: 0.03,       // 白给降温
    eventSwing: 0.8        // 心态对高光/失误概率的调制幅度
  }
};
