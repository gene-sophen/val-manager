const rules = require('../content/prototype-rules.json');

function createState() {
  return {
    schemaVersion: 1,
    revision: 0,
    processedCommandIds: [],
    career: { album: {}, honors: [], runHistory: [] },
    activeRun: null
  };
}

function createRun({ id, seed }) {
  if (typeof id !== 'string' || !id || !Number.isInteger(seed)) throw new Error('无效的征程身份或种子');
  return {
    id, rulesVersion: rules.version, seed,
    packIndex: 0, growthIndex: 0, matchIndex: 0,
    unopenedPacks: Object.fromEntries(rules.run.startingPacks.map(pack => [pack.tier, pack.count])),
    emergencyGranted: false, emergencyPackPending: false,
    ownedCards: [], registeredLineup: null, growth: [],
    fixtureIndex: 0, claimedRewards: [], pendingPack: null, pendingOffer: null,
    match: null, results: [], stageSupplementUsed: false, preparation: null, league: null
  };
}

module.exports = { createState, createRun };
