// Versioned Ascent policy. Physical routes/rays remain authoritative.
const abilities=require('./abilities');
const enabled=r=>['ascent-balance-v1','ascent-balance-v2'].includes(r.map.data?.behaviorModel);
const zonesEnabled=r=>r.map.data?.behaviorModel==='ascent-balance-v2';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function routeSeconds(r,u,goal){const route=r.map.geometry.route(u.position,goal,{doors:r.doors});return route?route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0)/(r.map.data.navigationSpeed?.run||32):Infinity;}
function denied(r,position){const z=r.mollyZone;return !!(z?.deny&&r.t<z.until&&distance(position,z.position||r.map.nodes[z.node])<=(z.radius||28))||zonesEnabled(r)&&(r.damageZones||[]).some(z=>z.deny&&r.t>=(z.activeAt||0)&&r.t<z.until&&distance(position,z.position)<=z.radius&&r.map.geometry.canObserve(position,z.position,{doors:r.doors}));}
function deploy(intent,units,map){
 const slots=intent.homes.map((home,i)=>({home,role:intent.roles[i],i,priority:Object.values(map.data.sites).includes(home)?3:intent.roles[i]==='roam'||map.region(home)==='mid'?2:1})).sort((a,b)=>b.priority-a.priority||a.i-b.i),available=new Set(units),homes=[],roles=[];
 for(const slot of slots){const score=u=>slot.priority===3?u.aim*.45+u.sen*.4+u.syn*.15+((u.kit?.skills||[]).some(s=>s.archetype==='trap')?8:0):slot.priority===2?u.aim*.7+u.sen*.3:u.syn+u.sen;
  const u=[...available].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];available.delete(u);homes[u.sideIdx]=slot.home;roles[u.sideIdx]=slot.role;
 }intent.homes=homes;intent.roles=roles;
}
function fire(){
 const contacts=[],ready=[],ordered=this.units.slice().sort((a,b)=>a.id.localeCompare(b.id));
 for(const u of ordered){
  if(!u.alive||u.planting||u.defusing||u.stun>0||u.doorAction||(zonesEnabled(this)&&u.abilityBusyUntil>this.t))continue;
  const visible=this.units.filter(e=>require('./observation').canObserve(this,u,e)).sort((a,b)=>distance(u.position,a.position)-distance(u.position,b.position)||a.id.localeCompare(b.id));
  if(!visible.length){if(u.targetSeenAt!=null&&this.t-u.targetSeenAt>1){u.fireTarget=null;u.fireReadyAt=null;}continue;}
  const target=(this.map.data.autonomyModel&&visible.find(e=>e.id===u.agentTarget))||(u.duelChain&&visible.find(e=>e.id===u.fireTarget))||visible[0];u.targetSeenAt=this.t;
  if(this.map.data.externalEffectsVersion)require('./external-effects').refresh(this,target);
  if(u.fireTarget!==target.id){
   const preaim=!u.moving&&u.post&&u.holdTicks>=2?.12:0;
   const trade=this.map.data.externalEffectsVersion&&require('./external-effects').condition('trade',this,u,target),coordination=trade?Math.max(0,u.syn-50)*.001:0;
   u.fireTarget=target.id;u.fireReadyAt=this.t+Math.max(.08,.2+(100-u.sen)*.003+this.rng()*.08-preaim-coordination);
   const encounter=this.map.engagements?.query(this,u,target);
   this.emit('contact',{unit:u.name,unitId:u.id,side:u.side,targetId:target.id,x:u.position.x,y:u.position.y,readyAt:u.fireReadyAt,preaimSeconds:preaim,...(encounter?{window:encounter.window,fromPosition:encounter.fromPosition,toPosition:encounter.toPosition,visibleFraction:encounter.visible}:{})});contacts.push(u);
  }
  if(u.moving&&u.moving.traversal!=='zipline'&&!['stance','withdraw'].includes(u.moving.purpose))this.interruptMove(u,'contact');
  if(this.t+1e-7>=u.fireReadyAt)ready.push({u,target,at:u.fireReadyAt});
 }
 // Both sides request flashes from the same unmodified contact state.
 this.pendingFlashHits=[];
 const entries=[...new Map([...(this.pendingEntryFlashes||[]),...contacts].filter(u=>u.alive).map(u=>[u.id,u])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 this.pendingEntryFlashes=[];for(const u of entries)abilities.onEntryFlash(this,u);
 for(const {unit,seconds,by}of this.pendingFlashHits){unit.stun=Math.max(unit.stun,seconds);this.emit('flash_hit',{unit:unit.name,unitId:unit.id,by,x:unit.position.x,y:unit.position.y,until:this.t+seconds});}this.pendingFlashHits=null;
 this._shotBatch=[];
 for(const {u,target}of ready.sort((a,b)=>a.at-b.at||a.u.id.localeCompare(b.u.id))){if(u.stun>0)continue;this.tryKill(u,target,false);u.fireReadyAt=this.t+(u.gun===0?.5:.25);}
 const damage=this._shotBatch;this._shotBatch=null;
 for(const {att,tgt,damage:amount,headshot}of damage){if(!tgt.alive)continue;tgt.hp=Math.max(0,tgt.hp-amount);this.emit('damage',{actor:att.name,actorId:att.id,target:tgt.name,targetId:tgt.id,damage:amount,hp:tgt.hp,hitLocation:headshot?'head':'body'});if(tgt.hp===0)this.applyKill(att,tgt);}
}
const watches={a_site:['a_lobby-site-mouth','a_short-door'],a_heaven:['a_site-front','a_lobby-site-mouth'],a_short:['a_lobby-mouth','mid-catwalk-mouth'],b_site:['b_lobby-entry-hold','market-gate-outside'],b_back:['b_lobby-entry-hold','b_site-stairs'],market:['mid_bottom-market-mouth','b_lobby-entry-hold'],mid_bottom:['mid-courtyard-west','mid_top-courtyard-angle']};
function poseScore(r,u,p,hide){
 const node=p.node,targets=watches[node]||r.map.postsAt(node),table=r.map.data.staticVisibility?.[Object.keys(r.map.posts).find(k=>r.map.posts[k]===p)]||{};
 if(hide)return p.cover-Math.min(1,r.sightCount(Object.keys(r.map.posts).find(k=>r.map.posts[k]===p))*.05);
 if(u.side==='def'&&!r.planted){
  const visible=targets.map(k=>table[k]||0),watch=Math.max(0,...visible),other=targets.reduce((s,k)=>s+(table[k]||0),0);
  const partner=r.def?.filter(d=>d!==u&&d.alive&&d.post&&d.node===node)||[];
  const overlap=partner.reduce((s,d)=>s+(distance(p,d.position)<35?.6:0),0);
  return p.cover*.8+watch*1.5+other*.2-overlap;
 }
 return p.cover+.02*Math.min(10,r.sightCount(Object.keys(r.map.posts).find(k=>r.map.posts[k]===p)));
}
function defCandidates(u){
 if(!this.planted)return null;
 const site=this.map.siteNode(this.plantSite),goal=this.spike.position;
 if(this.defuser?.alive&&this.defuser.defusing>0&&this.defuser!==u){
  if(distance(u.position,goal)>110&&!this.visibleEnemiesAt(u).length)return [{action:'approachSpike',prior:100,objective:true}];
  return [{action:'hold',prior:100,objective:true,guardSpike:true}];
 }
 if(u.saved&&!this.flags.siteCleared)return [{action:'hold',prior:5}];
 if(this.visibleEnemiesAt(u).length&&!this.flags.siteCleared){
  if(!denied(this,goal)&&distance(u.position,goal)<110&&abilities.findSkill(u,'smoke'))return [{action:'coverDefuse',prior:100}];
  return [{action:'hold',prior:1.5},{action:'peek',prior:1.2,pers:(u.aim-70)*.04}];
 }
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
 if(u.node===this.map.siteNode(o.site))return {action:'hold',prior:8};
 const seen=Object.values(this.observations.def).some(s=>this.t-s.lastSeenTick<=6&&this.map.region(s.node)===o.site),loss=this.defensiveLosses?.[o.site]?.some(t=>this.t-t<=10);
 if(!seen&&!loss&&this.t-o.assignedAt>6){u.supportOrder=null;u.support=null;u.rotating=false;return {action:'push',prior:7,node:u.homeNode,mode:'run'};}
 u.rotating=true;u.support=o.site;
 return {action:'push',prior:8,node:this.map.siteNode(o.site),mode:'run',event:['support_move',{site:o.site,reason:o.reason}]};
}
function fallback(u){
 if(this.planted||u.fallbackUsed)return null;
 const enemies=this.visibleEnemiesAt(u);if(!enemies.length)return null;
 const cover=this.def.filter(d=>d!==u&&d.alive&&!d.moving&&distance(d.position,u.position)<140&&this.map.geometry.canObserve(d.position,u.position,{doors:this.doors})).length;
 if(enemies.length<=cover+1&&u.hp>=50)return null;
 const candidates=this.map.postsAt(u.node).filter(k=>k!==u.post&&(!this.postOcc[k]||this.postOcc[k]===u)).map(k=>({id:k,p:this.map.posts[k]})).filter(({p})=>distance(u.position,p)>8&&distance(u.position,p)<100);
 const exposure=p=>enemies.reduce((s,e)=>s+this.map.geometry.visibleFraction(p,e.position,{doors:this.doors}),0),current=exposure(u.position);
 const best=candidates.map(c=>({...c,exposure:exposure(c.p)})).filter(c=>c.exposure<current-.4).sort((a,b)=>a.exposure-b.exposure||distance(u.position,a.p)-distance(u.position,b.p)).find(c=>this.map.geometry.route(u.position,c.p,{doors:this.doors}));
 if(best)return {action:'withdrawCover',prior:100,post:best.id};
 return null;
}
function hazardCandidate(r,u){
 const zones=(r.damageZones||[]).filter(z=>z.owner.side!==u.side&&r.t<z.until&&!(z.burst&&z.spent)&&distance(u.position,z.position)<z.radius+5&&r.map.geometry.canObserve(u.position,z.position,{doors:r.doors}));
 if(!zones.length)return null;
 const choices=r.map.postsAt(u.node).filter(k=>k!==u.post&&(!r.postOcc[k]||r.postOcc[k]===u)).map(k=>({id:k,p:r.map.posts[k]})).filter(({p})=>zones.every(z=>distance(p,z.position)>z.radius+5)).sort((a,b)=>distance(u.position,a.p)-distance(u.position,b.p));
 const safe=choices.find(({p})=>r.map.geometry.route(u.position,p,{doors:r.doors}));
 return safe?{action:'evadeHazard',prior:100,objective:true,post:safe.id}:null;
}
function updateHazards(r){
 const damages=[];r.damageZones=(r.damageZones||[]).filter(z=>r.t<z.until);
 for(const z of r.damageZones){if(r.t<(z.activeAt||0)||r.t-z.lastDamageAt<.5||z.burst&&z.spent)continue;z.lastDamageAt=r.t;z.spent=!!z.burst;
  for(const u of r.units)if(u.alive&&u.side!==z.owner.side&&distance(u.position,z.position)<=z.radius&&r.map.geometry.canObserve(u.position,z.position,{doors:r.doors}))damages.push({att:z.owner,tgt:u,damage:(z.burst?28:4)*z.power*(u.armor==='heavy'?.72:u.armor==='light'?.85:1)});
 }
 for(const {att,tgt,damage}of damages){if(!tgt.alive)continue;tgt.hp=Math.max(0,tgt.hp-damage);tgt.nextThinkAt=0;r.emit('damage',{actor:att.name,actorId:att.id,target:tgt.name,targetId:tgt.id,damage,hp:tgt.hp,kind:'area'});if(tgt.hp===0)r.applyKill(att,tgt);}
}
module.exports={enabled,zonesEnabled,fire,poseScore,defCandidates,supportCandidate,routeSeconds,denied,deploy,fallback,hazardCandidate,updateHazards};
