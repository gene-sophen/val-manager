// 战术剧本：把 7 个战术族数据化为 5 名选手的指令序列
// 指令类型：go(向节点机动) / waitUntil(驻留到 tick) / waitEvent(等剧本执行信号)
//          plant(下包或掩护) / hold(驻守) / branch(临场展开) / fakeNoise(假打制造动静)
//          —— 回防/保枪由 AI 决策动态插入
const cfgFake = require('./config').fake;
const OFFENSE = ['rush', 'mid', 'lurk', 'fake']; // 爆弹冲点 / 中路接触 / 边线渗透 / 假打转点
const DEFENSE = ['push', 'hold', 'stack']; // 防守前压 / 默认架点 / 赌点防守

function pickSite(rng, avoid) {
  const s = rng() < 0.5 ? 'A' : 'B';
  return s === avoid ? (s === 'A' ? 'B' : 'A') : s;
}

// 返回 { directives: [5 条指令链], carrier: 下包者下标, executeTick }
function buildOffense(map, family, rng) {
  const site = pickSite(rng);
  const other = site === 'A' ? 'B' : 'A';
  const S = map.siteNode(site);
  const main = site === 'A' ? 'a_main' : 'b_main';
  const lobby = site === 'A' ? 'a_lobby' : 'b_lobby';
  const oMain = other === 'A' ? 'a_main' : 'b_main';

  if (family === 'rush') {
    // 爆弹冲点：全员跑步直冲包点
    const chain = [
      { type: 'go', node: main, mode: 'run' },
      { type: 'go', node: lobby, mode: 'run' },
      { type: 'go', node: S, mode: 'run' },
      { type: 'plant' },
      { type: 'hold' }
    ];
    return {
      family, site, carrier: 0, executeTick: 0,
      directives: [0, 1, 2, 3, 4].map(() => chain.map((d) => ({ ...d })))
    };
  }

  if (family === 'mid') {
    // 中路接触：三人慢摸控中，两人在匪口待命；执行时若中控在手，
    // IGL 按两点守军多寡选择薄弱一侧（可读穿赌点），branch 指令由引擎展开
    const executeTick = 14 + Math.floor(rng() * 5);
    const viaMid = [
      { type: 'go', node: 'mid_top', mode: 'walk' },
      { type: 'go', node: 'mid', mode: 'walk' },
      { type: 'waitEvent', event: 'execute' },
      { type: 'branch', role: 'midHit' }
    ];
    const flank = [
      { type: 'go', node: 'mid_top', mode: 'walk' },
      { type: 'waitEvent', event: 'execute' },
      { type: 'branch', role: 'mainHit' }
    ];
    return {
      family, site, carrier: 0, executeTick,
      directives: [
        viaMid.map((d) => ({ ...d })),   // 0 下包者走中路
        viaMid.map((d) => ({ ...d })),   // 1
        viaMid.map((d) => ({ ...d })),   // 2 第三人同走中路确保控制权
        flank.map((d) => ({ ...d })),    // 3
        flank.map((d) => ({ ...d }))     // 4
      ]
    };
  }

  // lurk 边线渗透：四人在入口外静音待命（避开入口警戒），执行后一波打进；
  // 单摸手绕另一侧断回防，下包后绕到包点后翼夹击回防
  if (family === 'lurk') {
    const executeTick = 33 + Math.floor(rng() * 8);
    const oSite = map.siteNode(other);
    const hitChain = [
      { type: 'go', node: main, mode: 'walk' },
      { type: 'waitEvent', event: 'execute' },
      { type: 'go', node: lobby, mode: 'run' },
      { type: 'go', node: S, mode: 'run' },
      { type: 'plant' },
      { type: 'hold' }
    ];
    const lurkChain = [
      { type: 'go', node: oMain, mode: 'walk' },
      { type: 'waitEvent', event: 'execute' },
      { type: 'go', node: oSite, mode: 'run' },   // 穿空点绕后
      { type: 'go', node: 'ct_spawn', mode: 'run' },
      { type: 'go', node: S, mode: 'run' },       // 绕到主攻点后翼
      { type: 'hold' }
    ];
    return {
      family, site, carrier: 0, executeTick,
      directives: [
        hitChain.map((d) => ({ ...d })),
        hitChain.map((d) => ({ ...d })),
        hitChain.map((d) => ({ ...d })),
        hitChain.map((d) => ({ ...d })),
        lurkChain.map((d) => ({ ...d }))
      ]
    };
  }

  // fake 假打转点：1 人在佯攻点交动静（跑动暴露+交道具），拉扯防守阵型；
  // 4 人真打组静音埋伏在真点入口，等拉扯窗口一波打进；佯攻者随后长途转点汇合
  const fakeTick = cfgFake.fakeTick + Math.floor(rng() * 8) - 4;
  const hitTick = fakeTick + 9 + Math.floor(rng() * 4); // 真打必须跟上假象的窗口期
  const decoyChain = [
    { type: 'go', node: main, mode: 'walk' },
    { type: 'waitUntil', tick: fakeTick },
    { type: 'go', node: lobby, mode: 'run' },   // 跑动露声响
    { type: 'fakeNoise' },                       // 制造假象（引擎处理信息/道具）
    { type: 'waitUntil', tick: hitTick + 8 },    // 佯攻组留守卖破绽，迟于真打汇合
    { type: 'branch', role: 'fakeHit' }          // 长途转点去真点
  ];
  const realChain = [
    { type: 'go', node: oMain, mode: 'walk' },  // 真点入口外静音埋伏
    { type: 'waitEvent', event: 'execute' },
    { type: 'go', node: other === 'A' ? 'a_lobby' : 'b_lobby', mode: 'run' },
    { type: 'go', node: map.siteNode(other), mode: 'run' },
    { type: 'plant' },
    { type: 'hold' }
  ];
  return {
    family, site: other, decoySite: site, carrier: 1, executeTick: hitTick,
    directives: [
      decoyChain.map((d) => ({ ...d })),  // 0 佯攻（单人）
      realChain.map((d) => ({ ...d })),   // 1 下包者在真打组
      realChain.map((d) => ({ ...d })),   // 2
      realChain.map((d) => ({ ...d })),   // 3
      realChain.map((d) => ({ ...d }))    // 4
    ]
  };
}

