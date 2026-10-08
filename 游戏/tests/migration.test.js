const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateState, createState } = require('../state');
const { localStorageStore, memoryStore, SAVE_KEY, LEGACY_KEY } = require('../storage');
const { createState: createLegacy } = require('../legacy/state');
function backend() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test('v1 career facts and whole active run are archived without inventing a 2026 result', () => {
  const old = createLegacy();
  old.activeRun = { id: 'old-run', fixtureIndex: 2, results: [{ winner: 'A' }] };
  old.career.album = { 'normal:cb': 2 };
  old.career.honors = [{ id: 'old-honor' }];
  const before = structuredClone(old);
  const next = migrateState(old);
  assert.equal(next.schemaVersion, 2);
  assert.equal(next.activeRun, null);
  assert.deepEqual(next.career.album, old.career.album);
  assert.deepEqual(next.career.honors, old.career.honors);
  assert.equal(next.career.runHistory.length, 0);
  assert.deepEqual(next.legacyArchives[0].snapshot, before);
  assert.deepEqual(old, before);
  assert.deepEqual(migrateState(next), next);
});
test('local storage migrates once to a different key and keeps exact original bytes', () => {
  const io = backend(), old = createLegacy();
  old.activeRun = { id: 'old', seed: 42 };
  const raw = JSON.stringify(old, null, 4);
  io.setItem(LEGACY_KEY, raw);
  const store = localStorageStore(io);
  const next = store.load();
  assert.equal(next.schemaVersion, 2);
  assert.equal(io.getItem(LEGACY_KEY), raw);
  assert.equal(store.exportLegacyRaw(), raw);
  assert.ok(io.getItem(SAVE_KEY));
  assert.equal(localStorageStore(io).load().legacyArchives.length, 1);
});
test('corrupt and unsupported v2 saves are exportable and never silently reset', () => {
  for (const raw of ['{bad json', '{"schemaVersion":99}', '{"schemaVersion":2}']) {
    const io = backend(); io.setItem(SAVE_KEY, raw);
    const store = localStorageStore(io);
    assert.throws(() => store.load());
    assert.equal(store.exportRaw(), raw);
    assert.equal(io.getItem(SAVE_KEY), raw);
  }
});
test('memory store isolates snapshots and preserves legacy input for export', () => {
  const legacy = createLegacy(), store = memoryStore(legacy);
  const value = store.load(); value.career.album.fake = 100;
  assert.equal(store.load().career.album.fake, undefined);
  assert.deepEqual(JSON.parse(store.exportLegacyRaw()), legacy);
  assert.equal(memoryStore(createState()).exportLegacyRaw(), null);
});
