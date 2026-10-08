const { RoundSim } = require('../../round');
const { mulberry32 } = require('../../rng');
const cfg = require('../../config');

// A real RoundSim.run / updatePlantDefuse with a deliberately scripted path and
// decisions. It isolates timer, travel and defuse rules from the current AI.
function makePlantedRound({ spikeLeft, travelTicks = 0, defenders = 1, attackerAlive = false, interruptAt = null, seed = 42 }) {
  const events = [];
  const site = 'a_site';
  const outside = 'a_main';
  const atk = [{ name: 'attacker', side: 'atk', alive: attackerAlive, node: attackerAlive ? outside : site, planting: 0, defusing: 0 }];
  const def = Array.from({ length: defenders }, (_, index) => ({
    name: `defender-${index}`, side: 'def', alive: true,
    node: travelTicks > 0 ? outside : site, planting: 0, defusing: 0,
    saved: false, moving: null
  }));
  const round = Object.create(RoundSim.prototype);
  Object.assign(round, {
    t: 0, result: null, planted: true, spikeLeft, plantSite: 'A',
    planter: atk[0], defuser: null, atk, def, units: [...atk, ...def],
    atkFamily: 'rush', defFamily: 'hold', rng: mulberry32(seed),
    hooks: { onRoundStart: [] }, stats: {},
    map: { siteNode: () => site, region: (node) => node === site ? 'A' : 'mid',
      nodes: { [site]: { x: 155, y: 285 }, [outside]: { x: 115, y: 450 } } },
    occ: { [site]: new Set(def.filter(u => u.node === site)),
      [outside]: new Set([...atk.filter(u => u.alive), ...def.filter(u => u.node === outside)]) },
    reviveQueue: [], turrets: [],
    _roundEvents: events, log: (event) => events.push(event), onRoundEnd: null
  });
  round.updateMovement = function () {
    for (const unit of def) {
      if (unit.node === site || unit.saved) continue;
      if (this.t + 1 < travelTicks) continue;
      this.occ[outside].delete(unit);
      unit.node = site;
      this.occ[site].add(unit);
      this.emit('arrive', { unit: unit.name, node: site });
    }
  };
  round.resolveCombat = function () {
    if (interruptAt === this.t && atk[0].alive) {
      for (const unit of def) {
        if (unit.defusing) {
          unit.defusing = 0;
          this.emit('defuse_abort', { node: site, unit: unit.name });
        }
      }
    }
  };
  round.updateTeamState = () => {};
  round.updateBrains = function () {
    for (const unit of def) {
      if (!unit.alive || unit.node !== site || unit.defusing || this.result) continue;
      unit.defusing = cfg.round.defuseTicks;
      this.emit('defuse_start', { node: site, unit: unit.name });
      break;
    }
  };
  return { round, events, atk, def };
}

module.exports = { makePlantedRound };
