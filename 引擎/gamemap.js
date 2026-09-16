// 地图节点图：加载、邻接表、BFS 寻路
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
}

function loadMap(path) {
  const data = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  return new GameMap(data);
}

module.exports = { GameMap, loadMap };
