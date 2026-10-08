// 地图节点图：加载、邻接表、BFS 寻路、对枪点与枪线
class GameMap {
  constructor(data, geometryData = null) {
    this.data = data;
    this.geometry = geometryData ? geometryData.schemaVersion===2
      ? new (require('./geometry-v2').GeometryV2)(geometryData)
      : new (require('./geometry').Geometry)(geometryData) : null;
    this.nodes = data.nodes;
    this.adj = {};   // node -> [{to, ticks, exposure}]
    for (const id of Object.keys(data.nodes)) this.adj[id] = [];
    for (const e of data.edges) {
      this.adj[e.a].push({ to: e.b, ticks: e.ticks, exposure: e.exposure, route: e.route, traverseSeconds:e.traverseSeconds, traversal:e.traversal });
      this.adj[e.b].push({ to: e.a, ticks: e.ticks, exposure: e.exposure, route: e.route?.slice().reverse(), traverseSeconds:e.traverseSeconds, traversal:e.traversal });
    }
    // 全源 BFS 下一跳表（图小，直接全量预计算）
    this.nextHop = {};
    this.travelTimes = {};
    for (const from of Object.keys(this.nodes)) {
      this.nextHop[from] = data.strictSpatial ? this.fastestRoutes(from) : this.bfs(from);
    }
    // 对枪点（站位槽）与枪线可见性矩阵
    this.posts = data.posts || {};
    this.engagements = ['layered-v4','layered-v5','layered-v6'].includes(data.engagementModel) ? new (require('./engagements').Engagements)(data,this.geometry) : null;
    this.postsByNode = {};
    for (const [pid, p] of Object.entries(this.posts)) {
      (this.postsByNode[p.node] = this.postsByNode[p.node] || []).push(pid);
    }
    this.sight = {}; // postKey(a,b) -> exposure（对称）
    for (const [a, b, exposure] of data.sightlines || []) {
      this.sight[this.postKey(a, b)] = exposure;
    }
  }

  bfs(from) {
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const { to } of this.adj[cur]) {
        if (!(to in prev)) { prev[to] = cur; queue.push(to); }
      }
    }
    // hop[to] = 从 from 到 to 的第一步
    const hop = {};
    for (const to of Object.keys(prev)) {
      if (to === from) { hop[to] = null; continue; }
      let cur = to;
      while (prev[cur] !== from) cur = prev[cur];
      hop[to] = cur;
    }
    return hop;
  }

  edgeBetween(a, b) {
    return this.adj[a].find((x) => x.to === b) || null;
  }

  fastestRoutes(from) {
    const best={[from]:0},hop={[from]:null},done=new Set();
    while(true){let cur=null;for(const id of Object.keys(best))if(!done.has(id)&&(cur===null||best[id]<best[cur]))cur=id;if(cur===null)break;done.add(cur);
      for(const e of this.adj[cur]){const cost=best[cur]+e.ticks;if(best[e.to]===undefined||cost<best[e.to]){best[e.to]=cost;hop[e.to]=cur===from?e.to:hop[cur];}}
    }
    this.travelTimes[from]=best;return hop;
  }

  travelTime(from,to) {
    if(this.travelTimes[from])return this.travelTimes[from][to]??Infinity;
    const best={[from]:0},done=new Set();while(true){let cur=null;for(const id of Object.keys(best))if(!done.has(id)&&(cur===null||best[id]<best[cur]))cur=id;if(cur===null)return Infinity;if(cur===to)return best[cur];done.add(cur);for(const e of this.adj[cur])if(best[e.to]===undefined||best[e.to]>best[cur]+e.ticks)best[e.to]=best[cur]+e.ticks;}
  }

  region(node) { return this.nodes[node].region; }
  siteNode(letter) { return this.data.sites[letter]; }

  postKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  // 节点内的对枪点 id 列表
  postsAt(node) { return this.postsByNode[node] || []; }

  // 同节点内任意两个对枪点互相可见；跨节点需显式标注 sightline
  canSee(postA, postB) {
    if(this.engagements)return !!(this.posts[postA]&&this.posts[postB]&&(this.data.staticVisibility[postA]?.[postB]??0)>0);
    if (postA === postB) return true;
    const a = this.posts[postA], b = this.posts[postB];
    if (!a || !b) return false;
    if (this.data.strictSpatial) return this.geometry?.canObserve(a,b) || false;
    if (this.geometry && this.geometry.contains(a) && this.geometry.contains(b)) {
      return this.geometry.lineOfSight(a, b);
    }
    if (a.node === b.node) return true;
    return this.postKey(postA, postB) in this.sight;
  }

  // 目标在对枪点暴露度：同节点取目标 cover 的补数基准 0.3，跨节点取标注值
  exposureBetween(postA, postB) {
    if (postA === postB) return 0.2;
    const a = this.posts[postA], b = this.posts[postB];
    if (!a || !b) return 1;
    if (a.node === b.node) return 0.3;
    const v = this.sight[this.postKey(postA, postB)];
    return v === undefined ? 1 : v;
  }
}

function loadMap(path, geometryPath = null) {
  const data = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  const geometry = geometryPath ? JSON.parse(require('fs').readFileSync(geometryPath, 'utf8')) : null;
  return new GameMap(data, geometry);
}

module.exports = { GameMap, loadMap };
