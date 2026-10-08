// 玩家可将固定战术槽位交给指定选手；只重排职责，不生成技能或额外属性。
function swapRole(intent, a, b) {
  if (a === b) return;
  [intent.roles[a], intent.roles[b]] = [intent.roles[b], intent.roles[a]];
  [intent.homes[a], intent.homes[b]] = [intent.homes[b], intent.homes[a]];
  if (intent.carrier === a) intent.carrier = b;
  else if (intent.carrier === b) intent.carrier = a;
}

function applyRolePreferences(intent, preferences) {
  if (!preferences) return intent;
  if (intent.side === 'atk') {
    if (intent.family === 'lurk' && Number.isInteger(preferences.lurker)) swapRole(intent, 4, preferences.lurker);
    if (intent.family === 'fake' && Number.isInteger(preferences.decoy)) swapRole(intent, 0, preferences.decoy);
    if (Number.isInteger(preferences.carrier)) intent.carrier = preferences.carrier;
  } else if (intent.family === 'stack' && Number.isInteger(preferences.anchor)) {
    swapRole(intent, 4, preferences.anchor);
  }
  return intent;
}

module.exports = { applyRolePreferences };
