const test=require('node:test'),assert=require('node:assert/strict'),H=require('./helpers/live-ui.cjs');
test('new play defaults to 2x; migration changes only the old default preference and respects later manual choices',()=>{
 const x=H.load('playback-default'),R=x.PROTOTYPE_RULES,s=H.begin(x,undefined,false);assert.equal(s.speed,2);
 s.speed=1;delete s.playbackDefaultsVersion;const withoutPreference=v=>{const c=JSON.parse(JSON.stringify(v));delete c.speed;delete c.playbackDefaultsVersion;return c;},before=withoutPreference(s);R.init(s);assert.equal(s.speed,2);assert.deepEqual(withoutPreference(s),before);
 s.speed=1;const saved=JSON.parse(JSON.stringify(s));R.init(saved);assert.equal(saved.speed,1);assert.deepEqual(withoutPreference(saved),before);
});
test('legacy explicit slow/fast choices survive the default migration; invalid speed recovers to 2x',()=>{
 const x=H.load('playback-options');for(const speed of [.5,2,4]){const s=x.DEMO.seed();s.speed=speed;delete s.playbackDefaultsVersion;x.PROTOTYPE_RULES.init(s);assert.equal(s.speed,speed);}const s=x.DEMO.seed();s.speed=6;x.PROTOTYPE_RULES.init(s);assert.equal(s.speed,2);
});
