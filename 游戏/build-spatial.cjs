// Bundle exactly the same CommonJS source used by Node tests; no hand-maintained copy.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),modules=new Map();
function visit(file){const id=path.relative(root,file).replaceAll('\\','/');if(modules.has(id))return id;const source=fs.readFileSync(file,'utf8');modules.set(id,source);if(!file.endsWith('.json'))for(const m of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){if(!m[1].startsWith('.'))continue;let next=path.resolve(path.dirname(file),m[1]);if(!path.extname(next))next+='.js';visit(next);}return id;}
const entry=visit(path.join(__dirname,'spatial-match.js'));
let code='/* GENERATED: node 游戏/build-spatial.cjs */\n(function(root){const modules={},cache={};\n';
for(const [id,source]of modules)code+='modules['+JSON.stringify(id)+']=function(require,module,exports){\n'+(id.endsWith('.json')?'module.exports='+source.trim()+';':source)+'\n};\n';
code+=`function load(id){if(id==='path')return {};if(id==='fs')throw Error('浏览器不读取文件');if(cache[id])return cache[id].exports;if(!modules[id])throw Error('模块缺失: '+id);const m={exports:{}};cache[id]=m;modules[id](request=>{if(!request.startsWith('.'))return load(request);const parts=id.split('/');parts.pop();for(const p of request.split('/'))if(p==='..')parts.pop();else if(p!=='.')parts.push(p);let target=parts.join('/');if(!/\\.(js|json)$/.test(target))target+='.js';return load(target);},m,m.exports);return m.exports;}root.SPATIAL_MATCH=load(${JSON.stringify(entry)});})(typeof window==='object'?window:globalThis);\n`;
fs.writeFileSync(path.join(root,'设计文档/UI原型/complete-prototype-01/spatial-engine.js'),code);
console.log('Spatial bundle:',modules.size,'modules,',Buffer.byteLength(code),'bytes');
