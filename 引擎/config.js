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
    entryShotBase: 0.55,    // 架点者对进点者抢先一枪的基础概率
    entryShotSen: 0.002,    // 每点 SEN 增加抢先概率
    entryBonus: 1.6,       // 抢先一枪的伤害乘子
    tradeBase: 0.4,        // 补枪基础概率（乘 SYN/100）
    syncReduce: 0.003,      // 同步进点（>=2人同到）按平均 SYN 降低被抢先概率
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
  // 教练系统（coach.js）：赛前布置 / 局间暂停 / 中场调整 / IGL 任命
  coach: {
    tacticsDefault: 60,     // 缺省三维（战术/声望/临场，本期只有战术维生效）
    timeouts: 2,            // 每队局内暂停次数（中场暂停另计 1 次）
    readBase: 0.55,         // 暂停读取对手倾向的准确率 = readBase + (战术-30)*readTacticsCoef
    readTacticsCoef: 0.008, // 战术 99 → 1.10(封顶)，战术 30 → 0.55
    counterShift: 0.25,     // 暂停调整后克制族比重提升量（过大暴露倾向会被对手教练反读）
    timeoutComposure: 0.2,  // 暂停稳心态：叫暂停方全员心态回升（打断对手势头）
    loseStreakTrigger: 2,   // AI 教练：连败 N 局叫暂停
    sameFamilyTrigger: 4,   // AI 教练：对手同族连续 N 回合叫暂停
    iglSwapGap: 4,          // 中场落后 N 分考虑换 IGL（换帅求变）
    // 赛前布置：战术分越高，初始比重越贴近版本强势族（meta），k = (战术-30)/69*metaBlend
    metaBlend: 0.65,
    metaAtk: { rush: 0.45, mid: 0.1, lurk: 0.1, fake: 0.3 },  // 依 BALANCE 各族回合胜率
    metaDef: { push: 0.25, hold: 0.25, stack: 0.5 },
    // 克制表（依据 BALANCE 克制矩阵）：对手守族 -> 我方攻族 / 对手攻族 -> 我方守族
    counterAtk: { push: 'rush', hold: 'rush', stack: 'mid' },
    counterDef: { rush: 'stack', mid: 'push', lurk: 'stack', fake: 'stack' }
  },
  // 战术意图先验（tactics.js）：各族节奏时点与道具倾向，输出意图而非指令链
  tactics: {
    rush: { contactTick: 0, commitTick: 0, utilPosture: 0.8 },      // 爆弹冲点：立即全员直冲
    mid:  { contactTick: 12, contactJit: 5, commitLag: 6, utilPosture: 0.5 }, // 中控后读取弱点，commit=contact+lag
    lurk: { contactTick: 25, contactJit: 8, commitLag: 4, utilPosture: 0.4 },  // 边线渗透：慢热后一波
    fake: { utilPosture: 0.5 },                                     // 假打时点沿用 fake 组
    push: { roamTick: 45, utilPosture: 0.4 },                       // 防守前压：roamTick 后向匪家游猎
    hold: { utilPosture: 0.5 },
    stack: { utilPosture: 0.7 }                                     // 赌点：道具全押
  },
  // 个体效用 AI（brain.js）：每个选手每 thinkInterval tick 独立决策
  // 打分 = 战术意图先验 × (0.5 + 决策质量) + 态势项 + 个性项 + 执行偏差噪声
  brain: {
    thinkInterval: 3,     // 思考间隔（tick）
    noiseCoef: 0.03,      // 执行偏差噪声幅度 = (100-SEN)*noiseCoef，SEN 越低决策越摇摆
    postCoverW: 1.0,      // 选位评分：掩体质量权重
    postSightW: 0.05,     // 选位评分：每多一条可用枪线的权重（掩体主导，枪线只做同档 tiebreak）
    postPickBase: 0.30,   // 选位决策质量 = postPickBase + postPickRange*(SEN-30)/66
    postPickRange: 0.68,  // SEN 99 时 0.98 选中最优槽，SEN 30 时 0.30（低 SEN 常站开阔位）
    priorBase: 2.0,       // 符合战术意图的动作基础分
    peekAimW: 0.04,       // 个性：peek 加分 = (AIM-70)*peekAimW（炮台选手爱主动对枪）
    followSynW: 0.03,     // 个性：协同动作加分 = (SYN-70)*followSynW
    saveLeadW: 1.5,       // 保枪倾向：人数劣势权重
    timePushW: 0.08,      // 时间压力：越过安全线后每 tick 进攻推进加分
    crossFireResist: 0.65, // 跨节点枪线交火：按目标暴露度减免击杀概率
    crossFireProb: 0.3    // 跨节点枪线每 tick 实际交火概率（架枪并非时刻开火）
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
  // IGL 指挥加成（队内 IGL 存活时生效；强度按 IGL 本人 SEN/SYN 缩放，70 为基准）
  igl: {
    syncSynBonus: 14,       // 同步进点等效 SYN 加成
    rotateTicksMult: 0.88,  // 回防/转点耗时乘子（按 IGL SYN/70 缩放）
    fakeReadBonus: 0.10,    // 识破/假打质量加成（按 IGL SEN/70 缩放）
    readBonus: 0.10,        // 中路读取等战术决策质量加成
    priorBoost: 0.18,       // IGL 存活时队友的战术意图先验倍率（按 IGL SEN/70 缩放）
    aimPenalty: 0.98        // IGL 自身击杀概率乘子基准（实际代价再按 70/SEN 缩放）
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
  // 英雄技能系统（abilities.js + agent_kits.json）：原型族默认数值；kit params 可覆盖
  abilities: {
    fumbleMult: 1.0,      // 释放失误概率 = proficiency.whiffIn/whiffOut × fumbleMult（心态调制）
    fumblePower: 0.4,     // 失误时效果倍率
    smokeSightTicks: 10,  // 烟雾封枪线持续 tick（复用 utility.smokeTicks 作边封锁）
    wallTickDelay: 2,     // 穿越墙体封锁边的额外耗时
    stunTicks: 2,         // 震荡滞留 tick
    turretKillP: 0.04,    // 炮台每 2 tick 对每个可见敌人的击杀判定
    turretInfo: 2,        // 炮台预警信息强度
    reviveDelay: 3,       // 复活落地延迟 tick
    reviveStun: 3,        // 复活落地滞留 tick
    decoyInfo: 3,         // 假身动静的信息强度（可疑标记）
    aimbuffTicks: 8,      // 自增益持续 tick
    aimbuffMult: 1.15,    // 自增益击杀概率乘子
    mollyDenyDelay: 4,    // 守包燃烧对拆包开始的额外拖延
    healResist: 0.08,     // 治疗后短期受击减免
    healMentality: 0.2,   // 治疗心态恢复
    healTicks: 12,        // 治疗增益默认持续 tick
    atkReconReadP: 0.85   // 进攻侦察揭示后改打薄弱点的概率
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
