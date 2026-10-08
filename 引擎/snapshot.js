const { routePoint } = require('./geometry');

function snapshotAt(events, tick, map) {
  const start = events.find(event => event.type === 'round_start');
  if (!start) throw new Error('回放缺少 round_start');
  const units = Object.fromEntries(start.units.map(unit => [unit.id || `${unit.side}:${unit.name}`, {
    id: unit.id || `${unit.side}:${unit.name}`, name: unit.name, side: unit.side,
    node: unit.node, post: null, alive: true, hp: unit.hp ?? 100, ammo: unit.ammo ?? null,
    position: unit.position ? {...unit.position} : { x: map.nodes[unit.node].x, y: map.nodes[unit.node].y }, moving: null,
    agent: unit.agent, igl: unit.igl, role: unit.role, carrier: unit.carrier
  }]));
  const find = (id, name, side) => units[id] || Object.values(units).find(unit => unit.name === name && (!side || unit.side === side));
  const positionAt = (unit, time) => {
    if (!unit?.moving || unit.moving.paused) return;
    const move = unit.moving;
    unit.position = routePoint(move.route, (time - move.startedAt) / move.ticks);
    if (time >= move.startedAt + move.ticks) {
      unit.node = move.to;
      unit.post = move.post || null;
      unit.moving = null;
    }
  };
  for (const event of events) {
    if (event.t < 0 || event.t > tick || event.type === 'round_start') continue;
    const unit = find(event.unitId || event.victimId || event.targetId || event.actorId,
      event.unit || event.victim || event.target || event.actor, event.side);
    positionAt(unit, event.t);
    if (event.type === 'move' && unit) {
      const end = event.post && map.posts[event.post] || map.nodes[event.to];
      unit.moving = { startedAt: event.t, ticks: event.ticks, to: event.to, post: event.post, traversal:event.traversal,
        route: event.route || [unit.position, { x: end.x, y: end.y }] };
    } else if(event.type==='move_pause'&&unit?.moving){unit.position={x:event.x,y:event.y};unit.moving.paused=true;
    } else if(event.type==='move_resume'&&unit?.moving){unit.position={x:event.x,y:event.y};unit.moving.paused=false;unit.moving.startedAt=event.t-(event.total-event.left);
    } else if(event.type==='move_stop'&&unit){unit.position={x:event.x,y:event.y};unit.node=event.node;unit.moving=null;unit.post=null;
    } else if (event.type === 'post_pick' && !event.deferred && unit && !unit.moving && map.posts[event.post]
      && (!map.strictSpatial || (event.node===unit.node&&Math.hypot(unit.position.x-map.posts[event.post].x,unit.position.y-map.posts[event.post].y)<=3))) {
      unit.post = event.post;
      unit.position = { x: map.posts[event.post].x, y: map.posts[event.post].y };
    } else if(event.type==='object_damage'&&unit){unit.ammo=event.ammo;
    } else if (event.type === 'shot') {
      const shooter = find(event.actorId, event.actor);
      if (shooter) shooter.ammo = event.ammo;
    } else if (event.type === 'damage' && unit) unit.hp = event.hp;
    else if (event.type === 'kill' && unit) {
      unit.alive = false; unit.hp = 0; unit.moving = null;
      if (Number.isFinite(event.x) && Number.isFinite(event.y)) unit.position = { x: event.x, y: event.y };
    } else if (event.type === 'reload_end' && unit) unit.ammo = event.ammo;
    else if (event.type === 'ability' && event.archetype === 'revive' && event.done && unit) {
      unit.alive = true; unit.hp = event.hp ?? 100; unit.node = event.node; unit.post = null;
      unit.position = { x: map.nodes[event.node].x, y: map.nodes[event.node].y };
    }
  }
  for (const unit of Object.values(units)) positionAt(unit, tick);
  const state={tick,units};
  if(map.dynamicDoors){state.doors={...start.doors};for(const e of events)if(e.type==='door'&&e.t<=tick)state.doors[e.doorId]=e.state;}
  return state;
}

module.exports = { snapshotAt };
