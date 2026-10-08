// 战术意图：战术族 -> 意图先验（取代 playbooks.js 的指令链；个体如何执行由 brain.js 决定）
// 输出：{ family, side, siteWeights, pace, utilPosture, regions, fakeout,
//         carrier, roles[5], homes[5], routes: { role -> [节点链] } }
// routes 表达各族习惯的走位路线（第一阶段集合点 -> 包点），brain 沿链推进，
// pace.commitTick 前只许推进到路线入口（limitIdx），之后放开全程。
const cfg = require('./config');
const T = cfg.tactics;
const F = cfg.fake;

const OFFENSE = ['rush', 'mid', 'lurk', 'fake']; // 爆弹冲点 / 中路接触 / 边线渗透 / 假打转点
const DEFENSE = ['push', 'hold', 'stack']; // 防守前压 / 默认架点 / 赌点防守
const CAMPAIGN_OFFENSE = ['rush', 'mid', 'fake', 'lurk', 'contact'];
const CAMPAIGN_DEFENSE = ['push', 'hold', 'trap', 'flank', 'retake'];

function pickSite(rng, avoid) {
  const s = rng() < 0.5 ? 'A' : 'B';
  return s === avoid ? (s === 'A' ? 'B' : 'A') : s;
}

// 节点名助手：按目标点取对应侧节点
function sideNodes(site) {
  return site === 'A'
    ? { main: 'a_main', lobby: 'a_lobby', short: 'a_short' }
    : { main: 'b_main', lobby: 'b_lobby', short: 'market' };
}

function buildOffense(map, family, rng) {
  const site = pickSite(rng);
  const other = site === 'A' ? 'B' : 'A';
  const S = map.siteNode(site);
  const oS = map.siteNode(other);
  const n = sideNodes(site);
  const o = sideNodes(other);
  const sw = site === 'A' ? { A: 1, B: 0 } : { A: 0, B: 1 };

  if (family === 'rush') {
    // 爆弹冲点：全员跑步直冲包点，无埋伏期
    return {
      family, side: 'atk', site, siteWeights: sw,
      pace: { contactTick: T.rush.contactTick, commitTick: T.rush.commitTick },
      utilPosture: T.rush.utilPosture, regions: [site], fakeout: null,
      carrier: 0,
      roles: ['hit', 'hit', 'hit', 'hit', 'hit'],
      homes: [n.main, n.main, n.main, n.main, n.main],
      routes: { hit: [n.main, n.lobby, S] },
      limitIdx: { hit: 0 } // commit 前最多到入口
    };
  }

  if (family === 'mid') {
    // 中路接触：三人慢摸控中，两人在匪口待命；contact 时 IGL 读取薄弱侧，commit 后展开
    const contact = T.mid.contactTick + Math.floor(rng() * T.mid.contactJit);
    return {
      family, side: 'atk', site, siteWeights: sw,
      pace: { contactTick: contact, commitTick: contact + T.mid.commitLag },
      utilPosture: T.mid.utilPosture, regions: ['mid', site], fakeout: null,
      carrier: 0,
      roles: ['mid', 'mid', 'mid', 'flank', 'flank'],
      homes: ['mid_top', 'mid_top', 'mid_top', 'mid_top', 'mid_top'],
      routes: {
        mid: ['mid_top', 'mid', n.short, S],       // 中控组从 A小/市场 进点
        flank: ['mid_top', n.main, n.lobby, S]     // 待命组绕主方向进点
      },
      limitIdx: { mid: 1, flank: 0 } // commit 前：中控组控到中路，待命组停在匪口
    };
  }

  if (family === 'lurk') {
    // 边线渗透：四人在入口外静音待命，执行后一波打进；单摸手绕另一侧断回防
    const contact = T.lurk.contactTick + Math.floor(rng() * T.lurk.contactJit);
    return {
      family, side: 'atk', site, siteWeights: sw,
      pace: { contactTick: contact, commitTick: contact + T.lurk.commitLag },
      utilPosture: T.lurk.utilPosture, regions: [site, other], fakeout: null,
      carrier: 0,
      roles: ['hit', 'hit', 'hit', 'hit', 'lurk'],
      homes: [n.main, n.main, n.main, n.main, o.main],
      routes: {
        hit: [n.main, n.lobby, S],
        lurk: [o.main, oS, 'ct_spawn', S] // 穿空点绕后，截回防后夹击主攻点
      },
      limitIdx: { hit: 0, lurk: 0 } // commit 前都停在入口外
    };
  }

  if (family === 'contact') {
    return { family, side: 'atk', site, siteWeights: sw,
      pace: { contactTick: 24, commitTick: 34 }, utilPosture: 0.4,
      regions: [site, 'mid'], fakeout: null, carrier: 0,
      roles: ['hit', 'hit', 'hit', 'flank', 'flank'],
      homes: [n.main, n.main, n.main, 'mid_top', 'mid_top'],
      routes: { hit: [n.main, n.lobby, S], flank: ['mid_top', 'mid', n.short, S] },
      limitIdx: { hit: 1, flank: 1 } };
  }

  // fake 假打转点：1 人在佯攻点交动静拉扯防守，4 人埋伏真点入口等窗口一波打进
  const fakeTick = F.fakeTick + Math.floor(rng() * 8) - 4;
  const hitTick = fakeTick + 9 + Math.floor(rng() * 4); // 真打必须跟上假象的窗口期
  return {
    family, side: 'atk', site: other, siteWeights: other === 'A' ? { A: 1, B: 0 } : { A: 0, B: 1 },
    pace: { contactTick: fakeTick, commitTick: hitTick },
    utilPosture: T.fake.utilPosture, regions: [other], 
    fakeout: { fakeRegion: site, realRegion: other, fakeTick, hitTick },
    carrier: 1, // 下包者在真打组
    roles: ['decoy', 'real', 'real', 'real', 'real'],
    homes: [n.main, o.main, o.main, o.main, o.main],
    routes: {
      decoy: [n.main, n.lobby],          // 佯攻组推进到佯攻点入口制造动静
      real: [o.main, o.lobby, oS]        // 真打组埋伏真点入口
    },
    limitIdx: { decoy: 1, real: 0 }
  };
}

