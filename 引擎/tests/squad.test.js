const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRolePreferences } = require('../squad');

test('player-picked lurker and carrier change real tactical slots', () => {
  const intent = { side: 'atk', family: 'lurk', carrier: 0,
    roles: ['hit', 'hit', 'hit', 'hit', 'lurk'], homes: ['A', 'A', 'A', 'A', 'B'] };
  applyRolePreferences(intent, { lurker: 2, carrier: 3 });
  assert.equal(intent.roles[2], 'lurk');
  assert.equal(intent.homes[2], 'B');
  assert.equal(intent.carrier, 3);
});

test('fake decoy and defensive anchor use chosen players without losing their routes', () => {
  const fake = { side: 'atk', family: 'fake', carrier: 1,
    roles: ['decoy', 'real', 'real', 'real', 'real'], homes: ['false', 'real', 'real', 'real', 'real'] };
  applyRolePreferences(fake, { decoy: 4 });
  assert.equal(fake.roles[4], 'decoy');
  assert.equal(fake.homes[4], 'false');
  const stack = { side: 'def', family: 'stack', carrier: -1,
    roles: ['home', 'home', 'home', 'home', 'anchor'], homes: ['A', 'A', 'A', 'A', 'B'] };
  applyRolePreferences(stack, { anchor: 0 });
  assert.equal(stack.roles[0], 'anchor');
  assert.equal(stack.homes[0], 'B');
});
