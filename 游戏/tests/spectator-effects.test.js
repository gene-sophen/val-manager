const test=require('node:test'),assert=require('node:assert/strict'),E=require('../spectator-effects');
test('gunfire travels from true muzzle to target then vanishes, seeking is repeatable',()=>{
 const events=[{type:'shot',t:1,x:10,y:20,targetX:110,targetY:20,actorId:'A:0',targetId:'B:0'},{type:'damage',t:1,actorId:'A:0',targetId:'B:0'}];
 assert.equal(E.shots(events,.99).length,0);const a=E.shots(events,1.03)[0];assert(a.end.x>a.start.x);assert(a.start.x>=10&&a.end.x<=110);assert(a.hit);assert.equal(E.shots(events,1.17).length,0);assert.deepEqual(E.shots(events,1.03),[a]);
});
test('skill playback expires at recorded time and resolves old cast positions at cast time',()=>{
 const events=[{type:'ability',t:2,unit:'x',archetype:'recon'},{type:'molly_zone',t:2,x:40,y:60,activeAt:3,until:5},{type:'flash_hit',t:3,x:50,y:60,until:4},{type:'smoke',t:2,x:10,y:20,until:7}];
 const resolve=e=>{assert.equal(e.t,2);return {x:20,y:30};},r=E.abilities(events,3,{},resolve);assert.equal(r.length,4);assert.equal(r.find(e=>e.visual==='cast').x,20);assert.equal(E.abilities(events,8,{},resolve).length,0);assert.equal(E.abilities(events,1,{},resolve).length,0);
});
test('objective follows planting, defuse checkpoints, interruption and terminal states',()=>{
 const events=[{type:'round_start',t:0},{type:'plant_start',t:5},{type:'plant',t:9,site:'A',node:'a',x:10,y:20,spikeTicks:43},{type:'defuse_start',t:20,seconds:7},{type:'defuse_checkpoint',t:24,seconds:3.5},{type:'defuse_abort',t:25},{type:'defuse_start',t:26,seconds:3.5},{type:'defuse',t:30},{type:'round_end',t:30,reason:'defuse'}],map={nodes:{a:{x:10,y:20}},roundRules:{defuseTicks:7,plantTicks:4}};
 assert.equal(E.objective(events,6,map).state,'planting');assert.equal(E.objective(events,10,map).state,'planted');assert.equal(E.objective(events,21,map).state,'defusing');assert.equal(E.objective(events,25,map).state,'planted');assert.equal(E.objective(events,27,map).state,'defusing');assert.equal(E.objective(events,30,map).state,'defused');assert.equal(E.objective(events,30,map).remaining,0);
 assert.equal(E.objective([{type:'plant',t:2,site:'B',spikeTicks:43},{type:'round_end',t:40,reason:'explosion'}],40,map).state,'exploded');
 assert.equal(E.objective([{type:'plant',t:2,site:'B',spikeTicks:43},{type:'round_end',t:20,reason:'elimination'}],20,map).state,'ended');assert.equal(E.objective([{type:'plant',t:2,site:'B',spikeTicks:43},{type:'round_end',t:20,reason:'defuse'}],20,map).state,'defused');
});
