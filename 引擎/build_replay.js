// 自包含回放页生成器：把 JSONL 日志 + 最新地图嵌入 replay.html 模板
// 用法:
//   node 引擎/build_replay.js <日志.jsonl> [输出.html]   生成自包含回放（双击即看）
//   node 引擎/build_replay.js --self                      只刷新 replay.html 内嵌地图
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'replay.html');
const MAP = path.join(ROOT, 'maps', 'ascent.json');

function bakeMap(html) {
  const mapJson = fs.readFileSync(MAP, 'utf8').trim();
  // 优先替换带标记的占位；模板已烘焙过则整体替换现有赋值
  const withMarker = /window\.MAP_DATA = \/\*__MAP_DATA__\*\/[\s\S]*?;/;
  const baked = /window\.MAP_DATA = \{[\s\S]*?\n\};/;
  if (withMarker.test(html)) return html.replace(withMarker, `window.MAP_DATA = ${mapJson};`);
  return html.replace(baked, `window.MAP_DATA = ${mapJson};`);
}

function bakeLog(html, logPath) {
  const events = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  const arr = '[' + events.join(',\n') + ']';
  return html.replace(/window\.EMBEDDED_EVENTS = \/\*__EMBEDDED_EVENTS__\*\/[\s\S]*?;/, `window.EMBEDDED_EVENTS = ${arr};`);
}

function main() {
  const args = process.argv.slice(2);
  let html = fs.readFileSync(TEMPLATE, 'utf8');
  if (args[0] === '--self') {
    fs.writeFileSync(TEMPLATE, bakeMap(html));
    console.log('已刷新 replay.html 内嵌地图');
    return;
  }
  let logPath = args[0];
  if (!logPath) {
    // 默认取 out/ 里最新的 jsonl
    const outDir = path.join(ROOT, 'out');
    const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(outDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!files.length) { console.error('out/ 下没有日志文件，请先 --log 生成'); process.exit(1); }
    logPath = files[0];
  }
  html = bakeLog(bakeMap(html), logPath);
  const base = path.basename(logPath).replace(/\.jsonl$/, '');
  const outPath = args[1] || path.join(ROOT, 'out', `replay_${base}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`已生成自包含回放: ${outPath}（日志: ${logPath}）`);
}

main();
