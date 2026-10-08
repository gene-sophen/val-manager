const rules = require('./content/rules.json');
const packs = require('./content/packs.json');
const rosters = require('./content/rosters/2026-production-v1.json');
const maps = require('./content/maps.json');
const coaches = require('./content/coaches.json');
const manifest = require('./content/content-manifest.json');
const catalog = require('./catalog');
const { initialMastery } = require('./team-base');

const SCHEMA_VERSION = 2;
function createState() {
  return {
    schemaVersion: SCHEMA_VERSION, revision: 0, processedCommandIds: [], ledger: {},
    career: { album: {}, honors: [], runHistory: [], coach: { ...coaches.default }, familiarity: {}, mapKnowledge: {} },
    activeRun: null, legacyArchives: []
  };
}

function assertState(state) {
  if (!state || state.schemaVersion !== SCHEMA_VERSION) throw new Error('不支持的存档版本');
  if (!Number.isInteger(state.revision) || state.revision < 0 || !Array.isArray(state.processedCommandIds)
    || !state.career || !state.career.album || !Array.isArray(state.career.honors)
    || !Array.isArray(state.career.runHistory) || !state.ledger || Array.isArray(state.ledger)
    || !Array.isArray(state.legacyArchives)) throw new Error('存档结构损坏，原始数据已保留');
}

function migrateState(input) {
  if (input?.schemaVersion === SCHEMA_VERSION) { assertState(input); return structuredClone(input); }
  if (input?.schemaVersion !== 1) throw new Error(`无法读取存档版本 ${input?.schemaVersion}`);
  if (!input.career?.album || !Array.isArray(input.career.honors) || !Array.isArray(input.career.runHistory)
    || !Number.isInteger(input.revision)) throw new Error('旧存档结构损坏，原始数据已保留');
  const next = createState();
  next.revision = input.revision + 1;
  next.career.album = structuredClone(input.career.album);
  next.career.honors = structuredClone(input.career.honors);
  next.career.runHistory = structuredClone(input.career.runHistory);
  next.legacyArchives.push({ schemaVersion: 1, reason: '旧测试赛段保留原始记录；新征战重新开局', snapshot: structuredClone(input) });
  return next;
}

function createRun({ id, seed, career = createState().career }) {
  if (typeof id !== 'string' || !id.trim() || id.length > 120 || !Number.isInteger(seed)
    || seed < 0 || seed > 0xffffffff) throw new Error('无效的征战身份或种子');
  return {
    id, seed, rulesVersion: rules.version, contentVersion: manifest.version,
    contentSnapshot: structuredClone({ manifest, rules, packs, rosters, maps, coaches, cards: catalog.cards }),
    phase: 'choose-home-team', homeTeamId: null, packIndex: 0,
    starterPacks: [], selectedPackId: null, ownedCards: [], registeredLineup: null,
    stageIndex: 0, stageId: 'kickoff', stageHistory: [], reinforcementStages: [], pendingReinforcement: null,
    rosterHistory: [], departures: [], participantSnapshots: [], results: [], match: null,
    team: { 羁绊: 20, 状态: 50, 熟练: initialMastery(career.coach) }, coach: structuredClone(career.coach),
    relationships: {}, progressionStatus: 'initial-and-replacement-values-only'
  };
}
module.exports = { SCHEMA_VERSION, createState, createRun, assertState, migrateState };
