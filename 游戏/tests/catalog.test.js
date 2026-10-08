const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../catalog');
const { resolveTeam } = require('../../引擎/teams');

test('all normal and diamond cards have distinct version IDs and shared player IDs', () => {
  assert.equal(catalog.cards.length, 404);
  assert.equal(new Set(catalog.cards.map(c => c.cardId)).size, 404);
  assert.equal(catalog.cards.filter(c => c.tier === '钻').length, 20);
  const versions = catalog.findByName('nAts');
  assert.ok(versions.some(c => c.tier === '钻'));
  assert.ok(versions.some(c => c.tier !== '钻'));
  assert.equal(new Set(versions.map(c => c.playerId)).size, 1);
});

test('explicit diamond card ID reaches match team parser', () => {
  const diamond = catalog.findByName('nAts').find(c => c.tier === '钻');
  const team = resolveTeam({ name: 'test', players: [diamond.cardId] }, () => 0.5);
  assert.equal(team.players[0].cardId, diamond.cardId);
  assert.equal(team.players[0].tier, '钻');
  assert.ok(team.players[0].AIM > 0);
});

test('catalog source records are immutable', () => {
  const card = catalog.cards[0];
  assert.ok(Object.isFrozen(card));
  assert.ok(Object.isFrozen(card.agents));
  assert.ok(catalog.cardsInPool('CN', '金').length > 0);
});
