const test = require('node:test');
const assert = require('node:assert/strict');
const { drawPack, packConfig } = require('../packs');
const { stream } = require('../random');

test('CN packs produce ten unique versions and reject other regions', () => {
  for (const region of packConfig.regions) {
    for (const tier of Object.keys(packConfig.tiers)) {
      const cards = drawPack({ region, tier, rng: stream(42, 'pack', 0) });
      assert.equal(cards.length, 10);
      assert.equal(new Set(cards.map(card => card.cardId)).size, 10);
      assert.ok(cards.every(card => card.region === region));
    }
  }
});

test('card pack random sequence is independent from match and growth streams', () => {
  const first = drawPack({ region: 'CN', tier: 'starter', rng: stream(27, 'pack', 0) });
  stream(27, 'match', 0)();
  stream(27, 'growth', 0)();
  const again = drawPack({ region: 'CN', tier: 'starter', rng: stream(27, 'pack', 0) });
  assert.deepEqual(again.map(card => card.cardId), first.map(card => card.cardId));
});

test('starter pack quality rates follow approved weights across seeded samples', () => {
  const counts = { 钻: 0, 金: 0, 银: 0, 铜: 0 };
  for (let i = 0; i < 400; i++) {
    for (const card of drawPack({ region: 'CN', tier: 'starter', rng: stream(99, 'pack', i) })) counts[card.tier]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [rarity, expected] of Object.entries(packConfig.tiers.starter)) {
    assert.ok(Math.abs(counts[rarity] / total - expected) < 0.035, `${rarity} observed ${counts[rarity] / total}`);
  }
});


test('all reinforcement weights match the approved design and second pack never draws bronze', () => {
 assert.deepEqual(packConfig.regions,['CN']);
 assert.deepEqual(packConfig.tiers.enhanced,{钻:0.075,金:0.225,银:0.45,铜:0.25});
 assert.deepEqual(packConfig.tiers.summit,{钻:0.1,金:0.3,银:0.6,铜:0});
 assert.throws(()=>drawPack({region:'PAC',tier:'starter',rng:stream(42,'pack',0)}),/赛区/);
 for(let n=0;n<200;n++)assert.ok(drawPack({region:'CN',tier:'summit',rng:stream(77,'pack',n)}).every(c=>c.tier!=='铜'));
});
