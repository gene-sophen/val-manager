const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

test('standalone spectator includes rule dependencies, matches Node results and parses after window UI changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'val-manager-spectator-'));
  const output = path.join(dir, 'spectator.html');
  const stdout = execFileSync(process.execPath, [path.join(__dirname, '../build_spectator.js'),
    '--a','tiers:GGSSB','--b','tiers:GGSSB','--seed','42','--selftest','-o',output], { encoding: 'utf8' });
  assert.match(stdout, /一致 ✓/);
  const html = fs.readFileSync(output, 'utf8');
  new vm.Script(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')));
});
