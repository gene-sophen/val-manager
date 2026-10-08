// Multimap revision 1. Forked from frozen Ascent v2 to preserve old journals.
// Physical routes/rays remain authoritative; no outcome probability override.
const profiles=require("./maps/balance-profiles");
const abilities=require('./abilities');
const enabled=r=>['map-balance-v1','map-balance-v2'].includes(r.map?.data?.behaviorModel);
const zonesEnabled=r=>enabled(r);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function routeSeconds(r,u,goal){
 const speed=r.map.data.navigationSpeed?.run||32,len=route=>route?route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0)/speed:Infinity;
 const actual=len(r.map.geometry.route(u.position,goal,{doors:r.doors})),operable=(r.map.data.doorDefinitions||[]).filter(d=>r.doors?.[d.id]==='closed'&&d.kind!=='drop-wall');
 if(!operable.length)return actual;
 const open=r.map.geometry.route(u.position,goal,{doors:{...r.doors,...Object.fromEntries(operable.map(d=>[d.id,'open']))}});if(!open)return actual;
 let cost=len(open);
 for(const d of operable){const wall=r.map.geometry.obstacles.find(o=>o.id===d.id);if(!wall||!open.slice(1).some((p,i)=>r.map.geometry.crosses(open[i],p,wall)))continue;
  if(['breakable','destructible-door'].includes(d.kind)){const gun=require('./actions').weaponSpec(u.gun??2),shots=Math.ceil((r.mechanismHealth?.[d.id]??d.health??200)/gun.damage);cost+=shots*(u.gun===0?.5:.25)+(shots>(u.ammo??gun.magazine)?gun.reloadTicks:0)+1;}
  else if(d.kind!=='proximity')cost+=(d.operationSeconds||1)+1;
 }
 return Math.min(actual,cost);
}

function denied(r,position){const z=r.mollyZone;return !!(z?.deny&&r.t<z.until&&distance(position,z.position||r.map.nodes[z.node])<=(z.radius||28))||zonesEnabled(r)&&(r.damageZones||[]).some(z=>z.deny&&r.t>=(z.activeAt||0)&&r.t<z.until&&distance(position,z.position)<=z.radius&&r.map.geometry.canObserve(position,z.position,{doors:r.doors}));}
function deploy(intent,units,map){
 const fronts=new Set(Object.values(map.data.sites)),seen=new Set(),sites=new Set(Object.keys(map.data.sites));
 const coverage=Object.fromEntries([...sites].map(site=>[site,intent.homes.filter(home=>map.region(home)===site).length]));
 const slots=intent.homes.map((home,i)=>{
  const region=map.region(home),primary=fronts.has(home)&&!seen.has(home);seen.add(home);
  const priority=fronts.has(home)?coverage[region]===1?4:primary?3:1.75:intent.roles[i]==='roam'||region==='mid'?2.5:1;
  return {home,role:intent.roles[i],i,priority,region};
 }).sort((a,b)=>b.priority-a.priority||a.i-b.i),available=new Set(units),homes=[],roles=[];
 for(const slot of slots){
  const score=u=>slot.priority>=3?u.aim*.45+u.sen*.4+u.syn*.15+((u.kit?.skills||[]).some(s=>s.archetype==='trap')?8:0):slot.role==='roam'?u.aim*.7+u.sen*.3:slot.region==='mid'?u.sen*.6+u.syn*.4:u.syn+u.sen;
  const u=[...available].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];available.delete(u);homes[u.sideIdx]=slot.home;roles[u.sideIdx]=slot.role;
 }intent.homes=homes;intent.roles=roles;
}

