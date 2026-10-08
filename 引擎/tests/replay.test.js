const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshotAt } = require('../snapshot');
const map = require('../maps/ascent.json');

test('recorded routes and stable unit IDs reconstruct a replay without engine execution', () => {
  const events = [
    { t: 0, type: 'round_start', units: [
      { id: 'A:0', name: 'same', side: 'atk', node: 'a_main', hp: 100 },
      { id: 'B:0', name: 'same', side: 'def', node: 'a_lobby', hp: 100 }
    ] },
    { t: 0, type: 'move', unit: 'same', unitId: 'A:0', from: 'a_main', to: 'a_lobby', ticks: 2,
      route: [{ x: 95, y: 600 }, { x: 115, y: 450 }] },
    { t: 1, type: 'damage', targetId: 'A:0', target: 'same', hp: 57 },
    { t: 1, type: 'kill', victimId: 'B:0', victim: 'same', x: 115, y: 450 }
  ];
  const one = snapshotAt(events, 1, map);
  assert.deepEqual(one.units['A:0'].position, { x: 105, y: 525 });
  assert.equal(one.units['A:0'].hp, 57);
  assert.equal(one.units['B:0'].alive, false);
  assert.equal(snapshotAt(events, 2, map).units['A:0'].node, 'a_lobby');
  assert.deepEqual(snapshotAt(structuredClone(events), 1, map), one);
});

test('saved replay restores a revived unit and the shooter ammunition', () => {
  const events = [
    { t: 0, type: 'round_start', units: [
      { id: 'A:0', name: 'same', side: 'atk', node: 'a_main', hp: 100, ammo: 25 },
      { id: 'B:0', name: 'same', side: 'def', node: 'a_site', hp: 100, ammo: 25 }
    ] },
    { t: 1, type: 'shot', actorId: 'A:0', actor: 'same', targetId: 'B:0', target: 'same', ammo: 24 },
    { t: 1, type: 'kill', victimId: 'B:0', victim: 'same' },
    { t: 3, type: 'ability', archetype: 'revive', done: true, side: 'def',
      unitId: 'B:0', unit: 'same', hp: 100, node: 'a_site' }
  ];
  assert.equal(snapshotAt(events, 2, map).units['B:0'].alive, false);
  const revived = snapshotAt(events, 3, map).units;
  assert.equal(revived['A:0'].ammo, 24);
  assert.equal(revived['A:0'].alive, true);
  assert.equal(revived['B:0'].alive, true);
  assert.equal(revived['B:0'].hp, 100);
  assert.deepEqual(revived['B:0'].position, { x: map.nodes.a_site.x, y: map.nodes.a_site.y });
});
