const test = require('node:test');
const assert = require('node:assert/strict');
const { createState } = require('../state');
const { dispatch, opened, ready } = require('./helpers/season');
test('new careers contain the approved persistent dimensions and clean run resources', () => {
  const state=createState();
  assert.deepEqual(state.career.coach,{战术:50,临场:50,声望:50});
  assert.deepEqual(state.career.familiarity,{});
  assert.deepEqual(state.career.mapKnowledge,{});
  const next=dispatch(state,'begin_run',{runId:'r',seed:1});
  assert.equal(next.activeRun.rulesVersion,'season-2026-v2');
  assert.equal(next.activeRun.phase,'choose-home-team');
  assert.equal(next.activeRun.stageId,'kickoff');
  assert.deepEqual(next.activeRun.starterPacks,[]);
  assert.deepEqual(state.activeRun,null);
});
test('new run carries the coach but resets its roster, and old opening commands are unavailable', () => {
  const state=createState();state.career.coach.战术=70;
  const next=dispatch(state,'begin_run',{runId:'r',seed:2});
  assert.equal(next.activeRun.coach.战术,70);
  assert.equal(next.activeRun.ownedCards.length,0);
  assert.throws(()=>dispatch(next,'open_pack',{region:'PAC'}),/不支持/);
  assert.throws(()=>dispatch(next,'grant_emergency_pack'),/不支持/);
  assert.throws(()=>dispatch(next,'start_match'),/不支持/);
});
test('only opened versions affect album and lineup registration awards no participation honors', () => {
  const first=opened();const next=ready();
  assert.deepEqual(next.career.album,first.career.album);
  assert.deepEqual(next.career.honors,[]);
  assert.deepEqual(next.activeRun.participantSnapshots,[]);
});
