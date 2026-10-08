const config = require('./content/growth.json');
const { stream } = require('./random');

const options = Object.freeze(config.options.map(option => Object.freeze({ ...option })));
const byId = new Map(options.map(option => [option.id, option]));
if (byId.size !== options.length) throw new Error('成长 ID 冲突');

function getGrowth(id) {
  const option = byId.get(id);
  if (!option) throw new Error(`未知成长: ${id}`);
  return option;
}

function offerGrowth(run, nodeId, kind = 'small') {
  const owned = new Set(run.growth.map(item => item.optionId));
  const effects = new Set(run.growth.flatMap(item => {
    const option = byId.get(item.optionId);
    return option?.effects || [item.optionId];
  }));
  const eligible = options.filter(option => !!option.stageOnly === (kind === 'stage')
    && !owned.has(option.id)
    && (!option.effects || option.effects.some(effect => !effects.has(effect))));
  if (!eligible.length) return { id: `${run.id}:${nodeId}:growth`, nodeId, kind, options: [], fallback: '全部成长已获得' };
  const rng = stream(run.seed, 'growth', run.growthIndex);
  const pool = eligible.slice();
  const picks = [];
  while (pool.length && picks.length < 3) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return { id: `${run.id}:${nodeId}:growth`, nodeId, kind, options: picks, fallback: null };
}

function activeEffectIds(run) {
  return [...new Set(run.growth.flatMap(item => getGrowth(item.optionId).effects || [item.optionId]))];
}

module.exports = { options, getGrowth, offerGrowth, activeEffectIds };
