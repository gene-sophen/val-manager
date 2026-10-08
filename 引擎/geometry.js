const EPSILON = 1e-7;

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, p) {
  return Math.min(a.x, b.x) - EPSILON <= p.x && p.x <= Math.max(a.x, b.x) + EPSILON
    && Math.min(a.y, b.y) - EPSILON <= p.y && p.y <= Math.max(a.y, b.y) + EPSILON;
}

function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (Math.abs(abC) <= EPSILON && onSegment(a, b, c)) return true;
  if (Math.abs(abD) <= EPSILON && onSegment(a, b, d)) return true;
  if (Math.abs(cdA) <= EPSILON && onSegment(c, d, a)) return true;
  if (Math.abs(cdB) <= EPSILON && onSegment(c, d, b)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function inRectangle(p, r) {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lineIntersectsCircle(a, b, center, radius) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(a.x + dx * t - center.x, a.y + dy * t - center.y) <= radius;
}

function routePoint(route, progress) {
  if (!Array.isArray(route) || !route.length) throw new Error('移动路径为空');
  if (route.length === 1 || progress <= 0) return { x: route[0].x, y: route[0].y };
  const last = route[route.length - 1];
  if (progress >= 1) return { x: last.x, y: last.y };
  const total = route.slice(1).reduce((sum, point, index) => sum + distance(route[index], point), 0);
  let remaining = total * progress;
  for (let i = 1; i < route.length; i++) {
    const segment = distance(route[i - 1], route[i]);
    if (remaining <= segment) {
      const fraction = segment > 0 ? remaining / segment : 0;
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * fraction,
        y: route[i - 1].y + (route[i].y - route[i - 1].y) * fraction };
    }
    remaining -= segment;
  }
  return { x: last.x, y: last.y };
}

class Geometry {
  constructor(data) {
    if (!data || !Array.isArray(data.walkable) || !Array.isArray(data.walls)) throw new Error('缺少二维地图几何');
    this.data = data;
    this.walkable = data.walkable;
    this.walls = data.walls.map(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]);
    this.waypoints = data.waypoints || [];
  }

  contains(p) {
    return Number.isFinite(p.x) && Number.isFinite(p.y)
      && this.walkable.some(r => inRectangle(p, r))
      && !this.walls.some(([a, b]) => Math.abs(cross(a, b, p)) <= EPSILON && onSegment(a, b, p));
  }

  lineOfSight(a, b, smoke = []) {
    if (!this.contains(a) || !this.contains(b)) return false;
    if (this.data.strictFloorSight && !this.floorSegment(a, b)) return false;
    return ![...this.walls, ...smoke.map(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }])]
      .some(([c, d]) => intersects(a, b, c, d));
  }

  canTraverse(a, b) {
    if (!this.lineOfSight(a, b)) return false;
    return this.floorSegment(a, b);
  }

  floorSegment(a, b) {
    const length = distance(a, b);
    const steps = Math.max(1, Math.ceil(length / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.contains({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  route(start, end) {
    if (!this.contains(start) || !this.contains(end)) return null;
    const points = [start, ...this.waypoints, end];
    const target = points.length - 1;
    const best = Array(points.length).fill(Infinity);
    const prev = Array(points.length).fill(-1);
    const visited = new Set();
    best[0] = 0;
    while (visited.size < points.length) {
      let current = -1;
      for (let i = 0; i < points.length; i++) {
        if (!visited.has(i) && (current < 0 || best[i] < best[current])) current = i;
      }
      if (current < 0 || !Number.isFinite(best[current])) break;
      if (current === target) break;
      visited.add(current);
      for (let other = 0; other < points.length; other++) {
        if (visited.has(other) || other === current || !this.canTraverse(points[current], points[other])) continue;
        const candidate = best[current] + distance(points[current], points[other]);
        if (candidate < best[other]) { best[other] = candidate; prev[other] = current; }
      }
    }
    if (!Number.isFinite(best[target])) return null;
    const route = [];
    for (let at = target; at >= 0; at = prev[at]) {
      route.unshift(points[at]);
      if (at === 0) break;
    }
    return route;
  }
}

function routeSlice(route,from,to){
  const total=route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0),result=[routePoint(route,from)];let travelled=0;
  for(let i=1;i<route.length;i++){travelled+=distance(route[i-1],route[i]);if(travelled>total*from+1e-7&&travelled<total*to-1e-7)result.push({...route[i]});}
  result.push(routePoint(route,to));return result;
}
module.exports = { Geometry, intersects, distance, routePoint, routeSlice, lineIntersectsCircle };
