const test = require('node:test');
const assert = require('node:assert/strict');
const { visibleFamiliarity, bondValue, pairKey, applyRosterBase } = require('../team-base');
const cards = Array.from({ length: 6 }, (_, i) => ({ cardId: `normal:p${i}`, playerId: `p${i}`, team: `T${i}` }));
const instances = cards.map((c, i) => ({ cardId: c.cardId, instanceId: `i${i}` }));
const lineup = ids => ({ instanceIds: ids.map(i => `i${i}`) });
const career = () => ({ familiarity: {} });
function fixture() {
  return { contentSnapshot: { cards: structuredClone(cards) }, ownedCards: instances.slice(0, 5),
    registeredLineup: lineup([0, 1, 2, 3, 4]), coach: { 战术: 50 },
    team: { 羁绊: 20, 状态: 43, 熟练: 70 }, relationships: {} };
}
test('base bond distinguishes strangers, real teammates and bounded persistent familiarity', () => {
  assert.equal(bondValue(cards.slice(0, 5), career(), {}), 20);
  assert.equal(bondValue(cards.slice(0, 5).map(c => ({ ...c, team: 'EDG' })), career(), {}), 40);
  assert.equal(visibleFamiliarity(40), 50);
  assert.equal(visibleFamiliarity(120), 75);
  const known = { familiarity: Object.fromEntries(cards.map(c => [c.playerId, 40])) };
  assert.equal(bondValue(cards.slice(0, 5), known, {}), 27.5);
  assert.throws(() => visibleFamiliarity(-1), /非负/);
});
test('replacing one player preserves six pair relationships and four fifths of learned mastery', () => {
  const run = fixture();
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) run.relationships[pairKey(`p${i}`, `p${j}`)] = 20;
  applyRosterBase(run, career(), lineup([0, 1, 2, 3, 5]), instances);
  assert.equal(run.team.羁绊, 25.4);
  assert.equal(run.team.熟练, 66);
  assert.equal(run.team.状态, 43);
  assert.equal(run.relationships[pairKey('p0', 'p4')], 20);
  assert.equal(run.relationships[pairKey('p0', 'p5')], 0);
});
test('keeping all five awards no recruitment growth and player identity survives card version changes', () => {
  const run = fixture();
  applyRosterBase(run, career(), lineup([0, 1, 2, 3, 4]), instances);
  assert.equal(run.team.熟练, 70);
  const edition = { ...cards[4], cardId: 'diamond:p4' };
  run.contentSnapshot.cards.push(edition);
  const variants = [...instances, { cardId: edition.cardId, instanceId: 'new-p4' }];
  applyRosterBase(run, career(), { instanceIds: ['i0', 'i1', 'i2', 'i3', 'new-p4'] }, variants);
  assert.equal(run.team.熟练, 70);
  assert.equal(run.relationships[pairKey('p0', 'p4')], 0);
});
