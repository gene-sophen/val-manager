const config = require('./content/preparation.json');
const { stream } = require('./random');
const { fixtureAt } = require('./match-service');

function offerPreparation(run) {
  const fixture = fixtureAt(run.fixtureIndex);
  const rng = stream(run.seed, 'fixture', run.fixtureIndex);
  const event = config.events[Math.floor(rng() * config.events.length)];
  return { nodeId: fixture.id, event, actions: config.actions };
}

function choosePreparation(run, actionId) {
  if (run.preparation) throw new Error('本场备战机会已使用');
  const offer = offerPreparation(run);
  const action = offer.actions.find(item => item.id === actionId);
  if (!action) throw new Error('无效的备战选择');
  const opponent = fixtureAt(run.fixtureIndex).opponent;
  const tendency = actionId === 'scout'
    ? Object.fromEntries(['atk', 'def'].map(side => {
        const entries = Object.entries(opponent.tactics[side]);
        entries.sort((a, b) => b[1] - a[1]);
        return [side, { family: entries[0][0], share: entries[0][1], source: '固定队伍公开倾向' }];
      }))
    : null;
  return { nodeId: offer.nodeId, eventId: offer.event.id, actionId, effectId: action.effectId, tendency };
}

module.exports = { offerPreparation, choosePreparation };