function fire(){
 const contacts=[],ready=[],ordered=this.units.slice().sort((a,b)=>a.id.localeCompare(b.id));
 for(const u of ordered){
  if(!u.alive||u.planting||u.defusing||u.stun>0||u.doorAction||(zonesEnabled(this)&&u.abilityBusyUntil>this.t))continue;
  const visible=this.units.filter(e=>require('./observation').canObserve(this,u,e)).sort((a,b)=>distance(u.position,a.position)-distance(u.position,b.position)||a.id.localeCompare(b.id));
  if(!visible.length){if(u.targetSeenAt!=null&&this.t-u.targetSeenAt>1){u.fireTarget=null;u.fireReadyAt=null;}continue;}
  const target=(this.map.data.autonomyModel&&visible.find(e=>e.id===u.agentTarget))||visible.find(e=>e.id===u.fireTarget)||visible[0];u.targetSeenAt=this.t;
  if(this.map.data.externalEffectsVersion)require('./external-effects').refresh(this,target);
  if(u.fireTarget!==target.id){
   const preaim=!u.moving&&u.post&&u.holdTicks>=2?.12:0;
   const trade=this.map.data.externalEffectsVersion&&require('./external-effects').condition('trade',this,u,target),coordination=trade?Math.max(0,u.syn-50)*.001:0;
   u.fireTarget=target.id;u.fireReadyAt=this.t+Math.max(.08,.2+(100-u.sen)*.003+this.rng()*.08-preaim-coordination);
   const encounter=this.map.engagements?.query(this,u,target);
   this.emit('contact',{unit:u.name,unitId:u.id,side:u.side,targetId:target.id,x:u.position.x,y:u.position.y,readyAt:u.fireReadyAt,preaimSeconds:preaim,...(encounter?{window:encounter.window,fromPosition:encounter.fromPosition,toPosition:encounter.toPosition,visibleFraction:encounter.visible}:{})});contacts.push(u);
  }
  if(u.moving&&u.moving.traversal!=='zipline'&&u.moving.purpose!=='withdraw')this.interruptMove(u,'contact');
  if(this.t+1e-7>=u.fireReadyAt)ready.push({u,target,at:u.fireReadyAt});
 }
 // Both sides request flashes from the same unmodified contact state.
 this.pendingFlashHits=[];
 const entries=[...new Map([...(this.pendingEntryFlashes||[]),...contacts].filter(u=>u.alive).map(u=>[u.id,u])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 this.pendingEntryFlashes=[];for(const u of entries)abilities.onEntryFlash(this,u);
 for(const {unit,seconds,by}of this.pendingFlashHits){unit.stun=Math.max(unit.stun,seconds);this.emit('flash_hit',{unit:unit.name,unitId:unit.id,by,x:unit.position.x,y:unit.position.y,until:this.t+seconds});}this.pendingFlashHits=null;
 // Resolve different due times in order, batching only truly simultaneous
 // shots. A quarter-second frame must not let a later shooter fire after an
 // earlier lethal headshot merely because both clocks fell in that frame.
 const orderedShots=ready.sort((a,b)=>a.at-b.at||a.u.id.localeCompare(b.u.id));
 for(let i=0;i<orderedShots.length;){
  let end=i+1;while(end<orderedShots.length&&Math.abs(orderedShots[end].at-orderedShots[i].at)<1e-7)end++;
  this._shotBatch=[];
  for(const {u,target,at}of orderedShots.slice(i,end)){
   if(!u.alive||!target.alive||u.stun>0)continue;
   this.tryKill(u,target,false);u.fireReadyAt=at+(u.gun===0?.5:.25);
  }
  const damage=this._shotBatch;this._shotBatch=null;
  for(const {att,tgt,damage:amount,headshot}of damage){if(!tgt.alive)continue;tgt.hp=Math.max(0,tgt.hp-amount);this.emit('damage',{actor:att.name,actorId:att.id,target:tgt.name,targetId:tgt.id,damage:amount,hp:tgt.hp,hitLocation:headshot?'head':'body'});if(tgt.hp===0)this.applyKill(att,tgt);}
  i=end;
 }

}
const guardCache=new WeakMap();
function guardAngles(r,p){
 let cache=guardCache.get(r.map);if(!cache)guardCache.set(r.map,cache=new Map());
 const key=p.node+':'+p.x+':'+p.y+':'+JSON.stringify(r.doors);if(cache.has(key))return cache.get(key);
 const profile=r.map.data.tacticalProfile,entryNodes=profiles[r.map.data.id]?.guards[p.node]||[];
 const approaches=entryNodes.flatMap(n=>{
  const e=r.map.edgeBetween(n,p.node);if(!e)return [];
  const route=e.route;
  return route?[route]:[];
 });
 const site=Object.keys(r.map.data.sites).find(s=>r.map.siteNode(s)===p.node);
 if(site)for(const entry of [profile.sites[site].main.at(-2),profile.sites[site].alternate.at(-2)]){
  const e=r.map.data.edges.find(e=>[e.a,e.b].includes(entry)&&[e.a,e.b].includes(p.node));if(e)approaches.push(e.a===entry?e.route:e.route.slice().reverse());
 }
 // Read an entrance trajectory, not just its remote area centroid. Tight
 // corners can hide every centroid while still exposing the last approach.
 const scores=[];
 for(const route of approaches){const length=route.slice(1).reduce((v,b,i)=>v+distance(route[i],b),0);let view=0;
  for(const back of [140,100,60,30]){const q=require('./geometry').routePoint(route,Math.max(0,1-back/Math.max(1,length)));const outgoing=r.map.geometry.visibleFraction(p,q,{doors:r.doors}),incoming=r.map.geometry.visibleFraction(q,p,{doors:r.doors});view+=(outgoing-incoming*.7)*(back/140);}
  scores.push(Math.max(0,view));
 }
 cache.set(key,scores);return scores;
}
function guardView(r,p,actor){
 const angles=guardAngles(r,p),partners=(r.def||[]).filter(d=>d!==actor&&d.alive&&d.post&&r.postOcc[d.post]===d&&d.node===p.node).map(d=>guardAngles(r,r.map.posts[d.post]));
 if(!partners.length)return Math.max(0,...angles);
 return angles.reduce((sum,v,i)=>sum+v/(1+partners.reduce((s,a)=>s+(a[i]||0),0)*3),0);
}
function poseScore(r,u,p,hide){
 const node=p.node,targets=(profiles[r.map.data.id]?.guards[node]||[]).flatMap(n=>r.map.postsAt(n)),table=r.map.data.staticVisibility?.[Object.keys(r.map.posts).find(k=>r.map.posts[k]===p)]||{};
 if(hide)return p.cover-Math.min(1,r.sightCount(Object.keys(r.map.posts).find(k=>r.map.posts[k]===p))*.05);
 if(u.side==='def'&&!r.planted){
  const visible=targets.map(k=>table[k]||0),watch=Math.max(0,...visible),other=targets.reduce((s,k)=>s+(table[k]||0),0);
  const partner=r.def?.filter(d=>d!==u&&d.alive&&d.post&&r.postOcc[d.post]===d&&d.node===node)||[];
  const overlap=partner.reduce((s,d)=>s+(distance(p,d.position)<35?.6:0),0);
  return p.cover*.8+watch*.5+other*.08+guardView(r,p,u)*1.6-overlap;
 }
 return p.cover+.02*Math.min(10,r.sightCount(Object.keys(r.map.posts).find(k=>r.map.posts[k]===p)));
}
function defCandidates(u){
 if(!this.planted){
  if(this.visibleEnemiesAt(u).length){
   const retreat=fallback.call(this,u);if(retreat)return [retreat];
   // Holding a revealed angle is different from voluntarily peeking an unseen
   // angle. High AIM formerly made defenders leave cover on every contact,
   // while unanchored entering attackers stayed still and fired accurately.
   return [{action:'hold',prior:u.lastShotTick<0?5:3},{action:'peek',prior:.7,pers:(u.aim-70)*.01}];
  }
  return null;
 }
 const site=this.map.siteNode(this.plantSite),goal=this.spike.position;
 if(this.defuser?.alive&&this.defuser.defusing>0&&this.defuser!==u){
  if(distance(u.position,goal)>110&&!this.visibleEnemiesAt(u).length)return [{action:'approachSpike',prior:100,objective:true}];
  return [{action:'hold',prior:100,objective:true,guardSpike:true}];
 }
 if(!this.flags.siteCleared&&!this.flags.retakeHit){
  const staging=this.map.data.staging[this.plantSite],center=this.map.nodes[staging],remaining=this.rules.defuseTicks-(this.spike.defuseProgress||0),travel=routeSeconds(this,u,goal);
  const arrived=distance(u.position,center)<=45&&this.map.geometry.canWalk(u.position,center,u,{doors:this.doors});
  if(arrived)u.rallyAt??=this.t;
  const mates=this.def.filter(d=>d.alive&&!d.saved&&distance(d.position,center)<=45&&this.map.geometry.canWalk(d.position,center,d,{doors:this.doors}));
  const urgent=this.spikeLeft<travel+remaining+5;
  if(mates.length>=2||urgent||arrived&&this.t-u.rallyAt>=3){this.flags.retakeHit=true;this.emit('retake',{site:this.plantSite,count:mates.length,coordinated:mates.length>=2});}
  else if(!this.visibleEnemiesAt(u).length){
   if(!arrived)return [{action:'stageRetake',prior:100,objective:true,node:staging}];
   return [{action:'hold',prior:4,guardSpike:true}];
  }
 }
 if(u.saved&&!this.flags.siteCleared)return [{action:'hold',prior:5}];
 if(this.visibleEnemiesAt(u).length&&!this.flags.siteCleared){
  if(!denied(this,goal)&&distance(u.position,goal)<110&&abilities.findSkill(u,'smoke'))return [{action:'coverDefuse',prior:100}];
  const shelter=fallback.call(this,u);if(shelter)return [shelter];
  return [{action:'hold',prior:3},{action:'peek',prior:.7,pers:(u.aim-70)*.01}];
 }
 const flank=retakeFlank(this,u,goal);if(flank)return [flank];
 const travel=routeSeconds(this,u,goal),remaining=(this.rules.defuseTicks-(this.spike.defuseProgress||0));
 if(!this.flags.siteCleared&&this.spikeLeft<travel+remaining+.5)return [{action:'save',prior:100}];
 if(distance(u.position,goal)>10||!this.map.geometry.canWalk(u.position,goal,u,{doors:this.doors}))return [{action:'approachSpike',prior:100,objective:true}];
 if(denied(this,goal))return [{action:'hold',prior:100,objective:true,guardSpike:true}];
 return [{action:'defuse',prior:100,objective:true}];
}
function supportCandidate(u){
 const o=u.supportOrder;if(!o||this.planted)return null;
 if(this.t<o.readyAt)return {action:'hold',prior:9};
 if(o.reason==='fallback'&&o.phase==='withdraw'){
  const staging=this.map.data.staging[o.site];if(u.node!==staging)return {action:'push',prior:9,node:staging,mode:'run'};o.phase='regroup';
 }
 
 const seen=Object.values(this.observations.def).some(s=>this.t-s.lastSeenTick<=6&&this.map.region(s.node)===o.site),loss=this.defensiveLosses?.[o.site]?.some(t=>this.t-t<=10);
 if(!seen&&!loss&&this.t-o.assignedAt>6){u.supportOrder=null;u.support=null;u.rotating=false;return {action:'push',prior:7,node:u.homeNode,mode:'run'};}
 if(u.node===this.map.siteNode(o.site)&&u.post)return {action:'hold',prior:8};
 u.rotating=true;u.support=o.site;
 return {action:'reinforceSite',prior:100,objective:true,site:o.site};
}
function fallback(u){
 if(u.fallbackUsed)return null;
 const enemies=this.visibleEnemiesAt(u);if(!enemies.length)return null;
 if(u.lastShotTick<0&&u.fireTarget)return null; // Finish the acquired first shot before withdrawing.
 const cover=this.def.filter(d=>d!==u&&d.alive&&!d.moving&&distance(d.position,u.position)<140&&this.map.geometry.canObserve(d.position,u.position,{doors:this.doors})).length;
 if(enemies.length<=cover+1&&u.hp>=50)return null;
 const candidates=this.map.postsAt(u.node).filter(k=>k!==u.post&&(!this.postOcc[k]||this.postOcc[k]===u)).map(k=>({id:k,p:this.map.posts[k]})).filter(({p})=>distance(u.position,p)>8&&distance(u.position,p)<100);
 const exposure=p=>enemies.reduce((s,e)=>s+this.map.geometry.visibleFraction(e.position,p,{doors:this.doors}),0),current=exposure(u.position);
 const best=candidates.map(c=>({...c,exposure:exposure(c.p)})).filter(c=>c.exposure<current-.4).sort((a,b)=>a.exposure-b.exposure||distance(u.position,a.p)-distance(u.position,b.p)).find(c=>{const route=this.map.geometry.route(u.position,c.p,{doors:this.doors});if(!route)return false;const length=route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0);return length<=60;});
 if(best)return {action:'withdrawCover',prior:100,post:best.id};
 return null;
}
function hazardCandidate(r,u){
 const zones=(r.damageZones||[]).filter(z=>z.owner.side!==u.side&&r.t<z.until&&!(z.burst&&z.spent)&&distance(u.position,z.position)<z.radius+5&&r.map.geometry.canObserve(u.position,z.position,{doors:r.doors}));
 if(!zones.length)return null;
 const choices=r.map.postsAt(u.node).filter(k=>k!==u.post&&(!r.postOcc[k]||r.postOcc[k]===u)).map(k=>({id:k,p:r.map.posts[k]})).filter(({p})=>zones.every(z=>distance(p,z.position)>z.radius+5)).sort((a,b)=>distance(u.position,a.p)-distance(u.position,b.p));
 const safe=choices.find(({p})=>{
  const route=r.map.geometry.route(u.position,p,{doors:r.doors});if(!route)return false;
  const length=route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0),travel=length/(r.map.data.navigationSpeed?.run||32);
  if(length>60)return false;
  return zones.some(z=>!z.burst)||travel<=Math.max(0,...zones.map(z=>(z.activeAt||0)-r.t))+.25;
 });
 return safe?{action:'evadeHazard',prior:100,objective:true,post:safe.id}:null;
}
function updateHazards(r){
 const damages=[];r.damageZones=(r.damageZones||[]).filter(z=>r.t<z.until);
 for(const z of r.damageZones){if(r.t<(z.activeAt||0)||r.t-z.lastDamageAt<.5||z.burst&&z.spent)continue;z.lastDamageAt=r.t;z.spent=!!z.burst;
  for(const u of r.units)if(u.alive&&u.side!==z.owner.side&&distance(u.position,z.position)<=z.radius&&r.map.geometry.canObserve(u.position,z.position,{doors:r.doors}))damages.push({att:z.owner,tgt:u,damage:(z.burst?28:4)*z.power*(u.armor==='heavy'?.72:u.armor==='light'?.85:1)});
 }
 for(const {att,tgt,damage}of damages){if(!tgt.alive)continue;tgt.hp=Math.max(0,tgt.hp-damage);tgt.nextThinkAt=0;r.emit('damage',{actor:att.name,actorId:att.id,target:tgt.name,targetId:tgt.id,damage,hp:tgt.hp,kind:'area'});if(tgt.hp===0)r.applyKill(att,tgt);}
}
module.exports={enabled,zonesEnabled,fire,poseScore,defCandidates,supportCandidate,routeSeconds,denied,deploy,fallback,hazardCandidate,updateHazards,updateDefenseSupport,formationWaits,onPlant,defensiveSmoke,keepsAngle,defensiveArea,retakeFlank,wallEffect};

