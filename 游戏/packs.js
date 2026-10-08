const catalog = require('./catalog');
const packConfig = require('./content/packs.json');

function drawPack({ region, tier, rng, ownedPlayerIds = [], minimumDistinct = 0, config = packConfig, poolCards = catalog.cards }) {
  if (!config.regions.includes(region)) throw new Error(`无效的卡包赛区: ${region}`);
  const odds = config.tiers[tier];
  if (!odds) throw new Error(`无效的卡包档位: ${tier}`);
  if (typeof rng !== 'function') throw new Error('抽卡需要显式随机序列');
  const pools = Object.fromEntries(Object.keys(odds).map(rarity => [rarity, poolCards.filter(c => c.region === region && c.tier === rarity)]));
  const picked = [];
  const distinct = new Set(ownedPlayerIds);
  for (let i = 0; i < config.cardsPerPack; i++) {
    const needDistinct = distinct.size < minimumDistinct;
    const choices = Object.entries(odds).filter(([rarity, chance]) => chance > 0 && pools[rarity].some(card => !needDistinct || !distinct.has(card.playerId)));
    const weight = choices.reduce((sum, [, chance]) => sum + chance, 0);
    if (weight <= 0) throw new Error('赛区卡池不足十张');
    let roll = rng() * weight;
    let rarity = choices[choices.length - 1][0];
    for (const [candidate, chance] of choices) {
      roll -= chance;
      if (roll < 0) { rarity = candidate; break; }
    }
    const pool = pools[rarity];
    const eligible = pool.filter(card => !needDistinct || !distinct.has(card.playerId));
    const pick = eligible[Math.floor(rng() * eligible.length)];
    pool.splice(pool.indexOf(pick), 1);
    picked.push(pick);
    distinct.add(pick.playerId);
  }
  return picked;
}

module.exports = { drawPack, packConfig };
