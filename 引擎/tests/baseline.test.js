const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runBatch } = require('../sim');

test('scenario manifest identifies reproducible conditions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../scenarios/manifest.json'), 'utf8'));
  assert.equal(manifest.version, 'prototype-v1');
  assert.equal(new Set(manifest.scenarios.map(s => s.id)).size, manifest.scenarios.length);
  assert.ok(manifest.scenarios.every(s => Number.isInteger(s.seed)));
});

test('same seed and teams reproduce complete no-render match statistics', () => {
  const a = { name: 'A', tiers: ['金', '金', '银', '银', '铜'] };
  const b = { name: 'B', tiers: ['银', '银', '银', '银', '银'] };
  const first = runBatch(a, b, 2, 42);
  const again = runBatch(a, b, 2, 42);
  assert.deepEqual(again, first);
  assert.ok(first.totalRounds >= 2);
});