// Resolve marching order from a single snapshot so array order cannot choose
// a winner. Both teams yield briefly to a moving teammate at the same mouth.
function formationWaits(r){
 const waiting=new Set(),step=r.map.data.tickSeconds||.25;
 const moving=r.units.filter(u=>u.alive&&u.moving&&u.stun<=0&&u.moving.traversal!=='zipline'&&!['stance','withdraw'].includes(u.moving.purpose));
 for(const u of moving){
  const m=u.moving,next=require('./geometry').routePoint(m.route,(m.total-Math.max(0,m.left-step))/m.total),dx=next.x-u.position.x,dy=next.y-u.position.y,len=Math.hypot(dx,dy);
  if(len<.1)continue;
  for(const mate of moving){
   if(mate===u||mate.side!==u.side||mate.moving.to!==m.to)continue;
   const vx=mate.position.x-u.position.x,vy=mate.position.y-u.position.y,ahead=(vx*dx+vy*dy)/len;
   if(distance(u.position,mate.position)>32||distance(next,mate.position)>=18)continue;
   const common=r.map.nodes[m.to],rank=distance(u.position,common)-distance(mate.position,common),mateLeads=rank>1e-7||Math.abs(rank)<=1e-7&&u.id.localeCompare(mate.id)>0;
   if(mateLeads&&(ahead>1||distance(u.position,mate.position)<1)){waiting.add(u.id);break;}
  }
 }
 return waiting;
}

