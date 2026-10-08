// Ten independent simulation actors; local perception + allied communication.
// No language model, global enemy plan or cosmetic teleportation is involved.
const A=require('./ascent-behavior'),V=require('./spatial-behavior-v2');
const enabled=r=>r.map?.data?.autonomyModel==='agents-1';
const base=r=>r.map.data.id==='ascent'?A:V,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const out={enabled};
for(const name of ['zonesEnabled','poseScore','routeSeconds','denied','hazardCandidate','updateHazards'])out[name]=(r,...args)=>base(r)[name](r,...args);
for(const name of ['fire','supportCandidate','fallback','updateDefenseSupport'])out[name]=function(...args){return base(this)[name].apply(this,args);};
out.deploy=(intent,units,map)=>base({map}).deploy(intent,units,map);
function memory(u){return u.agentMemory??={nextAngleAt:u.side==='def'?10+u.sideIdx*2.2:5+u.sideIdx*.7,phase:'hold',anchor:null,until:0,lastChoice:null};}
const checkDelay=u=>u.side==='def'?18+(100-u.sen)*.05+u.sideIdx*.6:5+(100-u.sen)*.035+u.sideIdx*.3;
function tell(r,u,choice,reason,extra={}){
 const m=memory(u);if(m.lastChoice!==choice||r.t-(m.lastLoggedAt??-99)>=6){r.emit('agent_decision',{unit:u.name,unitId:u.id,side:u.side,choice,reason,...extra});m.lastChoice=choice;m.lastLoggedAt=r.t;}
}
function retainsWatch(r,anchor,p,u){
 const g=r.map.geometry,state={doors:r.doors};
 const targets=Object.values(r.map.posts).filter(t=>t.node!==u.node&&dist(anchor,t)<250&&g.visibleFraction(anchor,t,state)>0).sort((a,b)=>dist(anchor,a)-dist(anchor,b)).slice(0,6);
 if(!targets.length)return true;
 const watch=q=>targets.reduce((s,t)=>s+g.visibleFraction(q,t,state),0),exposure=q=>targets.reduce((s,t)=>s+g.visibleFraction(t,q,state),0);
 return watch(p)>=watch(anchor)-.1&&exposure(p)<=exposure(anchor)+.34;
}
function transit(r,u){
 if(r.planted||u.saved||u.assignedPickup||r.spike.node&&!r.spike.carrier)return null;
 const intent=r.atkIntent,route=intent.routes[u.role]||[],m=memory(u),commit=r.t>=intent.pace.commitTick||r.forceCommitted||r.committedSite;
 const signalled=intent.fakeout&&u.role==='real'&&r.atk.some(a=>a.role==='decoy'&&a.fakeDone);
 if(signalled)m.feintSeenAt??=r.t;
 const fakeReady=signalled&&r.t-m.feintSeenAt>=2+(100-u.syn)*.015;
 if(commit||!route.length)return null;
 const delay=.35+u.sideIdx*.2+(100-u.syn)*.005;if(r.t<delay){tell(r,u,'prepare','opening-spacing');return [{action:'agentHold',prior:100,objective:true}];}
 const index=route.indexOf(u.node),known=Number.isInteger(intent.limitIdx[u.role])?intent.limitIdx[u.role]:0;
 const firstSite=route.findIndex(n=>Object.values(r.map.data.sites).includes(n));
 // A lurk route may continue through a site, CT and another site. Its staging
 // limit is the first site entrance, never the penultimate node of that tour.
 let limit=Math.max(known,Math.max(0,firstSite>0?firstSite-1:route.length-2));
 if(u.role==='mid'&&known>0)limit=known;
 if(u.role==='decoy')limit=route.length-1;
 if(fakeReady){limit=route.length-1;tell(r,u,'execute','feint-confirmed');}
 const progress=Math.max(index,u.routeProg||0),next=index<0&&!(u.routeProg>0)?route[0]:progress<limit?route[progress+1]:null;
 if(next){tell(r,u,'approach',fakeReady?'feint-confirmed':'early-map-control',{goal:next});return [{action:'push',node:next,mode:r.map.region(u.node)==='spawn'||r.atkFamily==='rush'?'run':'walk',prior:100,objective:true}];}
 if(u.role==='decoy'&&intent.fakeout&&r.t>=intent.fakeout.fakeTick&&!u.fakeDone)return null;
 tell(r,u,'stage','await-execution',{goal:u.node});return angle(r,u)||[{action:'agentHold',prior:4,objective:true}];
}
function angle(r,u){
 const m=memory(u);
 if(m.phase==='peek'){
  if(r.t<m.until)return [{action:'agentHold',prior:100,objective:true}];
  if(m.anchor&&dist(u.position,m.anchor)>=1&&dist(u.position,m.anchor)<=40&&(!r.postOcc[m.anchorPost]||r.postOcc[m.anchorPost]===u)&&r.map.geometry.canWalk(u.position,m.anchor,u,{doors:r.doors}))return [{action:'agentMove',goal:m.anchor,post:m.anchorPost,reason:'reset-angle',prior:100,objective:true,returning:true}];
  m.phase='hold';m.anchor=null;m.nextAngleAt=r.t+checkDelay(u);
 }
 if(r.t<m.nextAngleAt||!u.post||u.supportOrder||u.isCarrier&&r.planted||u.saved)return null;
 const anchor={...u.position},post=r.map.posts[u.post],free=r.map.postsAt(u.node).filter(id=>id!==u.post&&(!r.postOcc[id]||r.postOcc[id]===u)).map(id=>({...r.map.posts[id],id}));
 const proposed=post?.peekTo?r.map.posts[post.peekTo]:null;
 const guard=u.side==='def'&&!r.planted,step=guard?3:12;
 const reported=Object.values(r.observations?.[u.side]||{}).some(e=>r.t-e.lastSeenTick<=6&&(e.position&&dist(anchor,e.position)<250||r.map.region(e.node)===r.map.region(u.node)));
 if(guard&&(r.t-u.lastShotTick<4||reported))return null;
 // A prepared defender checks the same entrance from a nearby shoulder, rather
 // than abandoning a useful guard for an arbitrary free slot. Paired guards
 // never both check at once. Awareness still controls the individual cadence.
 if(guard&&r.units.some(a=>a!==u&&a.alive&&a.side===u.side&&a.node===u.node&&a.agentMemory?.phase==='peek'))return null;
 const points=[proposed,...free,...[[step,0],[-step,0],[0,step],[0,-step]].map(([x,y])=>({x:anchor.x+x,y:anchor.y+y}))].filter(p=>p&&dist(anchor,p)>=(guard?2:6)&&dist(anchor,p)<=(guard?6:35)&&r.map.geometry.heightAt(p)===r.map.geometry.heightAt(anchor)&&r.map.geometry.canWalk(anchor,p,u,{doors:r.doors})&&!r.units.some(a=>a!==u&&a.alive&&dist(a.position,p)<(guard?2:8))&&(!guard||retainsWatch(r,anchor,p,u)));
 m.nextAngleAt=r.t+checkDelay(u);if(!points.length)return null;
 const p=points[u.sideIdx%points.length];m.anchor=anchor;m.anchorPost=u.post;m.phase='peek';m.until=r.t+dist(anchor,p)/(r.map.data.navigationSpeed?.walk||20)+1.25;
 return [{action:'agentMove',goal:{x:p.x,y:p.y},post:p.id,reason:'check-angle',prior:100,objective:true}];
}
function encounter(r,u){
 const visible=r.visibleEnemiesAt(u);if(!visible.length){u.agentTarget=null;return null;}
 const mates=r.units.filter(a=>a!==u&&a.alive&&a.side===u.side&&dist(a.position,u.position)<160),trading=mates.some(a=>visible.some(e=>a.fireTarget===e.id||r.t-a.lastShotTick<1));
 const assisted=mates.find(a=>visible.some(e=>e.id===a.fireTarget));u.agentTarget=u.syn>=55&&assisted?assisted.fireTarget:null;
 const retreat=u.side==='def'&&base(r).fallback.call(r,u);if(retreat){tell(r,u,'reposition','exposed-or-outnumbered');return [retreat];}
 tell(r,u,trading&&u.syn>=55?'trade-cover':'duel',trading?'teammate-engaged':'visible-contact',{targets:visible.map(e=>e.id)});
 // An acquired target is not dropped merely to generate movement. Actual
 // retreat, damage zones and objective pressure can still override this.
 return [{action:'agentHold',prior:3+(u.sen/100),reason:trading?'trade-cover':'duel'}];
}
out.atkCandidates=function(u){const fight=encounter(this,u);if(fight)return fight;const approach=transit(this,u);if(approach)return approach;if(this.planted&&this.map.region(u.node)===this.plantSite)return angle(this,u);return null;};
out.defCandidates=function(u){
 if(this.planted){const objective=base(this).defCandidates.call(this,u);if(objective)return objective;}
 const fight=encounter(this,u);if(fight&&!u.defusing)return fight;
 const objective=base(this).defCandidates.call(this,u);if(objective)return objective;
 if(!this.planted&&!u.supportOrder&&u.role!=='roam')return angle(this,u);return null;
};
out.execute=function(u,c){
 if(c.action==='agentHold'){u.peeking=-99;return true;}
 if(['push','rotate','stageRetake','reinforceSite','approachSpike','defuse','save'].includes(c.action)){const m=memory(u);m.phase='hold';m.anchor=null;}
 if(c.action!=='agentMove')return false;
 const m=memory(u);if(!this.map.geometry.canWalk(u.position,c.goal,u,{doors:this.doors})){m.phase='hold';m.anchor=null;return true;}
 if(this.moveToPosition(u,c.goal,{mode:'walk'})){u.moving.purpose='angle';if(c.post&&(!this.postOcc[c.post]||this.postOcc[c.post]===u)){this.postOcc[c.post]=u;u.moving.post=c.post;}tell(this,u,'reposition',c.reason,{goal:c.goal});if(c.returning){m.phase='hold';m.anchor=null;}}
 return true;
};
out.postChoices=(r,u,free)=>r.map.data.id==='ascent'?free:V.postChoices(r,u,free);
module.exports=out;
