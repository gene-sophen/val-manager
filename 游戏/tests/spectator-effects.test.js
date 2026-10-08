const test=require('node:test'),assert=require('node:assert/strict'),E=require('../spectator-effects');
test('gunfire travels from true muzzle to target then vanishes, seeking is repeatable',()=>{
 const events=[{type:'shot',t:1,x:10,y:20,targetX:110,targetY:20,actorId:'A:0',targetId:'B:0'},{type:'damage',t:1,actorId:'A:0',targetId:'B:0'}];
 assert.equal(E.shots(events,.99).length,0);const a=E.shots(events,1.03)[0];assert(a.end.x>a.start.x);assert(a.start.x>=10&&a.end.x<=110);assert(a.hit);assert.equal(E.shots(events,1.17).length,0);assert.deepEqual(E.shots(events,1.03),[a]);
});
test('skill playback expires at recorded time and resolves old cast positions at cast time',()=>{
 const events=[{type:'ability',t:2,unit:'x',archetype:'recon'},{type:'molly_zone',t:2,x:40,y:60,activeAt:3,until:5},{type:'flash_hit',t:3,x:50,y:60,until:4},{type:'smoke',t:2,x:10,y:20,until:7}];
 const resolve=e=>{assert.equal(e.t,2);return {x:20,y:30};},r=E.abilities(events,3,{},resolve);assert.equal(r.length,4);assert.equal(r.find(e=>e.visual==='cast').x,20);assert.equal(E.abilities(events,8,{},resolve).length,0);assert.equal(E.abilities(events,1,{},resolve).length,0);
});