// Only fresh shared sightings and casualties can call reinforcements. Never
// reads the enemy intent, or the unobserved enemy units to estimate pressure.
function updateDefenseSupport(){
 if(this.planted)return;
 const sites=Object.keys(this.map.data.sites),dest=u=>u.moving?.dest||u.node;
 this.defensiveLosses ||= Object.fromEntries(sites.map(s=>[s,[]]));
 const counts=Object.fromEntries(sites.map(s=>[s,0])),knownDead=new Set((this.effectKills||this._roundEvents||[]).filter(e=>e.type==null||e.type==='kill').map(e=>e.victimId));
 for(const sight of Object.values(this.observations.def))if(!knownDead.has(sight.id)&&this.t-sight.lastSeenTick<=6){const s=this.map.region(sight.node);if(s in counts)counts[s]++;}
 const pressures=sites.map(site=>{const losses=this.defensiveLosses[site].filter(t=>this.t-t<=10);this.defensiveLosses[site]=losses;return {site,contacts:counts[site],losses:losses.length};}).filter(p=>p.contacts>=1||p.losses).sort((a,b)=>b.contacts+b.losses*4-a.contacts-a.losses*4||a.site.localeCompare(b.site));
 for(const p of pressures){
  defensiveSmoke(this,p);
  defensiveArea(this,p);
  const siteNode=this.map.siteNode(p.site),goal=this.map.nodes[siteNode];
  const local=this.def.filter(u=>u.alive&&(dest(u)===siteNode||this.map.region(dest(u))===p.site&&distance(u.position,goal)<=160));
  const assigned=this.def.filter(u=>u.alive&&u.supportOrder?.site===p.site);
  const desired=Math.min(4,Math.max(2,p.contacts+(p.losses?1:0)));
  let needed=desired-new Set([...local,...assigned]).size;
  if(needed<=0)continue;
  const confirmed=p.contacts>=(profiles[this.map.data.id]?.confirmedContacts||3);
  const candidates=this.def.filter(u=>u.alive&&!u.saved&&!u.defusing&&!u.supportOrder&&dest(u)!==siteNode&&!this.hasVisibleEnemy(u)).sort((a,b)=>this.map.travelTime(dest(a),siteNode)-this.map.travelTime(dest(b),siteNode)||b.syn-a.syn||a.id.localeCompare(b.id)).map(u=>({u}));
  for(const {u}of candidates){
   if(needed<=0)break;
   const from=this.map.region(dest(u));
   if(sites.includes(from)&&from!==p.site){
    const anchors=this.def.filter(d=>d.alive&&!d.supportOrder&&sites.includes(this.map.region(dest(d)))&&this.map.region(dest(d))!==p.site);
    if(confirmed?anchors.length<=1:anchors.filter(d=>this.map.region(dest(d))===from).length<=1)continue;
   }
   if(!Number.isFinite(routeSeconds(this,u,goal)))continue;
   u.supportOrder={site:p.site,readyAt:this.t+.25+(100-u.sen)*.005,assignedAt:this.t,reason:p.losses?'casualty':'contact'};
   u.nextThinkAt=0;
   // An obsolete patrol may be cancelled; the new route still traverses walls.
   if(u.moving)this.interruptMove(u,'support-call');
   this.emit('support_call',{unit:u.name,unitId:u.id,site:p.site,readyAt:u.supportOrder.readyAt,reason:u.supportOrder.reason,observedEnemies:p.contacts});needed--;
  }
 }
}

