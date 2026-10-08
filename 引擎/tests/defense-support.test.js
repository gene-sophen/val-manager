const test=require('node:test'),assert=require('node:assert/strict');
const {RoundSim}=require('../round'),{GameMap}=require('../gamemap');
const data=require('../maps/ascent-navigation.json'),geometry=require('../maps/ascent-navigation-geometry.json');
function setup(){
 const map=new GameMap(data,geometry),events=[];
 const locations=['a_site','a_heaven','mid_bottom','b_site','market'];
 const def=locations.map((node,i)=>({id:'B:'+i,name:'def'+i,side:'def',node,homeNode:node,alive:true,
  position:{x:map.nodes[node].x,y:map.nodes[node].y},sen:80,syn:80,aim:80,stun:0,gun:2,ammo:25,hp:100,
  holdTicks:3,role:'home',roundKills:0,utils:0,mentality:0}));
 const round=Object.create(RoundSim.prototype);
 Object.assign(round,{map,def,atk:[],units:def,t:10,planted:false,defInfo:{A:{strength:0,tick:-99},B:{strength:0,tick:-99}},
  observations:{def:{},atk:{}},defIntent:{family:'hold'},postOcc:{},occ:Object.fromEntries(Object.keys(map.nodes).map(n=>[n,new Set(def.filter(u=>u.node===n))])),
  rng:()=>.1,hooks:{beforeKillRoll:[],onKill:[]},spike:{},smokedEdges:{},walledEdges:{},smokedSight:{},reviveQueue:[],tradeQueue:[],
  emit:(type,e)=>events.push({type,t:round.t,...e}),hasVisibleEnemy:()=>false});
 return {round,def,events};
}
test('a known site casualty calls support before plant and retains the opposite anchor',()=>{
 const {round:r,def:d,events}=setup();d[0].alive=false;r.reportDefensiveLoss(d[0]);r.updateDefenseSupport();
 assert(events.some(e=>e.type==='support_call'&&e.site==='A'&&e.reason==='casualty'));
 const donor=d.find(u=>u.supportOrder);assert(donor);assert.equal(r.defenseSupportCandidate(donor).action,'hold');
 r.t=donor.supportOrder.readyAt;const action=r.defenseSupportCandidate(donor);assert.equal(action.node,data.staging.A);r.execAction(donor,action);
 assert(donor.moving,'support uses real travel, never teleport');assert(events.some(e=>e.type==='support_move'));
 assert(d.some(u=>u.alive&&!u.supportOrder&&r.map.region(u.node)==='B'));
});
test('noise and hidden attackers do not trigger mass rotations; stale calls can be cancelled',()=>{
 const {round:r,def:d,events}=setup();r.defInfo.A={strength:12,tick:10,suspicious:true};
 r.atk=[{side:'atk',alive:true,node:'a_lobby'}];r.updateDefenseSupport();assert(!d.some(u=>u.supportOrder));
 r.observations.def={'A:0':{node:'a_lobby',lastSeenTick:10},'A:1':{node:'a_lobby',lastSeenTick:10},'A:2':{node:'a_lobby',lastSeenTick:10}};
 r.updateDefenseSupport();const donor=d.find(u=>u.supportOrder);assert(donor);
 r.t=20;r.defInfo.A.strength=0;r.defenseSupportCandidate(donor);assert.equal(donor.supportOrder,null);
 assert(events.some(e=>e.type==='support_cancel'));
});
test('persistent contact survives a missed decision tick and does not reissue duplicate calls',()=>{
 const {round:r,def:d,events}=setup();r.defInfo.A={strength:10,tick:9,suspicious:false};r.newInfo=false;
 for(let i=0;i<3;i++)r.observations.def['A:'+i]={node:'a_lobby',lastSeenTick:9};
 r.updateDefenseSupport();assert(d.some(u=>u.supportOrder));const n=events.length;r.updateDefenseSupport();assert.equal(events.length,n);
});
test('spatial combat offers covering fire across nodes while maintaining the one-shot budget',()=>{
 const {round:r,def:d,events}=setup();const u=d[0];u.node='a_site';u.position={x:180,y:643};u.post=null;
 const target={...d[1],id:'A:0',name:'attacker',side:'atk',node:'a_heaven',position:{x:180,y:700},hp:100,post:null};
 r.units=[u,target];r.atk=[target];r.def=[u];r.rng=()=>.99;r.resolveCombat();
 assert(events.some(e=>e.type==='shot'&&e.actorId===u.id));const n=events.filter(e=>e.type==='shot').length;r.resolveCombat();assert.equal(events.filter(e=>e.type==='shot').length,n);
});

test('a locally observed numerical rush can prompt a real fallback, never hidden counts',()=>{
 const {round:r,def:d,events}=setup(),u=d[3];
 r.visibleEnemiesAt=()=>[];r.atk=Array.from({length:5},()=>({alive:true,node:'b_site'}));
 assert.equal(r.defensiveFallbackCandidate(u),null,'hidden enemies cannot cause a retreat');
 r.visibleEnemiesAt=()=>r.atk.slice(0,3);assert.equal(r.defensiveFallbackCandidate(u),null,'communication reaction takes time');
 r.t++;const action=r.defensiveFallbackCandidate(u);assert.equal(action.node,data.staging.B);r.execAction(u,action);
 assert(u.moving);assert(events.some(e=>e.type==='fallback'));
});
