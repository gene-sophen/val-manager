// 经济系统：钱包、回合结算、购买策略
// v1 局型规则：手枪局与长枪局为主；混起（强起/半起）只出现在
//   ① 手枪局获胜后的次回合（强起扩大优势）② 对方逼近赛点且己方经济不良（孤注一掷）
const cfg = require('./config');

class Wallet {
  constructor() { this.money = cfg.eco.startMoney; }
}

// 购买结果：{ gun, armor, utils }；团队结果 { plan, reason, loadout }
// ctx: { isPistol, wonPistolFollow, desperate }
function buyPhase(units, ctx) {
  const e = cfg.eco;
  const U = cfg.utility;
  if (ctx.isPistol) {
    for (const u of units) { u.wallet.money = e.startMoney; u.savedGun = null; }
    return {
      plan: 'pistol', reason: 'pistol',
      loadout: units.map(() => ({ gun: 0, armor: 'none', utils: U.points.pistol }))
    };
  }
  const avg = units.reduce((s, u) => s + u.wallet.money, 0) / units.length;
  let plan, reason;
  if (ctx.wonPistolFollow) { plan = 'half'; reason = 'pistol_follow'; }        // ① 手枪局获胜次回合强起
  else if (ctx.desperate && avg < e.fullBuyAvg) { plan = 'half'; reason = 'desperate'; } // ② 孤注一掷
  else if (avg >= e.fullBuyAvg) { plan = 'full'; reason = 'full'; }
  else { plan = 'eco'; reason = 'eco'; }

  const wantUtils = U.points[plan];
  const loadout = units.map((u) => {
    const m = u.wallet.money;
    const buyUtils = (base) => {
      // 道具点在枪械护甲之后按余钱购买
      let utils = 0;
      for (let k = 0; k < wantUtils; k++) {
        if (u.wallet.money - base >= U.costPerPoint) { utils++; base += U.costPerPoint; }
      }
      return utils;
    };
    if (plan === 'full') {
      if (u.savedGun && u.savedGun.gun === 2) {
        const armor = m >= e.heavyArmorCost ? 'heavy' : (m >= e.lightArmorCost ? 'light' : 'none');
        u.wallet.money -= armor === 'heavy' ? e.heavyArmorCost : (armor === 'light' ? e.lightArmorCost : 0);
        const utils = buyUtils(0);
        u.wallet.money -= utils * U.costPerPoint;
        return { gun: 2, armor, utils };
      }
      if (m >= e.rifleCost + e.heavyArmorCost) {
        u.wallet.money -= e.rifleCost + e.heavyArmorCost;
        const utils = buyUtils(0);
        u.wallet.money -= utils * U.costPerPoint;
        return { gun: 2, armor: 'heavy', utils };
      }
      if (m >= e.rifleCost) {
        u.wallet.money -= e.rifleCost;
        const utils = buyUtils(0);
        u.wallet.money -= utils * U.costPerPoint;
        return { gun: 2, armor: 'none', utils };
      }
      // 钱不够的队员半起
      if (m >= e.smgCost + e.lightArmorCost) {
        u.wallet.money -= e.smgCost + e.lightArmorCost;
        const utils = buyUtils(0);
        u.wallet.money -= utils * U.costPerPoint;
        return { gun: 1, armor: 'light', utils };
      }
      return { gun: 0, armor: 'none', utils: 0 };
    }
    if (plan === 'half') {
      if (u.savedGun && u.savedGun.gun >= 1) return { ...u.savedGun, utils: 0 };
      if (m >= e.smgCost + e.lightArmorCost + U.costPerPoint) {
        u.wallet.money -= e.smgCost + e.lightArmorCost + U.costPerPoint;
        return { gun: 1, armor: 'light', utils: 1 };
      }
      if (m >= e.smgCost + e.lightArmorCost) {
        u.wallet.money -= e.smgCost + e.lightArmorCost;
        return { gun: 1, armor: 'light', utils: 0 };
      }
      if (m >= e.smgCost) { u.wallet.money -= e.smgCost; return { gun: 1, armor: 'none', utils: 0 }; }
      return { gun: 0, armor: 'none', utils: 0 };
    }
    // eco：纯存钱，只用保下的枪
    if (u.savedGun) return { ...u.savedGun, utils: 0 };
    return { gun: 0, armor: 'none', utils: 0 };
  });
  // 局型标签直接采用购买决策（v1 规则：混起只由 pistol_follow / desperate 触发）
  return { plan, reason, loadout };
}

// 回合结束经济结算
function settleRound(atkUnits, defUnits, result) {
  const e = cfg.eco;
  const atkWin = result.winner === 'atk';
  const apply = (units, won) => {
    for (const u of units) {
      u.lossStreak = won ? 0 : (u.lossStreak || 0) + 1;
      const gain = won
        ? e.winReward
        : e.lossBase + e.lossStreakStep * Math.min(Math.max(u.lossStreak - 1, 0), e.lossStreakMax);
      u.wallet.money = Math.min(u.wallet.money + gain, e.maxMoney);
    }
  };
  apply(atkUnits, atkWin);
  apply(defUnits, !atkWin);
  // 击杀奖励
  for (const u of [...atkUnits, ...defUnits]) {
    u.wallet.money = Math.min(u.wallet.money + (u.roundKills || 0) * e.killReward, e.maxMoney);
  }
  // 下包奖励与补偿
  if (result.planted) {
    if (result.planter) result.planter.wallet.money = Math.min(result.planter.wallet.money + e.plantReward, e.maxMoney);
    if (!atkWin) for (const u of atkUnits) u.wallet.money = Math.min(u.wallet.money + e.lossPlantBonus, e.maxMoney);
  }
  if (result.defuser) result.defuser.wallet.money = Math.min(result.defuser.wallet.money + e.defuseReward, e.maxMoney);
  // 存活者保留枪械到下一回合（真实规则；保枪决策只影响是否冒险，不影响保留）
  for (const u of [...atkUnits, ...defUnits]) {
    u.savedGun = u.alive ? { gun: u.gun, armor: u.armor } : null;
  }
}

module.exports = { Wallet, buyPhase, settleRound };