function onPlant(r){
 r.retakeFlanker=null;r.flankAssignmentDone=false;
 for(const u of r.def){if(!u.alive)continue;
  if(u.moving&&u.moving.traversal!=='zipline')r.interruptMove(u,'plant-confirmed');
  u.supportOrder=null;u.support=null;u.rotating=false;u.nextThinkAt=0;u.waitRetake=false;u.rallyAt=null;u.fallbackUsed=false;u.retakeViaIndex=0;
 }
}

// Controllers answer shared contact/casualty reports with a real entrance smoke.
// Formerly only attackers had an automatic pre-plant smoke trigger.
function defensiveSmoke(r,pressure){
 if(profiles[r.map.data.id]?.defensiveSmoke===false)return;
 if(pressure.contacts<2&&!pressure.losses)return;
 if((r.geometrySmokes||[]).some(s=>s.defensive&&s.site===pressure.site&&r.t<s.until))return;
 r.defSmokeAttempts ||= {};if(r.t-(r.defSmokeAttempts[pressure.site]??-99)<2)return;
 const profile=r.map.data.tacticalProfile.sites[pressure.site];
 const reports=Object.values(r.observations.def).filter(s=>r.t-s.lastSeenTick<=3&&r.map.region(s.node)===pressure.site&&s.position&&r.map.geometry.contains(s.position,{doors:r.doors})).sort((a,b)=>b.lastSeenTick-a.lastSeenTick||String(a.id).localeCompare(String(b.id)));
 const point=reports[0]?.position||r.map.nodes[profile.main.at(-2)];
 const candidates=r.def.filter(u=>u.alive&&u.stun<=0&&!(u.abilityBusyUntil>r.t)).map(u=>({u,skill:abilities.findSkill(u,'smoke')})).filter(({u,skill})=>skill&&distance(u.position,point)<=(skill.def.params.ranged||['幽影','炼狱','星礈','暮蝶'].includes(u.agent)?600:160)).sort((a,b)=>b.u.syn-a.u.syn||a.u.id.localeCompare(b.u.id));
 if(!candidates.length)return;r.defSmokeAttempts[pressure.site]=r.t;
 const {u,skill}=candidates[0];if(!abilities.thinkCast(r,u))return;
 const result=abilities.cast(r,u,skill,{defensive:true,targetSite:pressure.site});if(!result)return;
 const duration=(skill.def.params.ticks||require('./config').utility.smokeTicks)*result.power;
 const smoke={x:point.x,y:point.y,radius:28,until:r.t+duration,defensive:true,site:pressure.site};
 r.geometrySmokes.push(smoke);u.abilityBusyUntil=r.t+.5;
 r.emit('smoke',{node:profile.main.at(-2),side:'def',by:u.name,unitId:u.id,...smoke});
}

