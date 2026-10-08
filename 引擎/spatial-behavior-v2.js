// New journal policy. The published map-balance-v1 remains unchanged.
const old=require('./spatial-behavior');
const enabled=r=>r.map?.data?.behaviorModel==='map-balance-v2';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function deploy(intent,units,map){
 old.deploy(intent,units,map);
 // A sentinel's own alarm should cover a guarded entrance, not the distant
 // flexible rotation slot. Swap roles as a whole, never move card attributes.
 const isolated=intent.homes.map((n,i)=>({n,i})).filter(({n})=>Object.values(map.data.sites).includes(n)&&intent.homes.filter(h=>map.region(h)===map.region(n)).length===1);
 for(const slot of isolated){const current=units.find(u=>u.sideIdx===slot.i);if(current?.kit?.skills.some(s=>s.archetype==='trap'))continue;
  const sentinel=units.find(u=>u.kit?.skills.some(s=>s.archetype==='trap')&&!Object.values(map.data.sites).includes(intent.homes[u.sideIdx]));if(!sentinel)continue;
  const j=sentinel.sideIdx;[intent.homes[j],intent.homes[slot.i]]=[intent.homes[slot.i],intent.homes[j]];[intent.roles[j],intent.roles[slot.i]]=[intent.roles[slot.i],intent.roles[j]];
 }
}
function recon(round,u,site){
 // Detection follows actual line of sight and recent communicated sightings.
 // Region membership alone is not enough to reveal hidden opponents.
 const enemies=round.units.filter(e=>e.alive&&e.side!==u.side),seen=new Set();
 for(const e of enemies)if(round.map.region(e.node)===site&&distance(e.position,u.position)<=450&&require('./observation').canObserve(round,u,e))seen.add(e.id);
 const reports=round.observations[u.side]||{};
 for(const e of Object.values(reports))if(round.t-e.lastSeenTick<=3&&round.map.region(e.node)===site&&enemies.some(u=>u.id===e.id))seen.add(e.id);
 return seen.size||null; // No contact is unknown, never proof of an empty site.
}
function postChoices(round,u,free){
 if(u.side!=='def'||round.planted||u.role==='roam'||free.length<=2)return free;
 // Awareness changes the final choice among usable defensive angles. A low
 // awareness roll must not select a non-cover crossing as a prepared guard.
 return free.map(id=>({id,s:old.poseScore(round,u,round.map.posts[id],false)})).sort((a,b)=>b.s-a.s||a.id.localeCompare(b.id)).slice(0,3).map(p=>p.id);
}
function skillCandidate(round,u,skill,legacy){
 const arch=skill.def.archetype,visible=()=>round.visibleEnemiesAt(u).length>0;
 if(['aimbuff','ult_aimbuff'].includes(arch))return visible()?{prior:u.side==='def'?5.5:arch==='ult_aimbuff'?2.2:1.6}:legacy;
 if(['dash','ult_dash'].includes(arch)&&u.side==='def')return !u.moving&&visible()||round.planted&&round.flags.retakeHit?{prior:arch==='ult_dash'?2.4:1.8}:null;
 return legacy;
}
function updateDefenseSupport(){
 if(!this.planted){
  const grouped={};for(const s of Object.values(this.observations.def||{}))if(this.t-s.lastSeenTick<=3){const site=this.map.region(s.node);if(this.map.siteNode(site))(grouped[site]??=new Set()).add(s.id);}
  for(const [site,seen]of Object.entries(grouped)){if(seen.size<2)continue;const goal=this.map.nodes[this.map.siteNode(site)],local=this.def.filter(u=>u.alive&&(u.supportOrder?.site===site||this.map.region(u.moving?.dest||u.node)===site&&distance(u.position,goal)<=160));if(local.length>=3)continue;
   const donor=this.def.filter(u=>u.alive&&!u.saved&&!u.supportOrder&&!this.hasVisibleEnemy(u)&&!u.defusing&&['mid','spawn'].includes(this.map.region(u.moving?.dest||u.node))).filter(u=>Number.isFinite(old.routeSeconds(this,u,goal))).sort((a,b)=>old.routeSeconds(this,a,goal)-old.routeSeconds(this,b,goal)||a.id.localeCompare(b.id))[0];if(!donor)continue;
   donor.supportOrder={site,readyAt:this.t+.25+(100-donor.sen)*.005,assignedAt:this.t,reason:'contact'};donor.nextThinkAt=0;if(donor.moving)this.interruptMove(donor,'support-call');this.emit('support_call',{unit:donor.name,unitId:donor.id,site,readyAt:donor.supportOrder.readyAt,reason:'contact',observedEnemies:seen.size});
  }
 }old.updateDefenseSupport.call(this);
}
module.exports={...old,enabled,zonesEnabled:enabled,deploy,recon,postChoices,skillCandidate,updateDefenseSupport};
