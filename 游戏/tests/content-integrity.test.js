const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../catalog');
const manifest = require('../content/content-manifest.json');
const rosters = require('../content/rosters/2026-production-v1.json');
const maps = require('../content/maps.json');
const { createState } = require('../state');
const { drawPack, packConfig } = require('../packs');
const { stream } = require('../random');
const { ready } = require('./helpers/season');
test('all twelve playable seats have five resolvable players; global missing data is explicitly blocked', () => {
  assert.equal(rosters.teams.length, 50);
  assert.equal(new Set(rosters.teams.map(t => t.teamId)).size, 50);
  const homes = rosters.teams.filter(t => t.selectable);
  assert.equal(homes.length, 12);
  for (const t of rosters.teams) {
    assert.equal(t.players.length, 5);
    assert.equal(new Set(t.players.map(p => p.playerId)).size, 5);
    for (const p of t.players) if (p.cardId) assert.equal(catalog.getCard(p.cardId).playerId, p.playerId);
  }
  assert.ok(homes.every(t => t.region === 'CN' && !t.entryOnly && t.missingPlayerIds.length === 0));
  assert.deepEqual(rosters.teams.flatMap(t => t.missingPlayerIds).sort(), ['gsr', 'tomaszy']);
  assert.ok(manifest.pending.includes('real-tournaments'));
});
test('nine approved maps are configured but unfinished assets are not labelled playable', () => {
  assert.equal(maps.maps.length, 9);
  assert.equal(new Set(maps.maps.map(m => m.id)).size, 9);
  assert.ok(maps.maps.some(m => m.id === 'fracture'));
  assert.ok(maps.maps.every(m => m.status !== 'ready'));
  assert.equal(maps.activeMapCount, 7);
  assert.equal(maps.rotateCount, 2);
});
test('content manifest hashes all runtime sources; existing player abilities remain unchanged', () => {
  for (const [file, hash] of Object.entries(manifest.hashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../..', file))).digest('hex'), hash, file);
  }
  const baseline = require('../../docs/validation/2026-10-03-rebuild-baseline.json');
  for (const file of ['数据源/cards_full.json', '数据源/diamond_cards.json']) assert.equal(manifest.hashes[file], baseline.hashes[file]);
});
test('a run freezes pool and odds so later catalogue edits cannot alter its reinforcement draws', () => {
  const state = ready();
  const frozen = state.activeRun.contentSnapshot;
  const oddsBefore = packConfig.tiers.summit;
  try {
    packConfig.tiers.summit = { 钻: 0, 金: 0, 银: 0, 铜: 1 };
    const cards = drawPack({ region: 'CN', tier: 'summit', rng: stream(42, 'pack', 4), config: frozen.packs, poolCards: frozen.cards });
    assert.ok(cards.every(c => c.tier !== '铜'));
    assert.equal(frozen.manifest.version, state.activeRun.contentVersion);
  } finally { packConfig.tiers.summit = oddsBefore; }
  assert.equal(createState().schemaVersion, 2);
});