function keepsAngle(r,u){
 const p=r.map.posts[u.post];return u.side==='def'&&!r.planted&&u.role!=='roam'&&p&&Math.max(0,...guardAngles(r,p))>.1;
}

// A remote support ability may use a fresh teammate report, never an enemy's
// current hidden position. The travel delay naturally allows the target to move.
function defensiveArea(r,pressure){
 if(pressure.contacts<2&&!pressure.losses)return;
 r.defAreaAttempts ||= {};if(r.t-(r.defAreaAttempts[pressure.site]??-99)<2)return;
 const report=Object.values(r.observations.def).filter(s=>s.position&&r.t-s.lastSeenTick<=3&&r.map.region(s.node)===pressure.site&&r.map.geometry.contains(s.position,{doors:r.doors})).sort((a,b)=>b.lastSeenTick-a.lastSeenTick||String(a.id).localeCompare(String(b.id)))[0];if(!report)return;
 const candidates=r.def.filter(u=>u.alive&&u.stun<=0&&!u.doorAction&&!(u.abilityBusyUntil>r.t)&&!r.hasVisibleEnemy(u)).map(u=>({u,skill:abilities.findSkill(u,'molly')})).filter(({u,skill})=>skill&&distance(u.position,report.position)<=(u.agent==='猎枭'?450:skill.def.params.ranged?350:180)&&!(r.damageZones||[]).some(z=>z.owner===u&&r.t<z.until)).sort((a,b)=>b.u.syn-a.u.syn||a.u.id.localeCompare(b.u.id));
 if(!candidates.length)return;r.defAreaAttempts[pressure.site]=r.t;
 const {u,skill}=candidates[0];if(!abilities.thinkCast(r,u))return;
 const result=abilities.cast(r,u,skill,{support:true,targetSite:pressure.site});if(!result)return;
 const burst=['雷兹','猎枭'].includes(u.agent),activeAt=r.t+.5+distance(u.position,report.position)/400;
 const z={owner:u,position:{...report.position},radius:28,activeAt,until:activeAt+(burst?1:Math.round((skill.def.params.zoneTicks||6)*result.power)),power:result.power,lastDamageAt:r.t,deny:false,burst};
 (r.damageZones??=[]).push(z);u.abilityBusyUntil=r.t+.5;
 r.emit('molly_zone',{unit:u.name,unitId:u.id,side:u.side,x:z.position.x,y:z.position.y,radius:z.radius,activeAt:z.activeAt,until:z.until,deny:false,burst,support:true});
}

