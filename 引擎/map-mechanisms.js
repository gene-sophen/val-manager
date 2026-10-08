// v6 map mechanisms: local actions, round-local state, and real navigation / LOS.
const {inside}=require('./geometry-v2'),{weaponSpec}=require('./actions');
const controls=d=>d.controls||[d.control],length=r=>r?.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-r[i].x,p.y-r[i].y),0)??Infinity;
function local(r,u,d,radius=45){return controls(d).some(c=>Math.hypot(u.position.x-c.x,u.position.y-c.y)<=radius&&r.map.geometry.canObserve(u.position,c,{doors:r.doors}));}
function change(r,d,state,u){if(state==='closed'&&r.units.some(a=>a.alive&&inside(a.position,d.points.map(([x,y])=>({x,y})))))return false;r.doors[d.id]=state;r.doorChangedAt[d.id]=r.t;r.emit('door',{doorId:d.id,name:d.name,state,unit:u?.name||'地图机关',unitId:u?.id,side:u?.side,points:d.points});return true;}
function update(r){
 r.mechanismHealth??=Object.fromEntries(r.map.data.doorDefinitions.map(d=>[d.id,d.health||0]));r.mechanismExpiry??={};
 for(const u of r.units){if(!u.alive){u.doorAction=null;continue;}const a=u.doorAction;if(!a)continue;const d=r.map.data.doorDefinitions.find(d=>d.id===a.id);if(!d||!local(r,u,d)){u.doorAction=null;continue;}
  if(a.state==='destroyed'){
   if(r.hasVisibleEnemy(u)){u.doorAction=null;continue;}
   const gun=weaponSpec(u.gun);if(u.ammo<=0){if(u.reloadUntil<0)u.reloadUntil=r.t+gun.reloadTicks;if(r.t<u.reloadUntil)continue;u.ammo=gun.magazine;u.reloadUntil=-1;}
   if(r.t<(a.nextShot??0))continue;u.ammo--;a.nextShot=r.t+(u.gun===0?.5:.25);r.mechanismHealth[d.id]=Math.max(0,r.mechanismHealth[d.id]-gun.damage);
   r.emit('object_damage',{doorId:d.id,name:d.name,unit:u.name,unitId:u.id,side:u.side,ammo:u.ammo,hp:r.mechanismHealth[d.id],damage:gun.damage});
   if(!r.mechanismHealth[d.id]){change(r,d,'destroyed',u);u.doorAction=null;}continue;
  }
  if(r.t>=a.until){if(change(r,d,a.state,u)&&d.kind==='rotating'&&a.state==='open')r.mechanismExpiry[d.id]=r.t+d.openSeconds;u.doorAction=null;}
 }
 for(const d of r.map.data.doorDefinitions){
  if(d.kind==='rotating'&&r.doors[d.id]==='open'&&r.t>=r.mechanismExpiry[d.id])change(r,d,'closed');
  if(d.kind==='proximity'){const near=r.units.some(u=>u.alive&&local(r,u,d,45));if(near&&r.doors[d.id]!=='open')change(r,d,'open');else if(!near&&r.doors[d.id]==='open')change(r,d,'closed');continue;}
  if(!['drop-wall','destructible-door'].includes(d.kind)||r.doors[d.id]!=='open'||r.doorClosedOnce.has(d.id)||r.t<2)continue;
  if(d.kind==='drop-wall'&&!r.planted&&require('./behavior-policy').multimapEnabled(r))continue;
  const owner=r.planted?'atk':'def',u=r.units.find(u=>u.alive&&u.side===owner&&!u.moving&&!u.doorAction&&!u.planting&&!u.defusing&&u.holdTicks>=1&&local(r,u,d,35)&&!r.hasVisibleEnemy(u));
  if(u){r.doorClosedOnce.add(d.id);u.doorAction={id:d.id,state:'closed',until:r.t+d.operationSeconds};r.emit('door_operation',{doorId:d.id,name:d.name,state:'closed',unit:u.name,unitId:u.id,until:u.doorAction.until});}
 }
}
function route(r,u,goal,nextNode){
 for(const d of r.map.data.doorDefinitions){
  if(r.doors[d.id]!=='closed'||d.kind==='drop-wall')continue;
  // The macro edge identifies the relevant connector. Avoid running two full
  // A* searches for a remote, unrelated door on every individual move.
  const connector=[d.a,d.b].includes(u.node)&&[d.a,d.b].includes(nextNode)&&u.node!==nextNode;
  if(!connector&&!controls(d).some(c=>Math.hypot(u.position.x-c.x,u.position.y-c.y)<=110))continue;
  const wall=r.map.geometry.obstacles.find(o=>o.id===d.id),open=r.map.geometry.route(u.position,goal,{doors:{...r.doors,[d.id]:'open'}});
  if(!open?.slice(1).some((p,i)=>r.map.geometry.crosses(open[i],p,wall)))continue;
  const closed=r.map.geometry.route(u.position,goal,{doors:r.doors});if(length(closed)<=length(open)+25)continue;
  if(local(r,u,d)){
   const state=['breakable','destructible-door'].includes(d.kind)?'destroyed':'open';u.doorAction={id:d.id,state,until:r.t+d.operationSeconds};r.emit('door_operation',{doorId:d.id,name:d.name,state,unit:u.name,unitId:u.id,until:u.doorAction.until});return true;
  }
  // Walk to the reachable switch rather than remotely opening an unseen door.
  const choices=controls(d).map(c=>({c,route:r.map.geometry.route(u.position,c,{doors:r.doors})})).filter(a=>a.route&&length(a.route)<length(closed));choices.sort((a,b)=>length(a.route)-length(b.route));
  if(choices[0]&&r.moveToPosition(u,choices[0].c))return true;
 }
 return false;
}
module.exports={update,route,change,local};
