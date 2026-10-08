const normalCards = require('../数据源/cards_full.json');
const diamondCards = require('../数据源/diamond_cards.json');

function playerId(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('选手姓名不能为空');
  return name.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function normalizeCard(record, diamond) {
  const id = playerId(record.name);
  const edition = diamond ? `diamond:${encodeURIComponent(record.cut)}` : 'normal';
  const agents = Object.freeze([...(record.agents || [])]);
  return Object.freeze({
    ...record,
    agents,
    playerId: id,
    cardId: `${edition}:${id}`,
    tier: diamond ? '钻' : record.tier,
    rating: diamond ? Math.round(record.TOT / 3) : record.rating
  });
}

const cards = Object.freeze([
  ...normalCards.map(card => normalizeCard(card, false)),
  ...diamondCards.map(card => normalizeCard(card, true))
]);
const byId = new Map(cards.map(card => [card.cardId, card]));
if (byId.size !== cards.length) throw new Error('卡牌 ID 冲突');

function getCard(cardId) {
  const card = byId.get(cardId);
  if (!card) throw new Error(`找不到选手卡版本: ${cardId}`);
  return card;
}

function findByName(name) {
  const id = playerId(name);
  return cards.filter(card => card.playerId === id);
}

function cardsInPool(region, tier) {
  return cards.filter(card => card.region === region && (!tier || card.tier === tier));
}

module.exports = { cards, playerId, getCard, findByName, cardsInPool };
