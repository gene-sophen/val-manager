const test=require('node:test'),assert=require('node:assert/strict');
const policy=require('../spatial-behavior'),registry=require('../maps/combat-registry'),profiles=require('../maps/balance-profiles');
test('every guard view references physical positions in its own map',()=>{
 for(const [id,p]of Object.entries(profiles)){const map=registry.get(id);for(const [home,targets]of Object.entries(p.guards)){assert(map.postsAt(home).length,id+' '+home);for(const n of targets)assert(map.postsAt(n).length,id+' '+n);}for(const home of p.holdHomes||[])assert(map.postsAt(home).length,id+' '+home);for(const [node,posts]of Object.entries(p.guardPosts||{})){assert.equal(new Set(posts).size,posts.length);for(const post of posts)assert.equal(map.posts[post]?.node,node,id+' '+post);}}
});
test('the covered Fracture corridor is not exposed to spawn while its zipline remains usable',()=>{
 const base=registry.get('fracture'),map=require('../maps/balance-geometry').prepare(base),ct=map.nodes.ct_spawn;
 assert(base.geometry.data.openAirContours.length);assert.equal(map.geometry.data.openAirContours.length,0);
 for(const spawn of ['t_spawn','t_bridge'])assert(!map.geometry.canObserve(map.nodes[spawn],ct));
 assert(map.geometry.data.navigationLinks.some(l=>l.id==='zipline'));
 for(const [a,row]of Object.entries(map.data.staticVisibility))for(const [b,v]of Object.entries(row))assert.equal(v,map.geometry.visibleFraction(map.posts[a],map.posts[b]));
});
function scenario(contacts){
 const map=registry.get('haven'),nodes=['a_site','a_tower','b_site','c_garage','c_site'];
 const def=nodes.map((node,i)=>({id:'d'+i,name:'d'+i,alive:true,node,position:map.nodes[node],syn:70,sen:70}));
 return {map,t:10,def,observations:{def:Object.fromEntries(Array.from({length:contacts},(_,i)=>['a'+i,{node:'a_long',lastSeenTick:10}]))},hasVisibleEnemy:()=>false,emit:()=>{},interruptMove:()=>{},defensiveLosses:{A:[10],B:[],C:[]}};
}
test('Haven confirmed hit can recruit the sole B anchor while retaining one quiet-site anchor',()=>{
 const r=scenario(3);policy.updateDefenseSupport.call(r);assert(r.def[2].supportOrder,'B anchor should reinforce confirmed A hit');assert(r.def.filter(u=>!u.supportOrder&&r.map.region(u.node)!=='A').length>=1);
});
test('an isolated casualty does not empty other sites, and hidden enemies do not trigger rotations',()=>{
 const r=scenario(0);r.defensiveLosses.A=[];policy.updateDefenseSupport.call(r);assert(r.def.every(u=>!u.supportOrder));r.defensiveLosses.A=[10];policy.updateDefenseSupport.call(r);assert(!r.def[2].supportOrder);assert(r.def.some(u=>r.map.region(u.node)==='C'&&!u.supportOrder));
});
test('a visible acquired target survives nearest-enemy changes so the first shot is not starved',()=>{
 const units=[{id:'d',side:'def',position:{x:0,y:0}},{id:'a1',side:'atk',position:{x:30,y:0}},{id:'a2',side:'atk',position:{x:40,y:0}}].map(u=>({...u,name:u.id,alive:true,sen:70,syn:70,aim:70,gun:2,holdTicks:2,post:'held',stun:0,skills:{},utils:0}));
 const shots=[],contacts=[],r={units,t:0,rng:()=>0,map:{data:{strictSpatial:true,behaviorModel:'map-balance-v1'},engagements:{query:()=>({visible:1})}},emit:(type,e)=>{if(type==='contact')contacts.push(e);},tryKill:(u,target)=>shots.push([u.id,target.id]),lastFlashTick:{atk:-99,def:-99}};
 policy.fire.call(r);const ready=units[0].fireReadyAt;units[2].position.x=20;r.t=.25;policy.fire.call(r);assert(shots.some(([u,target])=>u==='d'&&target==='a1'));assert.equal(contacts.filter(e=>e.unitId==='d').length,1);assert(ready<=.25);
 units[1].alive=false;r.t=.5;policy.fire.call(r);assert.equal(units[0].fireTarget,'a2');assert(units[0].fireReadyAt>.5);
});
test('formation spacing is independent of iteration order and never queues behind a dead body',()=>{
 const unit=(id,x)=>({id,side:'atk',alive:true,stun:0,position:{x,y:0},moving:{to:'site',route:[{x,y:0},{x:100,y:0}],total:(100-x)/32,left:(100-x)/32}}),front=unit('front',10),rear=unit('rear',0),r={map:{data:{tickSeconds:.25},nodes:{site:{x:100,y:0}}},units:[front,rear]};
 assert.deepEqual([...policy.formationWaits(r)],['rear']);r.units.reverse();assert.deepEqual([...policy.formationWaits(r)],['rear']);front.alive=false;assert.equal(policy.formationWaits(r).size,0);
 front.alive=true;front.moving.traversal='zipline';assert.equal(policy.formationWaits(r).size,0);
});
test('two converging paths cannot make both teammates wait for one another',()=>{
 const r={map:{data:{tickSeconds:.25},nodes:{site:{x:0,y:0}}},units:['a','b'].map((id,i)=>({id,side:'def',alive:true,stun:0,position:{x:i?7:-7,y:0},moving:{to:'site',route:[{x:i?7:-7,y:0},{x:0,y:0}],total:1,left:1}}))};assert(policy.formationWaits(r).size<2);
});
test('an earlier lethal shot cancels a later shot in the same frame, while equal due times can trade',()=>{
 function fight(equal){
  const units=['def','atk'].map((side,i)=>({id:side,name:side,side,alive:true,hp:100,stun:0,skills:{},utils:0,sen:70,syn:70,aim:70,gun:2,holdTicks:2,post:'held',position:{x:i*30,y:0},fireTarget:i?'def':'atk',fireReadyAt:i&&!equal?.2:.1}));
  const shots=[],r={t:.25,units,rng:()=>0,map:{data:{strictSpatial:true,behaviorModel:'map-balance-v1'},engagements:{query:()=>({visible:1})}},lastFlashTick:{atk:-99,def:-99},emit:()=>{},tryKill(u,target){shots.push(u.side);this._shotBatch.push({att:u,tgt:target,damage:100});},applyKill(u,target){target.alive=false;}};policy.fire.call(r);return {units,shots};
 }
 assert.deepEqual(fight(false).shots,['def']);const simultaneous=fight(true);assert.equal(simultaneous.shots.length,2);assert(simultaneous.units.every(u=>!u.alive));
});
test('a hero cannot invent a missing skill or bypass its depleted charges with generic utility',()=>{
 const abilities=require('../abilities'),u={agent:'捷风',kit:require('../agent_kits.json')['捷风'],utils:3,skills:{}},r={map:{data:{behaviorModel:'map-balance-v1'}},rng:()=>0};
 assert.equal(abilities.triggerCast(r,u,'flash',{},true),null);assert.equal(u.utils,3);
 u.agent='幽影';u.kit=require('../agent_kits.json')['幽影'];u.skills={smoke:{left:0,def:{archetype:'smoke'}}};assert.equal(abilities.triggerCast(r,u,'smoke',{},true),null);assert.equal(u.utils,3);
});
test('prepared head-line precision follows the firing pose and attributes equally on either side',()=>{
 function shot(side,prepared){
  const att={id:'u',name:'u',side,alive:true,gun:2,aim:90,sen:90,holdTicks:prepared?2:0,post:prepared?'p':null,position:{x:0,y:0}},tgt={id:'v',name:'v',side:side==='atk'?'def':'atk',alive:true,hp:100,armor:'heavy',position:{x:30,y:0}};
  const damage=[],random=[0,.4],r={t:0,map:{data:{strictSpatial:true,behaviorModel:'map-balance-v1',combatProfile:'campaign-ballistics',fireModel:'timed-v3'},engagements:{query:()=>({visible:1})},geometry:{lineOfSight:()=>true,visibleFraction:()=>1},nodes:{}},hooks:{beforeKillRoll:[]},rng:()=>random.shift(),emit:(type,e)=>{if(type==='damage')damage.push(e);},applyKill:(a,b)=>{b.alive=false;}};
  require('../combat').fireShot.call(r,att,tgt,false);return damage[0].hitLocation;
 }
 for(const side of ['atk','def']){assert.equal(shot(side,true),'head');assert.equal(shot(side,false),'body');}
});
test('confirmed plant cancels obsolete ground patrols but does not stop a zipline in mid-air',()=>{
 const def=[{id:'ground',alive:true,moving:{},supportOrder:{site:'B'}},{id:'zip',alive:true,moving:{traversal:'zipline'}},{id:'dead',alive:false,moving:{}}],stops=[];
 policy.onPlant({def,interruptMove:u=>{stops.push(u.id);u.moving=null;}});assert.deepEqual(stops,['ground']);assert.equal(def[0].supportOrder,null);assert.equal(def[0].nextThinkAt,0);assert(def[1].moving);assert(def[2].moving);
});
test('retake waits for a second physical teammate, while public elimination bypasses the rally',()=>{
 const map=registry.get('haven'),center=map.nodes[map.data.staging.A],u={id:'d1',alive:true,position:{...center},node:map.data.staging.A},v={id:'d2',alive:false,position:{...center}};
 const r={map,def:[u,v],t:60,planted:true,plantSite:'A',spike:{position:map.nodes.a_site},rules:{defuseTicks:7},spikeLeft:45,flags:{},visibleEnemiesAt:()=>[],emit:()=>{}};
 assert.equal(policy.defCandidates.call(r,u)[0].action,'hold');assert(!r.flags.retakeHit);v.alive=true;assert.equal(policy.defCandidates.call(r,u)[0].action,'approachSpike');assert(r.flags.retakeHit);
 r.flags={siteCleared:true};v.alive=false;assert.equal(policy.defCandidates.call(r,u)[0].action,'approachSpike');
});
test('a controller can smoke a reported entrance before plant without observing hidden positions',()=>{
 const map=registry.get('haven'),skill={left:2,def:{key:'c',name:'smoke',archetype:'smoke',params:{ranged:true}}},u={id:'d',name:'coach-helper',agent:'幽影',alive:true,stun:0,sen:90,syn:90,inPool:true,position:map.nodes.ct_spawn,skills:{c:skill}};
 const reported=map.nodes.a_long,r={map,def:[u],t:10,rng:()=>.5,observations:{def:{known:{id:'known',node:'a_long',lastSeenTick:10,position:{...reported}}}},geometrySmokes:[],stats:{utilsDef:0,utilsByType:{smoke:0},abilityByArchetype:{}},emit:()=>{}};
 policy.defensiveSmoke(r,{site:'A',contacts:2,losses:0});assert.equal(skill.left,1);assert.equal(r.geometrySmokes[0].x,reported.x);assert(r.geometrySmokes[0].defensive);policy.defensiveSmoke(r,{site:'A',contacts:2,losses:0});assert.equal(skill.left,1);
});
test('holding a prepared entrance does not repeatedly replace the selected guard pose with a blind peek',()=>{
 const map=require('../maps/balance-geometry').prepare(registry.get('haven'));map.data={...map.data,behaviorModel:'map-balance-v1'};let peeks=0;
 const r={map,t:0,doors:{},switchStance:()=>{peeks++;return true;},hasVisibleEnemy:()=>false},post=Object.keys(map.posts).find(k=>map.posts[k].peekTo&&policy.keepsAngle(r,{side:'def',role:'home',post:k}));assert(post);
 const u={side:'def',role:'home',post,holdTicks:2,angleCheckedAt:-99};require('../brain').execAction.call(r,u,{action:'hold'});assert.equal(peeks,0);assert.equal(u.post,post);
});
test('two-site deployment assigns the two best primary guards across sites, rather than stacking them together',()=>{
 const map=registry.get('fracture'),intent={homes:['a_site','a_site','ct_spawn','b_site','b_site'],roles:Array(5).fill('home')},units=Array.from({length:5},(_,i)=>({id:'u'+i,sideIdx:i,aim:95-i*5,sen:95-i*5,syn:95-i*5}));policy.deploy(intent,units,map);assert.equal(intent.homes[0],'a_site');assert.equal(intent.homes[1],'b_site');
});
test('Haven allocates a capable sentinel to the lone B anchor before allocating paired A/C fronts',()=>{
 const map=registry.get('haven'),intent={homes:['a_site','a_tower','b_site','c_garage','c_site'],roles:Array(5).fill('home')},units=Array.from({length:5},(_,i)=>({id:'u'+i,sideIdx:i,aim:95-i*3,sen:95-i*3,syn:95-i*3}));Object.assign(units[4],{aim:90,sen:90,syn:90,kit:{skills:[{archetype:'trap'}]}});policy.deploy(intent,units,map);assert.equal(intent.homes[4],'b_site');
});
test('new gunfire shares physical visibility with observation, instead of a second invisible smoke matrix',()=>{
 function shoot(newPolicy,smoke){
  const att={id:'a',name:'a',side:'atk',alive:true,gun:2,aim:80,sen:80,post:'p',holdTicks:2,position:{x:0,y:0}},tgt={id:'d',name:'d',side:'def',alive:true,hp:100,armor:'heavy',post:'q',position:{x:30,y:0}},events=[];
  const r={t:0,map:{data:{strictSpatial:true,behaviorModel:newPolicy?'map-balance-v1':null,combatProfile:'campaign-ballistics',fireModel:'timed-v3'},engagements:{query:()=>({visible:1})},geometry:{lineOfSight:()=>true,visibleFraction:()=>1},nodes:{}},geometrySmokes:smoke?[{x:15,y:0,radius:5,until:10}]:[],sightBlocked:()=>true,hooks:{beforeKillRoll:[]},rng:()=>0,emit:(type,e)=>events.push({type,...e}),applyKill:(a,b)=>{b.alive=false;}};
  require('../combat').fireShot.call(r,att,tgt,false);return events.filter(e=>e.type==='shot').length;
 }
 assert.equal(shoot(true,false),1);assert.equal(shoot(true,true),0);assert.equal(shoot(false,false),0);
});
test('Summit guards do not irreversibly seal their own tower and mid lanes before contact',()=>{
 function run(newPolicy){const base=registry.get('summit'),map=Object.create(base);map.data={...base.data,...(newPolicy?{behaviorModel:'map-balance-v1'}:{})};const d=map.data.doorDefinitions[0],events=[],r={map,t:2,planted:false,doors:{...map.geometry.data.initialDoors},doorClosedOnce:new Set(),doorChangedAt:{},units:[{id:'d',name:'d',side:'def',alive:true,holdTicks:2,position:{...d.controls[0]}}],hasVisibleEnemy:()=>false,emit:(type,e)=>events.push({type,...e})};require('../map-mechanisms').update(r);return events;}
 assert(!run(true).some(e=>e.type==='door_operation'));assert(run(false).some(e=>e.type==='door_operation'));
});
test('Fracture front-pressure keeps exactly one central flex player and both site support positions',()=>{
 const base=registry.get('fracture'),map=Object.create(base);map.data={...base.data,behaviorModel:'map-balance-v1'};
 for(const family of ['push','flank']){const intent=require('../map-tactics').build(map,'def',family,()=>.2);assert.equal(intent.homes.filter(n=>n==='ct_spawn').length,1);assert.equal(intent.homes.filter(n=>n==='a_site').length,2);assert(intent.homes.includes('b_tower'));}
});
test('a burst cannot force an impossible long escape, while a reachable lingering-zone escape remains available',()=>{
 const u={id:'d',side:'def',node:'site',post:'old',position:{x:0,y:0}},zone={owner:{side:'atk'},position:{x:0,y:0},radius:28,activeAt:.5,until:10,burst:true},p={node:'site',x:40,y:0};
 const r={t:0,damageZones:[zone],postOcc:{},map:{posts:{old:{node:'site',x:0,y:0},safe:p},postsAt:()=>['old','safe'],data:{navigationSpeed:{run:32}},geometry:{canObserve:()=>true,route:(a,b)=>[a,b]}}};
 assert.equal(policy.hazardCandidate(r,u),null);zone.burst=false;assert.equal(policy.hazardCandidate(r,u).post,'safe');
 r.map.geometry.route=(a,b)=>[a,{x:0,y:100},b];assert.equal(policy.hazardCandidate(r,u),null);zone.burst=true;zone.activeAt=2;r.map.geometry.route=(a,b)=>[a,b];assert.equal(policy.hazardCandidate(r,u).post,'safe');
});
test('a withdrawal reduces enemy view of the defender, rather than merely blinding the defender',()=>{
 const u={id:'d',alive:true,node:'site',post:'old',position:{x:0,y:0},hp:100,lastShotTick:0},enemies=[{position:{x:50,y:0}},{position:{x:60,y:0}}],posts={old:{x:0,y:0},blind:{x:10,y:0},safe:{x:20,y:0}};
 const r={planted:false,def:[u],postOcc:{},visibleEnemiesAt:()=>enemies,map:{posts,postsAt:()=>Object.keys(posts),geometry:{canObserve:()=>true,route:(a,b)=>[a,b],visibleFraction:(from,to)=>from.x>=50?(to.x===20?.5:1):(from.x===10?0:1)}}};assert.equal(policy.fallback.call(r,u).post,'safe');delete posts.safe;assert.equal(policy.fallback.call(r,u),null);
});
test('the first entrant receives smoke support from the real controller instead of inventing their own smoke',()=>{
 const base=registry.get('haven'),map=Object.create(base);map.data={...base.data,behaviorModel:'map-balance-v1'};
 const entrant={id:'a',name:'entry',side:'atk',alive:true,stun:0,node:'a_site',agent:'捷风',position:map.nodes.a_site,utils:5,skills:{}},skill={left:2,def:{key:'c',name:'real smoke',archetype:'smoke',params:{ranged:true}}},caster={id:'b',name:'controller',side:'atk',alive:true,stun:0,sen:90,syn:90,agent:'幽影',inPool:true,position:map.nodes.ct_spawn,skills:{c:skill}},events=[];
 const r={map,t:10,committedSite:'A',atk:[entrant,caster],rng:()=>.5,smokedEdges:{},smokedSight:{},geometrySmokes:[],edgeKey:(a,b)=>[a,b].sort().join('|'),stats:{utilsAtk:0,utilsByType:{smoke:0},abilityByArchetype:{}},emit:(type,e)=>events.push({type,...e})};
 assert(require('../abilities').onCommitSmoke(r,entrant));assert.equal(skill.left,1);assert.equal(entrant.utils,5);assert(events.some(e=>e.type==='smoke'&&e.by==='controller'));
});
test('a support arrow uses the last reported position with travel time, and ignores stale information',()=>{
 const map=registry.get('haven'),skill={left:2,def:{key:'q',name:'arrow',archetype:'molly',params:{}}},u={id:'d',name:'support',side:'def',agent:'猎枭',alive:true,stun:0,sen:90,syn:90,inPool:true,position:map.nodes.ct_spawn,skills:{q:skill}},reported=map.nodes.a_long;
 const r={map,def:[u],t:10,rng:()=>.5,hasVisibleEnemy:()=>false,observations:{def:{known:{id:'known',node:'a_long',lastSeenTick:10,position:{...reported}}}},stats:{utilsDef:0,utilsByType:{molly:0},abilityByArchetype:{}},emit:()=>{}};
 policy.defensiveArea(r,{site:'A',contacts:2,losses:0});assert.equal(skill.left,1);assert.deepEqual(r.damageZones[0].position,reported);assert(r.damageZones[0].activeAt>r.t+.5);
 r.t=20;r.observations.def.known.lastSeenTick=10;policy.defensiveArea(r,{site:'A',contacts:2,losses:0});assert.equal(skill.left,1);
});
test('Fracture can send one qualified retaker through ropes/drop using remaining time and own positions',()=>{
 const map=registry.get('fracture'),center=map.nodes[map.data.staging.A],def=['one','two'].map((id,i)=>({id,name:id,alive:true,sen:95-i,syn:95-i,gun:2,position:{...center},retakeViaIndex:0}));
 const r={map,def,defFamily:'retake',plantSite:'A',flags:{retakeHit:true},spikeLeft:45,rules:{defuseTicks:7},emit:()=>{}};
 const c=policy.retakeFlank(r,def[0],map.nodes.a_site);assert(c&&c.flank);assert.equal(c.node,'a_rope');assert.equal(policy.retakeFlank(r,def[1],map.nodes.a_site),null);
 r.spikeLeft=1;assert.equal(policy.retakeFlank(r,def[0],map.nodes.a_site),null);
});
test('a regional ability wall creates actual temporary smoke geometry on the new maps',()=>{
 const map=registry.get('breeze'),u={id:'v',name:'v',side:'atk',node:'a_site',position:map.nodes.a_site},events=[],r={map,t:10,geometrySmokes:[],emit:(type,e)=>events.push({type,...e})};policy.wallEffect(r,u,'A',12);
 assert.equal(r.geometrySmokes.length,5);assert(r.geometrySmokes.every(s=>s.wall&&s.until===22));assert.equal(events.filter(e=>e.type==='smoke').length,5);
 const center=r.geometrySmokes[2],a={x:center.x-30,y:center.y},b={x:center.x+30,y:center.y};assert(require('../geometry').lineIntersectsCircle(a,b,center,center.radius));
});