function buildDefense(map, family, rng) {
  const sw = { A: 0.5, B: 0.5 };

  if (family === 'trap') {
    const site = pickSite(rng);
    return { family, side: 'def', site, siteWeights: sw,
      pace: { contactTick: 0, commitTick: 0 }, utilPosture: 0.85,
      regions: [site, 'mid'], fakeout: null, carrier: -1,
      roles: ['home', 'home', 'home', 'home', 'anchor'],
      homes: site === 'A' ? ['a_heaven', 'a_short', 'a_site', 'mid_bottom', 'b_site']
        : ['b_back', 'market', 'b_site', 'mid_bottom', 'a_site'], routes: {}, limitIdx: {} };
  }
  if (family === 'flank') {
    return { family, side: 'def', siteWeights: sw,
      pace: { contactTick: 0, commitTick: 24 }, utilPosture: 0.5,
      regions: ['A', 'B'], fakeout: null, carrier: -1,
      roles: ['roam', 'roam', 'home', 'home', 'home'],
      homes: ['a_lobby', 'b_lobby', 'a_heaven', 'mid_bottom', 'b_site'],
      routes: { roam: ['mid_bottom', 'market', 'b_lobby', 'b_main', 't_spawn'] }, limitIdx: { roam: 0 } };
  }
  if (family === 'retake') {
    return { family, side: 'def', siteWeights: sw,
      pace: { contactTick: 0, commitTick: 0 }, utilPosture: 0.3,
      regions: ['A', 'B'], fakeout: null, carrier: -1,
      roles: ['anchor', 'anchor', 'home', 'home', 'home'],
      homes: ['a_site', 'b_site', 'ct_a', 'ct_b', 'ct_spawn'], routes: {}, limitIdx: {} };
  }

  if (family === 'push') {
    // 防守前压：双人顶中路拦截慢摸，roamTick 后向匪家游猎绕后；其余三人收缩架点
    return {
      family, side: 'def', siteWeights: sw,
      pace: { contactTick: 0, commitTick: T.push.roamTick },
      utilPosture: T.push.utilPosture, regions: ['mid', 'A', 'B'], fakeout: null,
      carrier: -1,
      roles: ['roam', 'roam', 'home', 'home', 'home'],
      homes: ['mid', 'mid', 'a_heaven', 'a_site', 'b_site'],
      routes: { roam: ['mid_bottom', 'mid', 'mid_top', 't_spawn'] },
      limitIdx: { roam: 1 } // roamTick 前顶到中路，之后放开向匪家游猎
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
      family, side: 'def', siteWeights: site === 'A' ? { A: 0.8, B: 0.2 } : { A: 0.2, B: 0.8 },
      pace: { contactTick: 0, commitTick: 0 },
      utilPosture: T.stack.utilPosture, regions: [site], fakeout: null,
      carrier: -1, site,
      roles: ['home', 'home', 'home', 'home', 'anchor'],
      homes: [...strong, anchor],
      routes: {},
      limitIdx: {}
    };
  }

  // hold 默认架点：2A 1中 2B 标准站位
  return {
    family, side: 'def', siteWeights: sw,
    pace: { contactTick: 0, commitTick: 0 },
    utilPosture: T.hold.utilPosture, regions: ['A', 'mid', 'B'], fakeout: null,
    carrier: -1,
    roles: ['home', 'home', 'home', 'home', 'home'],
    homes: ['a_heaven', 'a_site', 'mid_bottom', 'b_site', 'market'],
    routes: {},
    limitIdx: {}
  };
}

function buildIntent(map, side, family, rng) {
  const valid = side === 'atk' ? CAMPAIGN_OFFENSE : [...CAMPAIGN_DEFENSE, 'stack'];
  if (!valid.includes(family)) throw new Error('未知战术族: ' + family);
  if(map.data.spatialVersion===6)return require('./map-tactics').build(map,side,family,rng);
  return side === 'atk'
    ? buildOffense(map, family, rng)
    : buildDefense(map, family, rng);
}

// 临场改换主攻方向：重建点位倾向与角色路线（mid 族读取薄弱侧后调用）
function aimAt(intent, map, site) {
  if(map.data.spatialVersion===6)return require('./map-tactics').aimAt(intent,map,site);
  const S = map.siteNode(site);
  const n = sideNodes(site);
  intent.site = site;
  intent.siteWeights = site === 'A' ? { A: 1, B: 0 } : { A: 0, B: 1 };
  if (intent.family === 'mid') {
    intent.routes.mid = ['mid_top', 'mid', n.short, S];
    intent.routes.flank = ['mid_top', n.main, n.lobby, S];
  } else if (intent.family === 'rush' || intent.family === 'lurk') {
    intent.routes.hit = [n.main, n.lobby, S];
  }
}

module.exports = { OFFENSE, DEFENSE, CAMPAIGN_OFFENSE, CAMPAIGN_DEFENSE, buildIntent, aimAt };
