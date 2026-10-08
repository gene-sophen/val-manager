// Team communications, not access to the attackers' hidden plan or positions.
// Used by calibrated campaign maps; legacy scenarios keep their old policy.
function enabled(round) { return round.map.data?.defenseSupport === 'contact-casualty'; }
function destination(u) { return u.moving?.dest || u.node; }
const sites=round=>Object.keys(round.map.data.sites);
const emptyLosses=round=>Object.fromEntries(sites(round).map(s=>[s,[]]));

module.exports = {
  defensiveFallbackCandidate(u) {
    if(require('./behavior-policy').enabled(this))return require('./behavior-policy').fallback.call(this,u);
    if (!enabled(this) || this.planted) return null;
    if (u.supportOrder?.reason==='fallback' && u.node!==this.map.data.staging[u.supportOrder.site])
      return this.defenseSupportCandidate(u);
    if (u.fallbackUsed || !Object.values(this.map.data.sites).includes(u.node)) return null;
    const seen=this.visibleEnemiesAt(u);
    const cover=this.def.filter(d=>d.alive&&!d.moving&&d.position
      && Math.hypot(d.position.x-u.position.x,d.position.y-u.position.y)<140
      && (this.map.data.dynamicDoors?this.map.geometry.canObserve(d.position,u.position,{doors:this.doors}):this.map.geometry.lineOfSight(d.position,u.position))).length;
    const enhanced=require('./behavior-policy').enabled(this);
    if (seen.length<=(enhanced?cover:cover+1)) {u.pressureSince=null;return null;}
    u.pressureSince ??= this.t;
    const delay=enhanced?.25+(100-u.sen)*.005:Math.max(1,Math.ceil((110-u.sen)/35));
    if(this.t-u.pressureSince<delay)return null;
    const site=this.map.region(u.node);
    u.fallbackUsed=true;
    u.supportOrder={site,reason:'fallback',phase:'withdraw',readyAt:this.t,assignedAt:this.t};
    this.emit('fallback', {unit:u.name,unitId:u.id,site,observedEnemies:seen.length,cover});
    return this.defenseSupportCandidate(u);
  },

  reportDefensiveLoss(victim) {
    if (!enabled(this) || this.planted || victim.side !== 'def') return;
    const site = this.map.region(victim.node);
    if (!sites(this).includes(site)) return;
    this.defensiveLosses ||= emptyLosses(this);
    this.defensiveLosses[site].push(this.t);
    this.addInfo(site, 6, false);
    this.emit('defense_loss', { site, unit: victim.name, unitId: victim.id });
  },

  updateDefenseSupport() {
    if(require("./behavior-policy").multimapEnabled(this))return require("./behavior-policy").updateDefenseSupport.call(this);
    if (!enabled(this) || this.planted) return;
    this.defensiveLosses ||= emptyLosses(this);
    const known = this.observations.def, counts = Object.fromEntries(sites(this).map(s=>[s,0]));
    // Sightings persist across different decision phases, but quickly expire.
    for (const sight of Object.values(known)) {
      if (this.t - sight.lastSeenTick > 6) continue;
      const site = this.map.region(sight.node);
      if (site in counts) counts[site]++;
    }
    const pressures = sites(this).map(site => {
      const losses = this.defensiveLosses[site].filter(t => this.t - t <= 10);
      this.defensiveLosses[site] = losses;
      const info = this.defInfo[site];
      const trustedContact = !info.suspicious && this.t - info.tick <= 6 && info.strength >= 9;
      return { site, losses: losses.length, contacts: counts[site],
        need: losses.length || counts[site] >= 2 || trustedContact,
        score: losses.length * 4 + counts[site] + (trustedContact ? 1 : 0) };
    }).filter(p => p.need).sort((a,b) => b.score-a.score);
    for (const p of pressures) {
      const opposite = sites(this).filter(site=>site!==p.site);
      // Same-region labels do not imply covering the site: rafters/market can
      // be around a blind corner. They must also be able to reinforce a loss.
      const siteNode=this.map.siteNode(p.site);
      const local = this.def.filter(u => u.alive && (destination(u)===siteNode
        || (this.map.region(destination(u))===p.site && this.hasVisibleEnemy(u))));
      const assigned = this.def.filter(u => u.alive && u.supportOrder?.site === p.site);
      const desired = Math.min(4, Math.max(2, p.contacts + (p.losses ? 1 : 0)));
      let needed = Math.min(2, desired - new Set([...local, ...assigned]).size);
      const candidates = this.def.filter(u => u.alive && !u.saved && !u.defusing && !u.supportOrder
        && destination(u)!==siteNode && !this.hasVisibleEnemy(u))
        .sort((a,b) => (this.map.data.strictSpatial?this.map.travelTime(destination(a),this.map.data.staging[p.site]):this.bfsDist(destination(a),this.map.data.staging[p.site]))
          - (this.map.data.strictSpatial?this.map.travelTime(destination(b),this.map.data.staging[p.site]):this.bfsDist(destination(b),this.map.data.staging[p.site])) || b.syn-a.syn);
      for (const u of candidates) {
        if (needed <= 0) break;
        const from = this.map.region(destination(u));
        // Keep an opposite-site anchor. A fake or one casualty cannot empty it.
        if (opposite.includes(from) && this.def.filter(d => d.alive && !d.supportOrder
          && this.map.region(destination(d)) === from).length <= 1) continue;
        const delay = require('./behavior-policy').enabled(this)?.25+(100-u.sen)*.005:Math.max(1, Math.ceil((110-u.sen)/35));
        u.supportOrder = { site:p.site, readyAt:this.t+delay, assignedAt:this.t,
          reason:p.losses?'casualty':'contact' };
        this.emit('support_call', { unit:u.name, unitId:u.id, site:p.site, readyAt:u.supportOrder.readyAt,
          reason:u.supportOrder.reason, observedEnemies:p.contacts });
        needed--;
      }
    }
  },

  defenseSupportCandidate(u) {
    if(require('./behavior-policy').enabled(this))return require('./behavior-policy').supportCandidate.call(this,u);
    if (!enabled(this) || !u.supportOrder || this.planted) return null;
    const order = u.supportOrder, site = order.site, siteNode = this.map.siteNode(site);
    if (this.t < order.readyAt) return { action:'hold', prior:9 };
    const info = this.defInfo[site];
    const seen = Object.values(this.observations.def).some(s => this.t-s.lastSeenTick<=6 && this.map.region(s.node)===site);
    const recentLoss = (this.defensiveLosses?.[site]?.length || 0) > 0;
    if (!seen && !recentLoss && (info.suspicious || info.strength < 6) && this.t-order.assignedAt>6) {
      u.supportOrder=null;u.support=null;u.rotating=false;
      this.emit('support_cancel', { unit:u.name, unitId:u.id, site });
      return { action:'push', prior:7, node:u.homeNode, mode:'run' };
    }
    u.rotating=true;u.support=site;
    if(order.reason==='fallback' && order.phase==='withdraw') {
      const staging=this.map.data.staging[site];
      if(u.node!==staging)return {action:'push',prior:9,node:staging,mode:'run'};
      order.phase='regroup';
    }
    if (u.node === siteNode) return { action:'hold', prior:8 };
    const staging = this.map.data.staging[site];
    if (u.node === staging) {
      const allies = this.def.filter(d => d.alive && !d.moving && (d.node===staging || d.node===siteNode));
      if(order.reason==='fallback' && allies.length<2)return {action:'hold',prior:8};
      if (!recentLoss || allies.length>=2 || this.t-order.assignedAt>=10)
        return { action:'push', prior:8, node:siteNode, mode:'run' };
      return { action:'hold', prior:8 };
    }
    return { action:'push', prior:8, node:staging, mode:'run',
      event:['support_move', { site, reason:order.reason }] };
  }
};
