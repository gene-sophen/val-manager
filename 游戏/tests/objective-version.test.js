const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),S=require('../spatial-match');
test('a pre-fix journal keeps its original next round instead of silently changing behavior',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-06-portrait-defuse/legacy-journal.json'),'utf8'));
 assert.equal(fixture.map.spatial.initial.behaviorVersion,undefined);S.step(fixture.map,fixture.home,fixture.away,fixture.priority);assert.deepEqual(fixture.map.replay,fixture.expected);
});
test('an unknown behavior revision is rejected before a cached session can advance',()=>{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-06-portrait-defuse/legacy-journal.json'),'utf8'));f.map.spatial.initial.behaviorVersion='future';const before=JSON.stringify(f.map);assert.throws(()=>S.step(f.map,f.home,f.away,f.priority),/行为版本/);assert.equal(JSON.stringify(f.map),before);
});
test('Ascent behavior cannot be inserted into a different map',()=>{const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-06-portrait-defuse/legacy-journal.json'),'utf8')),m=require('../round-outcome').create('wrong-behavior','haven'),before=JSON.stringify(m);assert.throws(()=>S.initialize(m,f.home,f.away,f.priority,null,{version:6,behaviorVersion:'ascent-balance-3'}),/行为版本/);assert.equal(JSON.stringify(m),before);});
test('the prior Ascent revision restores the same next round after area skills are introduced',()=>{const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-06-ascent-balance/ascent-v3-journal.json'),'utf8'));assert.equal(f.map.spatial.initial.behaviorVersion,'ascent-balance-3');S.step(f.map,f.home,f.away,f.priority);assert.deepEqual(f.map.replay,f.expected);});
test('the frozen Ascent v4 journal is unaffected by the multimap dispatcher',()=>{const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-07-multimap-balance/ascent-v4-journal.json'),'utf8'));S.step(f.map,f.home,f.away,f.priority);assert.deepEqual(f.map.replay,f.expected);});
test('multimap revisions reject wrong maps before initializing a journal',()=>{const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-06-portrait-defuse/legacy-journal.json'),'utf8')),m=require('../round-outcome').create('wrong-multi','lotus'),before=JSON.stringify(m);assert.throws(()=>S.initialize(m,f.home,f.away,f.priority,null,{version:6,behaviorVersion:'haven-balance-1'}),/行为版本/);assert.equal(JSON.stringify(m),before);});
test('all eight objective-2 journals restore their exact original next round',()=>{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/validation/2026-10-07-multimap-balance/objective-2-journals.json'),'utf8'));
 for(const row of f.fixtures){S.step(row.map,f.home,f.away,f.priority);assert.deepEqual(row.map.replay,row.expected,row.id);}
});
