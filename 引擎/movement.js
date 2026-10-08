// 机动：节点间移动、边暴露、静音慢摸、警戒/燃烧触发、进点连锁（从 round.js 拆出，纯代码移动）
const cfg = require('./config');
const abilities = require('./abilities');
const { routePoint,routeSlice } = require('./geometry');
// Cached geometry may have been requested with a full stance or a plain point.
// Movement records in the new behavior contain coordinates only, independent
// of which earlier request warmed the cache. Legacy journals retain their shape.
const canonicalRoute=(round,route)=>round.map.data?.objectiveModel==='defuse-v2'&&route?route.map(p=>({x:p.x,y:p.y})):route;

module.exports = {
  moveToPosition(u,position,options={}){
    const route=canonicalRoute(this,this.map.geometry.route(u.position,position,{doors:this.doors}));if(!route)return false;
    const length=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);if(length<1)return false;
    const to=options.node||u.node,mode=options.mode||'walk',seconds=length/(this.map.data.navigationSpeed?.[mode]||(mode==='run'?32:20));
    this.releasePost(u);this.occ[u.node].delete(u);u.moving={from:u.node,to,dest:to,left:seconds,total:seconds,mode,exposure:0,post:null,route};u.holdTicks=0;
    this.emit('move',{unit:u.name,unitId:u.id,side:u.side,from:u.node,to,ticks:u.moving.total,route});return true;
  },
  interruptMove(u,reason) {
    if(!u.moving)return;const move=u.moving;if(move.post&&this.postOcc[move.post]===u)delete this.postOcc[move.post];u.node=Math.hypot(u.position.x-this.map.nodes[move.to].x,u.position.y-this.map.nodes[move.to].y)<Math.hypot(u.position.x-this.map.nodes[move.from].x,u.position.y-this.map.nodes[move.from].y)?move.to:move.from;
    u.moving=null;u.holdTicks=0;this.occ[u.node].add(u);this.emit('move_stop',{unit:u.name,unitId:u.id,node:u.node,x:u.position.x,y:u.position.y,reason});
  },
  moveToPost(u,pid,mode='walk') {
    const p=this.map.posts[pid],route=canonicalRoute(this,this.map.geometry.route(u.position,p,{doors:this.doors}));if(!route)return false;
    const length=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
    if(length<3||!this.started){u.post=pid;u.position={x:p.x,y:p.y};return true;}
    this.occ[u.node].delete(u);const seconds=length/(mode==='run'?this.map.data.navigationSpeed?.run||32:20);
    u.moving={from:u.node,to:u.node,dest:u.node,left:seconds,total:seconds,mode,exposure:0,post:pid,route};u.post=null;u.holdTicks=0;
    if(require('./behavior-policy').enabled(this))u.moving.purpose='stance';
    this.emit('move',{unit:u.name,unitId:u.id,side:u.side,from:u.node,to:u.node,ticks:u.moving.total,post:pid,route});return true;
  },
  startMove(u, dest, mode) {
    const next = this.map.nextHop[u.node][dest];
    if (!next || next === u.node) return false;
    const edge = this.map.edgeBetween(u.node, next);
    let ticks = edge.ticks;
    let exposure = edge.exposure;
    if (mode === 'walk') {
      ticks = Math.ceil(ticks * cfg.move.silentTickMult);
      exposure *= cfg.move.silentExposureMult;
    }
    if (u.rotating) {
      ticks = Math.max(1, Math.round(ticks * (1 - u.syn * cfg.move.rotateSynCoef)));
      if (u.side === 'def' && this.hasGrowth && this.hasGrowth(u.side, 'retake-rally')) {
        ticks = Math.max(1, ticks - 1);
        this.triggerGrowth(u.side, 'retake-rally', u.name);
      }
      // IGL 指挥机动（效率按 IGL 本人 SYN 缩放）
      const igl = this.iglUnit(u.side);
      if (igl) ticks = Math.max(1, Math.round(ticks * (1 - (1 - cfg.igl.rotateTicksMult) * (igl.syn / 60))));
    }
    if (mode === 'run') u.loudUntil = this.t + 6; // 跑动暴露行踪，可被侦察捕捉
    // 烟雾封锁：防守回防穿越烟雾边减速
    const smokeUntil = this.smokedEdges[this.edgeKey(u.node, next)];
    if (u.side === 'def' && smokeUntil && this.t < smokeUntil) ticks += cfg.utility.smokeRotateDelay;
    // 墙体封锁（冰墙类）：双方穿越都大幅减速
    const wallUntil = this.walledEdges[this.edgeKey(u.node, next)];
    if (wallUntil && this.t < wallUntil) ticks += cfg.abilities.wallTickDelay;
    // 预选到达节点的对枪点（高 SEN 偏好掩体好/枪线多的槽位；进攻慢摸埋伏时回避枪线）
    const hide = mode === 'walk' && u.side === 'atk';
    const previousPost = u.post;
    const post = this.map.postsAt(next).length ? this.pickPost(u, next, true, hide) : null;
    const start = u.position || { x: this.map.nodes[u.node].x, y: this.map.nodes[u.node].y };
    const goal = post && this.map.posts[post]
      ? { x: this.map.posts[post].x, y: this.map.posts[post].y }
      : { x: this.map.nodes[next].x, y: this.map.nodes[next].y };
    let route = edge.route ? [start, ...edge.route, goal] : [start, goal];
    if(edge.traversal==='zipline')route=[start,...edge.route,goal];
    else if (this.map.data?.strictSpatial) {
      if(this.map.data.dynamicDoors&&this.openDoorForRoute(u,goal,next)){if(post&&this.postOcc[post]===u)delete this.postOcc[post];if(previousPost&&!u.moving)this.postOcc[previousPost]=u;return true;}
      route=this.map.geometry.route(start,goal,{doors:this.doors});
    } else if (edge.route && this.map.geometry) {
      if (route.slice(1).some((p,i)=>!this.map.geometry.canTraverse(route[i],p))) route = null;
    } else if (this.map.geometry && this.map.geometry.contains(start) && this.map.geometry.contains(goal)) {
      route = this.map.geometry.route(start, goal);
    }
    route=canonicalRoute(this,route);
      if (!route) {
        if (post && this.postOcc[post] === u) delete this.postOcc[post];
        if (previousPost) this.postOcc[previousPost] = u;
        return false;
      }
    this.occ[u.node].delete(u);
    if (this.map.data?.navigationSpeed) {
      const length=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
      ticks=this.map.data?.strictSpatial ? Math.max(.25,length/this.map.data.navigationSpeed[mode==='walk'?'walk':'run']) : Math.max(1,Math.ceil(length/this.map.data.navigationSpeed[mode==='walk'?'walk':'run']));
      if (u.side==='def' && smokeUntil && this.t<smokeUntil) ticks+=cfg.utility.smokeRotateDelay;
      if (wallUntil && this.t<wallUntil) ticks+=cfg.abilities.wallTickDelay;
    }
    ticks=edge.traversal==='zipline'?edge.traverseSeconds: ticks+(edge.traverseSeconds||0);
    this.releasePost(u); // 移动中 post=null，离开节点释放对枪点
    u.moving = { from: u.node, to: next, dest, left: ticks, total: ticks, mode, exposure, post, route, traversal:edge.traversal };
    u.holdTicks = 0;
    this.emit('move', { unit: u.name, unitId: u.id, side: u.side, from: u.node, to: next, ticks, post, route, ...(edge.traversal?{traversal:edge.traversal}:{}) });
    return true;
  },

  updateMovement() {
    const formationWait=require('./behavior-policy').multimapEnabled(this)?require('./spatial-behavior').formationWaits(this):null;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.stun > 0) {
        if(this.map.data?.strictSpatial&&u.moving&&!u._movePaused){u._movePaused=true;this.emit('move_pause',{unit:u.name,unitId:u.id,x:u.position.x,y:u.position.y});}
        u.stun=Math.max(0,u.stun-(this.map.data?.tickSeconds||1)); continue;
      } // 被警戒道具滞留
      if (!u.moving) continue;
      if(formationWait?.has(u.id)){
        if(!u._movePaused){u._movePaused=true;this.emit('move_pause',{unit:u.name,unitId:u.id,x:u.position.x,y:u.position.y,reason:'formation'});}
        continue;
      }
      const priorLeft=u.moving.left;
      u.moving.left=Math.max(0,u.moving.left-(this.map.data?.tickSeconds||1));
      const nextPosition=routePoint(u.moving.route, (u.moving.total-u.moving.left)/u.moving.total);
      const traversed=this.map.data.spatialVersion===6||this.map.data.objectiveModel==='defuse-v2'?routeSlice(u.moving.route,(u.moving.total-priorLeft)/u.moving.total,(u.moving.total-u.moving.left)/u.moving.total):[u.position,nextPosition];
      if(this.map.data.dynamicDoors&&traversed.slice(1).some((p,i)=>!(u.moving.traversal==='zipline'&&this.map.geometry.onNavigationLink(traversed[i],'zipline')&&this.map.geometry.onNavigationLink(p,'zipline'))&&!this.map.geometry.canWalk(traversed[i],p,u,{doors:this.doors}))){this.interruptMove(u,'blocked-door-or-wall');continue;}
      u.position = nextPosition;
      if(this.map.geometry?.contains(nextPosition,{doors:this.doors}))u.lastGroundPosition={...nextPosition};
      if(this.map.data?.strictSpatial&&u._movePaused){u._movePaused=false;this.emit('move_resume',{unit:u.name,unitId:u.id,x:u.position.x,y:u.position.y,left:u.moving.left,total:u.moving.total});}
      if (u.moving.left > 0) continue;
      const mv = u.moving;
      u.moving = null;
      u.node = mv.to;
      u.post = mv.post || null; // 落位到预选的对枪点（无 posts 的节点保持节点级）
      u.holdTicks = 0;
      this.occ[u.node].add(u);
      // 哨卫警戒：进攻方踩点触发；高 SEN 可识破规避，静音慢摸更谨慎
      if (u.side === 'atk' && this.traps[u.node] > 0) {
        this.traps[u.node]--;
        const region = this.map.region(u.node);
        const avoidP = cfg.utility.trapAvoidBase + u.sen * cfg.utility.trapAvoidSen + (mv.mode === 'walk' ? 0.15 : 0);
        if (this.rng() < avoidP) {
          this.emit('trap_spotted', { node: u.node, unit: u.name });
        } else {
          this.addInfo(region, cfg.utility.trapInfo);
          u.stun = cfg.utility.trapStun + (this.trapPower[u.node] || 0); // 招牌陷阱（零绊线等）滞留更久
          this.emit('trap', { node: u.node, unit: u.name, region });
        }
      }
      // 信息暴露：进攻方过点被防守方察觉
      if (u.side === 'atk') {
        const region = this.map.region(u.node);
        if (!this.map.data?.strictSpatial && region !== 'spawn' && this.rng() < mv.exposure) {
          this.addInfo(region, cfg.ai.spotInfo);
          this.emit('spotted', { node: u.node, unit: u.name, region });
        }
        // 进攻方踩进包点 => 进攻方向落实；到位选手自主决定是否封烟掩护（阻断回防路线）
        if ((Object.values(this.map.data.sites).includes(u.node)) && !this.committedSite) {
          this.committedSite = this.map.region(u.node);
          if (!this.atkSmokeUsed && abilities.onCommitSmoke(this, u)) this.atkSmokeUsed = true;
        }
      }
      // 预置燃烧（赌点全押）：进攻踩进该点即激活火线封锁，预置火线持续更久
      if (u.side === 'atk' && this.presetMolly[u.node] > 0 && !(this.mollyZone && this.t < this.mollyZone.until)) {
        this.presetMolly[u.node]--;
        this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks + 2 };
        this.emit('molly_entry', { node: u.node, preset: true });
      }
      // 进点燃烧弹：点内守军自主决定是否封火（优先 molly 技能），后续进点者被火线逼停
      if (u.side === 'atk' && (Object.values(this.map.data.sites).includes(u.node)) && this.enemiesAt(u.node, 'atk').length > 0) {
        const region = this.map.region(u.node);
        if (!this.defEntryMolly[region]) {
          const candidates = [];
          for (const d of this.def) {
            if (d.alive && (d.utils > 0 || abilities.findSkill(d, 'molly')) && this.map.region(d.node) === region) candidates.push(d);
          }
          candidates.sort((a, b) => b.syn - a.syn);
          for (const thrower of candidates) {
            const r = abilities.triggerCast(this, thrower, 'molly', { node: u.node, entry: true });
            if (r) {
              this.defEntryMolly[region] = true;
              this.mollyZone = { node: u.node, until: this.t + cfg.utility.mollyZoneTicks };
              this.emit('molly_entry', { node: u.node, by: thrower.name });
              break;
            }
          }
        }
      }
      // 穿越火线：被燃烧弹逼停（deny=守包燃烧拦防守，普通=进点燃烧拦进攻）
      if (this.mollyZone && this.t < this.mollyZone.until && (require('./behavior-policy').enabled(this)?Math.hypot(u.position.x-(this.mollyZone.position||this.map.nodes[this.mollyZone.node]).x,u.position.y-(this.mollyZone.position||this.map.nodes[this.mollyZone.node]).y)<=(this.mollyZone.radius||28):u.node === this.mollyZone.node)
        && (this.mollyZone.deny ? u.side === 'def' : u.side === 'atk')) {
        u.stun = Math.max(u.stun, 3);
        this.emit('molly_block', { node: u.node, unit: u.name });
      }
      // 进点遭遇：架点方抢先枪
      this.entryFight(u);
      // 到达后立即做一次决策（继续推进/落位驻守）
      if (u.alive) this.think(u, true);
    }
  }
};
