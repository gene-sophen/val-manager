const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryStore, localStorageStore, SAVE_KEY } = require('../storage');
test('save snapshots cannot be changed by callers and commands are unique', () => {
 const store=memoryStore();const command={id:'start',expectedRevision:0,type:'begin_run',payload:{seed:2,runId:'run-2'}};
 const first=store.dispatch(command);first.activeRun.phase='broken';
 assert.equal(store.load().activeRun.phase,'choose-home-team');
 assert.equal(store.dispatch(command).revision,1);
 assert.equal(JSON.parse(store.exportRaw()).activeRun.id,'run-2');
});
test('local storage restores same revision and never overwrites corrupt data', () => {
 const values=new Map(),backend={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const store=localStorageStore(backend);
 store.dispatch({id:'start',expectedRevision:0,type:'begin_run',payload:{seed:8,runId:'local'}});
 assert.equal(localStorageStore(backend).load().activeRun.id,'local');
 values.set(SAVE_KEY,'{broken json');
 assert.throws(()=>store.load(),/JSON/);assert.equal(store.exportRaw(),'{broken json');
 assert.throws(()=>store.dispatch({id:'next',expectedRevision:1,type:'abandon_run'}),/JSON/);
 assert.equal(values.get(SAVE_KEY),'{broken json');
});
