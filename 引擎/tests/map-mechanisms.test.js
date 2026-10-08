const test=require('node:test'),assert=require('node:assert/strict'),M=require('../map-mechanisms'),registry=require('../maps/combat-registry');
function sample(id,doorId){const map=registry.get(id),d=map.data.doorDefinitions.find(d=>d.id===doorId),u={name:'local',id:'A:0',side:'def',alive:true,position:{...d.controls[0]},gun:2,ammo:25,reloadUntil:-1,holdTicks:2},events=[],r={map,units:[u],doors:{...map.geometry.data.initialDoors},doorChangedAt:{},doorClosedOnce:new Set(),t:0,emit:(type,e)=>events.push({type,...e}),hasVisibleEnemy:()=>false};return {r,u,d,events};}
test('Lotus rotation opens locally then closes after ten seconds, restoring occlusion',()=>{
 const {r,u,d,events}=sample('lotus','a-rotating');u.doorAction={id:d.id,state:'open',until:1};r.t=1;M.update(r);assert.equal(r.doors[d.id],'open');r.t=10.75;M.update(r);assert.equal(r.doors[d.id],'open');r.t=11;M.update(r);assert.equal(r.doors[d.id],'closed');assert.equal(events.filter(e=>e.type==='door').length,2);
 const [a,b]=d.controls;assert(r.map.geometry.canWalk(a,b,null,{doors:{[d.id]:'open'}}));assert(!r.map.geometry.canWalk(a,b,null,{doors:{[d.id]:'closed'}}));
});
test('a remote actor cannot complete a door operation',()=>{const {r,u,d}=sample('lotus','c-rotating');u.position={...r.map.nodes.t_spawn};u.doorAction={id:d.id,state:'open',until:1};r.t=2;M.update(r);assert.equal(r.doors[d.id],'closed');assert.equal(u.doorAction,null);});
test('breaking a connector consumes ammo and time, destruction lasts only this round',()=>{
 const {r,u,d,events}=sample('lotus','a-link-breakable');u.doorAction={id:d.id,state:'destroyed',until:1};for(r.t=0;r.t<3;r.t+=.25)M.update(r);assert.equal(r.doors[d.id],'destroyed');assert(u.ammo<25);assert(events.some(e=>e.type==='object_damage'&&e.hp===0));assert.equal(sample('lotus','a-link-breakable').r.doors[d.id],'closed');
});
test('Summit drop walls persist, cannot reopen for a route and reset next round',()=>{
 const {r,u,d}=sample('summit','b-drop-wall');u.doorAction={id:d.id,state:'closed',until:1};r.t=1;M.update(r);assert.equal(r.doors[d.id],'closed');assert.equal(M.route(r,u,r.map.nodes[d.b]),false);r.t=80;M.update(r);assert.equal(r.doors[d.id],'closed');assert.equal(sample('summit','b-drop-wall').r.doors[d.id],'open');
});
test('Fracture has an explicit zipline and visible air does not become walkable floor',()=>{
 const m=registry.get('fracture'),e=m.edgeBetween('t_spawn','t_bridge');assert.equal(e.traversal,'zipline');assert.equal(e.traverseSeconds,8);const a=e.route[0],b=e.route.at(-1),p={x:a.x+(b.x-a.x)*.2,y:a.y+(b.y-a.y)*.2};assert(m.geometry.onNavigationLink(p,'zipline'));assert(!m.geometry.contains(p));assert(m.geometry.inSight(p));assert(!m.geometry.canWalk(a,p));assert(m.geometry.canObserve(a,p));
});
test('Split ropes have actual traversal cost and three-site defense covers C',()=>{const s=registry.get('split');assert.equal(s.edgeBetween('mid_vent','a_tower').traverseSeconds,2);const h=registry.get('haven'),intent=require('../tactics').buildIntent(h,'def','hold',()=>.5);assert(intent.homes.includes('c_site'));});
