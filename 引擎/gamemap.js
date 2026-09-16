// 地图节点图：加载、邻接表、BFS 寻路、对枪点与枪线
class GameMap {
  constructor(data) {
    this.data = data;
    this.nodes = data.nodes;
    this.adj = {};   // node -> [{to, ticks, exposure}]
    for (const id of Object.keys(data.nodes)) this.adj[id] = [];
    for (const e of data.edges) {
      this.adj[e.a].push({ to: e.b, ticks: e.ticks, exposure: e.exposure });
      this.adj[e.b].push({ to: e.a, ticks: e.ticks, exposure: e.exposure });
    }
    // 全源 BFS 下一跳表（图小，直接全量预计算）
    this.nextHop = {};
    for (const from of Object.keys(this.nodes)) {
      this.nextHop[from] = this.bfs(from);
    }
    // 对枪点（站位槽）与枪线可见性矩阵
    this.posts = data.posts || {};
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

  region(node) { return this.nodes[node].region; }
  siteNode(letter) { return this.data.sites[letter]; }

  postKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  // 节点内的对枪点 id 列表
  postsAt(node) { return this.postsByNode[node] || []; }

  // 同节点内任意两个对枪点互相可见；跨节点需显式标注 sightline
  canSee(postA, postB) {
    if (postA === postB) return true;
    const a = this.posts[postA], b = this.posts[postB];
    if (!a || !b) return false;
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

function loadMap(path) {
  const data = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  return new GameMap(data);
}

module.exports = { GameMap, loadMap };
