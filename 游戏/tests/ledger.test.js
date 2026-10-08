const test = require('node:test');
const assert = require('node:assert/strict');
const { createState } = require('../state');
const { settleEvent, createPreview } = require('../ledger');

const event = { runId: 'r', scope: 'series', eventId: 'match-1', participants: ['normal:cb'], payload: { result: 'won' } };
test('event identity prevents duplicate rewards across command ids; changed facts under the same id fail', () => {
  const state = createState();
  const apply = draft => draft.career.honors.push({ id: 'winner' });
  const first = settleEvent(state, event, apply);
  assert.equal(first.applied, true);
  assert.equal(state.career.honors.length, 0);
  const retry = settleEvent(first.state, { ...event, payload: { result: 'won' } }, apply);
  assert.equal(retry.applied, false);
  assert.deepEqual(retry.state, first.state);
  assert.throws(() => settleEvent(first.state, { ...event, payload: { result: 'lost' } }, apply), /冲突/);
});
test('preview can settle temporary events but never update permanent career or source state', () => {
  const state = createState();
  state.activeRun = { id: 'r', value: 0 };
  const preview = createPreview(state);
  const next = settleEvent(preview, event, draft => { draft.activeRun.value++; });
  assert.equal(next.state.activeRun.value, 1);
  assert.equal(state.activeRun.value, 0);
  assert.throws(() => settleEvent(preview, event, draft => draft.career.honors.push({ id: 'fake' })), /预演|生涯/);
  assert.deepEqual(state.ledger, {});
});
test('a failed settlement is atomic and event scopes cannot collide', () => {
  const state = createState();
  assert.throws(() => settleEvent(state, event, draft => { draft.career.honors.push('partial'); throw new Error('failed'); }), /failed/);
  assert.equal(state.career.honors.length, 0);
  assert.deepEqual(state.ledger, {});
  const first = settleEvent(state, event).state;
  const second = settleEvent(first, { ...event, scope: 'map' }).state;
  assert.equal(Object.keys(second.ledger).length, 2);
});