function buildDefense(map, family, rng) {
  const holdAt = (node) => [
    { type: 'go', node, mode: 'run' },
    { type: 'hold' }
  ];

  if (family === 'push') {
    // 防守前压：双人顶中路拦截慢摸/控制中路的战术，之后向匪家游猎绕后，其余三人收缩架点
    const pusher1 = [
      { type: 'go', node: 'mid_bottom', mode: 'run' },
      { type: 'go', node: 'mid', mode: 'run' },
      { type: 'waitUntil', tick: 45 },
      { type: 'go', node: 'mid_top', mode: 'run' },
      { type: 'go', node: 't_spawn', mode: 'run' },
      { type: 'hold' }
    ];
    const pusher2 = [
      { type: 'go', node: 'mid_bottom', mode: 'run' },
      { type: 'go', node: 'mid', mode: 'run' },
      { type: 'waitUntil', tick: 45 },
      { type: 'go', node: 'mid_top', mode: 'run' },
      { type: 'go', node: 't_spawn', mode: 'run' },
      { type: 'hold' }
    ];
    return {
      family, carrier: -1, executeTick: 0,
      directives: [
        pusher1, pusher2,
        holdAt('a_heaven'), holdAt('a_site'), holdAt('b_site')
      ]
    };
  }

  if (family === 'stack') {
    // 赌点防守：四人重防一点，单人锚点另一点（锚点只在下包后回防）
    const site = pickSite(rng);
    const strong = site === 'A'
      ? ['a_site', 'a_heaven', 'a_short', 'a_site']
      : ['b_site', 'b_back', 'market', 'b_site'];
    const anchor = site === 'A' ? 'b_site' : 'a_site';
    return {
      family, site, carrier: -1, executeTick: 0,
      directives: [
        ...strong.map((n) => holdAt(n)),
        [{ type: 'go', node: anchor, mode: 'run' }, { type: 'hold', anchor: true }]
      ]
    };
  }

  // hold 默认架点：2A 1中 2B 标准站位
  return {
    family, carrier: -1, executeTick: 0,
    directives: [
      holdAt('a_heaven'), holdAt('a_site'), holdAt('mid_bottom'),
      holdAt('b_site'), holdAt('market')
    ]
  };
}

function buildPlaybook(map, side, family, rng) {
  return side === 'atk'
    ? buildOffense(map, family, rng)
    : buildDefense(map, family, rng);
}

module.exports = { OFFENSE, DEFENSE, buildPlaybook };
