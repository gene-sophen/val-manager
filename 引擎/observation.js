const { lineIntersectsCircle } = require('./geometry');

function canObserve(round, observer, target) {
  if (!observer.alive || !target.alive || observer.side === target.side || (observer.moving && !round.map.data?.strictSpatial)) return false;
  if (round.map.data?.strictSpatial) {
    if(!observer.position||!target.position)return false;
    if(round.map.engagements)return round.map.engagements.query(round,observer,target).visible>0;
    return round.map.geometry.visibleFraction(observer.position,target.position,{doors:round.doors,smokes:(round.geometrySmokes||[]).filter(s=>round.t<s.until)})>0;
  }
  if (round.map.geometry && observer.position && target.position
    && round.map.geometry.contains(observer.position) && round.map.geometry.contains(target.position)) {
    if (!round.map.geometry.lineOfSight(observer.position, target.position)) return false;
    if ((round.geometrySmokes || []).some(smoke => round.t < smoke.until
      && lineIntersectsCircle(observer.position, target.position, smoke, smoke.radius))) return false;
    return true;
  }
  if (observer.node === target.node) {
    return (!observer.post || !target.post || round.map.canSee(observer.post, target.post))
      && (!observer.post || !target.post || !round.sightBlocked(observer.post, target.post));
  }
  return !!(observer.post && target.post && round.map.canSee(observer.post, target.post)
    && !round.sightBlocked(observer.post, target.post));
}

function recordObservations(round) {
  round.observations ||= { atk: {}, def: {} };
  if(round.map.data?.informationPolicy==='delayed-reports') {
    round.localObservations ||= {};round.pendingReports ||= new Map();
    for(const observer of round.units) {
      if(!observer.alive)continue;
      const local=round.localObservations[observer.id] ||= {};
      for(const target of round.units) {
        if(!canObserve(round,observer,target))continue;
        const previous=local[target.id];
        const currentNode=target.moving ? Object.entries(round.map.nodes).reduce((best,[id,p])=>Math.hypot(p.x-target.position.x,p.y-target.position.y)<best.distance?{id,distance:Math.hypot(p.x-target.position.x,p.y-target.position.y)}:best,{id:target.node,distance:Infinity}).id : target.node;
        const sight={id:target.id,name:target.name,node:currentNode,position:{...target.position},lastSeenTick:round.t,source:'vision',observerId:observer.id};
        local[target.id]=sight;
        if(!previous||round.t-previous.lastSeenTick>1)round.emit('sighting',{side:observer.side,observer:observer.name,observerId:observer.id,target:target.name,targetId:target.id,node:sight.node,x:target.position.x,y:target.position.y});
        const key=observer.id+':'+target.id;if(!round.pendingReports.has(key))round.pendingReports.set(key,{side:observer.side,sight,deliverAt:round.t+.25+(100-observer.syn)*.004});
      }
    }
    for(const [key,report]of round.pendingReports)if(report.deliverAt<=round.t){const memory=round.observations[report.side],prior=memory[report.sight.id];if(!prior||prior.lastSeenTick<=report.sight.lastSeenTick)memory[report.sight.id]={...report.sight,source:'teammate-report',reportedAt:round.t};round.pendingReports.delete(key);}
    for(const memory of [round.observations.atk,round.observations.def,...Object.values(round.localObservations)])for(const [id,item]of Object.entries(memory))if(round.t-item.lastSeenTick>6)delete memory[id];
    return;
  }
  for (const observer of round.units) {
    if (!observer.alive) continue;
    for (const target of round.units) {
      if (!canObserve(round, observer, target)) continue;
      const id = target.id || `${target.side}:${target.name}`;
      const memory = round.observations[observer.side];
      const previous = memory[id];
      memory[id] = { id, name: target.name, node: target.node, position: target.position && { ...target.position },
        lastSeenTick: round.t, source: 'vision' };
      if (!previous || round.t - previous.lastSeenTick > 1) round.emit('sighting', { side: observer.side, observer: observer.name, target: target.name, targetId: id, node: target.node });
    }
  }
  for (const memory of Object.values(round.observations)) {
    for (const [id, item] of Object.entries(memory)) if (round.t - item.lastSeenTick > 8) delete memory[id];
  }
}

function observedRegionalCounts(round, observers, targets) {
  const counts = Object.fromEntries(Object.keys(round.map.data.sites).map(s=>[s,0]));
  for (const target of targets) {
    if (!target.alive) continue;
    const region = round.map.region(target.node);
    if (!(region in counts)) continue;
    if (observers.some(observer => canObserve(round, observer, target))) counts[region]++;
  }
  return counts;
}

module.exports = { canObserve, observedRegionalCounts, recordObservations };
