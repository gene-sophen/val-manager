// All operation is local and timed. No remote coach toggles or hidden enemy data.
function definitions(round){return round.map.data.doorDefinitions||[];}
function change(round,door,state,u){
 const occupied=round.units.some(a=>a.alive&&a.position&&round.map.geometry.obstacles.find(o=>o.id===door.id)&&require('./geometry-v2').inside(a.position,door.points.map(([x,y])=>({x,y}))));
 if(state==='closed'&&occupied)return false;
 round.doors[door.id]=state;round.doorChangedAt[door.id]=round.t;
 round.emit('door',{doorId:door.id,name:door.name,state,unit:u.name,unitId:u.id,side:u.side,points:door.points});return true;
}
module.exports={
 initDoors(){if(!this.map.data?.dynamicDoors)return;this.doors={...this.map.geometry.data.initialDoors};this.doorChangedAt={};this.doorClosedOnce=new Set();},
 updateDoors(){
  if(this.map.data?.spatialVersion===6)return require('./map-mechanisms').update(this);
  if(!this.map.data?.dynamicDoors)return;
  for(const u of this.units){if(!u.alive){u.doorAction=null;continue;}if(u.doorAction&&this.t>=u.doorAction.until){const d=definitions(this).find(d=>d.id===u.doorAction.id);if(d&&Math.hypot(u.position.x-d.control.x,u.position.y-d.control.y)<=45)change(this,d,u.doorAction.state,u);u.doorAction=null;}}
  for(const d of definitions(this)){
   if(this.doors[d.id]!=='open'||this.doorClosedOnce.has(d.id)||this.t<2)continue;
   const owner=this.planted?'atk':'def';
   const u=this.units.find(u=>u.alive&&u.side===owner&&!u.moving&&!u.doorAction&&!u.planting&&!u.defusing&&u.holdTicks>=1&&Math.hypot(u.position.x-d.control.x,u.position.y-d.control.y)<=35&&this.map.geometry.canObserve(u.position,d.control,{doors:this.doors})&&!this.hasVisibleEnemy(u));
   if(u){this.doorClosedOnce.add(d.id);u.doorAction={id:d.id,state:'closed',until:this.t+d.operationSeconds};this.emit('door_operation',{doorId:d.id,name:d.name,state:'closed',unit:u.name,unitId:u.id,until:u.doorAction.until});}
  }
 },
 openDoorForRoute(u,goal,nextNode){
  if(this.map.data?.spatialVersion===6)return require('./map-mechanisms').route(this,u,goal,nextNode);
  if(!this.map.data?.dynamicDoors)return false;
  for(const d of definitions(this))if(this.doors[d.id]==='closed'&&Math.hypot(u.position.x-d.control.x,u.position.y-d.control.y)<=45&&this.map.geometry.canObserve(u.position,d.control,{doors:this.doors})){
   const openRoute=this.map.geometry.route(u.position,goal,{doors:{...this.doors,[d.id]:'open'}}),wall=this.map.geometry.obstacles.find(o=>o.id===d.id);
   if(openRoute?.slice(1).some((p,i)=>this.map.geometry.crosses(openRoute[i],p,wall))){u.doorAction={id:d.id,state:'open',until:this.t+d.operationSeconds};this.emit('door_operation',{doorId:d.id,name:d.name,state:'open',unit:u.name,unitId:u.id,until:u.doorAction.until});return true;}
  }return false;
 }
};
