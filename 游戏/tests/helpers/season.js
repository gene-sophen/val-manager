const { createState } = require('../../state');
const { applyCommand } = require('../../commands');
const catalog = require('../../catalog');

function dispatch(state, type, payload = {}, id = `${type}:${state.revision}`) {
  return applyCommand(state, { id, type, payload, expectedRevision: state.revision });
}
function opened(seed = 42) {
  let state = dispatch(createState(), 'begin_run', { runId: `season-${seed}`, seed });
  state = dispatch(state, 'select_home_team', { teamId: 'EDG' });
  return dispatch(state, 'open_initial_packs');
}
function ready(seed = 42) {
  let state = dispatch(opened(seed), 'select_initial_pack', { packId: `season-${seed}:starter:0` });
  const picks = state.activeRun.ownedCards.filter(i => catalog.getCard(i.cardId).tier !== '钻').slice(0, 5);
  return dispatch(state, 'confirm_lineup', { instanceIds: picks.map(i => i.instanceId), name: '我的队伍' });
}
module.exports = { dispatch, opened, ready };