function retakeFlank(r,u,goal){
 const via=profiles[r.map.data.id]?.retakeVia?.[r.plantSite];
 if(!via?.length||r.flags.siteCleared||!r.flags.retakeHit||!['flank','retake','hold'].includes(r.defFamily))return null;
 const cost=(unit,start=0)=>{let position=unit.position,total=0;for(const node of [...via.slice(start),null]){const next=node?r.map.nodes[node]:goal;total+=routeSeconds(r,{...unit,position},next);position=next;}return total;};
 if(!r.flankAssignmentDone){
  r.flankAssignmentDone=true;
  const center=r.map.nodes[r.map.data.staging[r.plantSite]],pool=r.def.filter(d=>d.alive&&!d.saved&&distance(d.position,center)<=90);
  if(r.def.filter(d=>d.alive&&!d.saved).length>=2){const chosen=pool.filter(d=>d.sen>=70&&d.syn>=65&&cost(d)+r.rules.defuseTicks+3<r.spikeLeft).sort((a,b)=>b.sen+b.syn-a.sen-a.syn||a.id.localeCompare(b.id))[0];if(chosen){r.retakeFlanker=chosen.id;r.emit('retake_route',{unit:chosen.name,unitId:chosen.id,site:r.plantSite,via:via.slice()});}}
 }
 if(r.retakeFlanker!==u.id)return null;
 while(u.retakeViaIndex<via.length&&distance(u.position,r.map.nodes[via[u.retakeViaIndex]])<=12)u.retakeViaIndex++;
 if(u.retakeViaIndex>=via.length)return null;
 if(cost(u,u.retakeViaIndex)+r.rules.defuseTicks+1>=r.spikeLeft){r.retakeFlanker=null;return null;}
 return {action:'stageRetake',prior:100,objective:true,node:via[u.retakeViaIndex],flank:true};
}
function wallEffect(r,u,region,ticks){
 const node=r.map.siteNode(region),site=node?r.map.nodes[node]:u.position,profile=r.map.data.tacticalProfile.sites[region];
 const other=profile?r.map.nodes[u.side==='atk'?r.map.data.staging[region]:profile.main.at(-2)]:r.map.nodes.t_spawn;
 const dx=other.x-site.x,dy=other.y-site.y,len=Math.hypot(dx,dy)||1,center={x:site.x+dx*.35,y:site.y+dy*.35};
 for(const offset of [-40,-20,0,20,40]){const smoke={x:center.x-dy/len*offset,y:center.y+dx/len*offset,radius:16,until:r.t+ticks,wall:true};r.geometrySmokes.push(smoke);r.emit('smoke',{node:u.node,side:u.side,by:u.name,...smoke});}
 u.abilityBusyUntil=r.t+.5;
}
