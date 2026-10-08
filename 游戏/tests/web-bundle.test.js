const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { build, bundle } = require('../build_web');
const { createState } = require('../state');
const { applyCommand } = require('../commands');
const { allAgents } = require('../../引擎/agents');

test('shared web bundle produces the same saved three-pack opening as direct modules', () => {
  const { dispatch } = require('./helpers/season');
  let state = dispatch(createState(), 'begin_run', { runId:'r', seed:31 });
  state = dispatch(state,'select_home_team',{teamId:'EDG'});
  const cmd={id:'open',expectedRevision:state.revision,type:'open_initial_packs'};
  const direct=applyCommand(state,cmd);
  const modules=new Function(`${bundle()}\nreturn { applyCommand: __require('', '游戏/commands.js').applyCommand };`)();
  const bundled=modules.applyCommand(state,cmd);
  assert.equal(JSON.stringify(bundled),JSON.stringify(direct));
  assert.equal(bundled.activeRun.starterPacks.length,3);
});

test('generated standalone page has a parseable script', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-manager-web-'));
  const file = build(path.join(dir, 'playable.html'));
  const html = fs.readFileSync(file, 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  new vm.Script(script);
  assert.ok(html.includes('VALORANT MANAGER'));
});
