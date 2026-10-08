const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),O=require('../round-outcome'),P=require('../../引擎/agent-autonomy');
const cards=require('../catalog').cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team=id=>({id,players:cards,team:{羁绊:40,状态:50,熟练:50},coach:{战术:65,临场:60,声望:70}}),fake={attack:[2,0,1,3,4],defense:[1,0,2,3,4]};
test('feint opens with separate early movement, autonomous choices and identical journal restoration',()=>{
 const a=team('A'),b=team('B'),m=O.create('autonomy-open','split');S.initialize(m,a,b,fake,null,{version:6,behaviorVersion:'split-balance-3'});m.spatial.initial.home.tactics.atk={fake:1,rush:0,mid:0,lurk:0,contact:0};S.step(m,a,b,fake);const ev=m.replay.events,start=ev.find(e=>e.type==='round_start');assert.equal(start.atkFamily,'fake');
 for(const u of start.units.filter(u=>u.side==='atk')){const move=ev.find(e=>e.type==='move'&&e.unitId===u.id);assert(move,u.name);assert(move.t<=2,u.name+' waited until '+move.t);}
 assert(ev.some(e=>e.type==='agent_decision'&&e.reason==='check-angle'));assert(ev.some(e=>e.type==='agent_decision'&&e.reason==='early-map-control'));assert.equal(S.replayMap(m.replay).combatSpaceVersion,'connected-body-1');
 const copy=structuredClone(m);assert.deepEqual(S.step(m,a,b,fake),S.step(copy,a,b,fake));assert.deepEqual(m.replay,copy.replay);
});
test('coordination chooses an actually visible teammate target instead of a hidden enemy',()=>{
 const u={id:'A:0',side:'atk',sideIdx:0,position:{x:0,y:0},syn:80,sen:80,hp:100},mate={id:'A:1',side:'atk',alive:true,position:{x:10,y:0},fireTarget:'B:1',lastShotTick:0},near={id:'B:0'},trade={id:'B:1'},r={t:1,units:[u,mate],visibleEnemiesAt:()=>[near,trade],map:{data:{id:'split'}},emit:()=>{}};
 assert.equal(P.atkCandidates.call(r,u)[0].reason,'trade-cover');assert.equal(u.agentTarget,'B:1');r.visibleEnemiesAt=()=>[near];P.atkCandidates.call(r,u);assert.equal(u.agentTarget,null);
});
test('lurk staging never skips the first site and advances through CT before execution',()=>{
 const u={id:'A:0',side:'atk',sideIdx:0,syn:80,sen:80,role:'lurk',node:'b_main',routeProg:1,position:{x:0,y:0}},r={t:3,units:[u],atk:[u],spike:{carrier:u},atkIntent:{pace:{commitTick:35},routes:{lurk:['t_spawn','b_main','b_site','ct_spawn','a_site']},limitIdx:{lurk:0}},map:{data:{id:'split',autonomyModel:'agents-1',sites:{A:'a_site',B:'b_site'}},region:()=> 'B'},visibleEnemiesAt:()=>[],emit:()=>{}};
 assert.equal(P.atkCandidates.call(r,u)[0].action,'agentHold');
});
test('covering an active defuser remains an objective instead of an idle duel',()=>{
 const u={id:'A:0',side:'def',sideIdx:0,position:{x:200,y:0}},r={t:30,planted:true,plantSite:'A',spike:{position:{x:0,y:0}},defuser:{alive:true,defusing:5},map:{data:{id:'ascent'},siteNode:()=> 'a_site'},visibleEnemiesAt:()=>[{id:'B:0'}]};
 assert.equal(P.defCandidates.call(r,u)[0].action,'hold');assert.equal(P.defCandidates.call(r,u)[0].guardSpike,true);
});
test('a fresh allied contact keeps a prepared guard on its angle; quiet checks remain physical',()=>{
 const u={id:'B:0',side:'def',sideIdx:0,sen:80,syn:80,alive:true,node:'a_site',post:'anchor',position:{x:0,y:0},lastShotTick:-99,agentMemory:{phase:'hold',nextAngleAt:0}},r={t:20,units:[u],postOcc:{anchor:u},observations:{def:{enemy:{lastSeenTick:20,node:'a_main',position:{x:20,y:0}}}},map:{data:{id:'ascent'},region:()=> 'A',posts:{anchor:{x:0,y:0,node:'a_site'}},postsAt:()=>['anchor'],geometry:{heightAt:()=>0,canWalk:()=>true,visibleFraction:()=>1}},visibleEnemiesAt:()=>[],emit:()=>{}};
 assert.equal(P.defCandidates.call(r,u),null,'leave the normal prepared hold/support policy in control');r.observations.def={};const c=P.defCandidates.call(r,u)[0];assert.equal(c.action,'agentMove');assert(Math.hypot(c.goal.x,c.goal.y)<=6);assert.equal(c.reason,'check-angle');
});
test('moving to a named stance reserves that stance and earns it only on arrival',()=>{
 const u={id:'A:0',side:'atk',sideIdx:0,sen:80},r={t:5,postOcc:{},map:{geometry:{canWalk:()=>true}},moveToPosition:(unit)=>{unit.moving={};return true;},emit:()=>{}};
 assert(P.execute.call(r,u,{action:'agentMove',goal:{x:10,y:0},post:'new-angle',reason:'check-angle'}));assert.equal(r.postOcc['new-angle'],u);assert.equal(u.moving.post,'new-angle');assert.equal(u.post,undefined);
});
test('a three-unit defensive shoulder check physically returns to its prepared stance',()=>{
 const u={id:'B:0',side:'def',sideIdx:0,sen:80,alive:true,node:'a_site',position:{x:3,y:0},agentMemory:{phase:'peek',until:10,anchor:{x:0,y:0},anchorPost:'anchor'}},r={t:11,units:[u],postOcc:{},map:{data:{id:'ascent'},geometry:{canWalk:()=>true}},visibleEnemiesAt:()=>[],emit:()=>{}};
 const c=P.defCandidates.call(r,u)[0];assert.equal(c.action,'agentMove');assert.equal(c.returning,true);assert.equal(c.post,'anchor');assert.deepEqual(c.goal,{x:0,y:0});
});
