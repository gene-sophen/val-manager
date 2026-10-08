const test = require('node:test');
const assert = require('node:assert/strict');
const { opened } = require('./helpers/season');
const { registerFive } = require('../roster');
test('v2 roster rejects two diamonds, shared player versions and non-CN candidates', () => {
  const run = opened().activeRun;
  const cards = run.contentSnapshot.cards;
  const diamonds = cards.filter(c => c.tier === '钻' && c.region === 'CN');
  const d1 = diamonds[0], d2 = diamonds.find(c => c.playerId !== d1.playerId);
  const normal = cards.filter(c => c.region === 'CN' && c.tier !== '钻' && c.playerId !== d1.playerId && c.playerId !== d2.playerId).slice(0, 3);
  const attempt = picks => {
    const candidates = picks.map((c, i) => ({ instanceId: `test-${i}`, cardId: c.cardId }));
    return registerFive(run, { instanceIds: candidates.map(c => c.instanceId) }, candidates);
  };
  assert.throws(() => attempt([d1, d2, ...normal]), /最多一张钻/);
  assert.throws(() => attempt([d1, cards.find(c => c.playerId === d1.playerId && c.tier !== '钻'), ...normal]), /同名/);
  assert.throws(() => attempt([d1, cards.find(c => c.region === 'PAC'), ...normal]), /CN/);
});
