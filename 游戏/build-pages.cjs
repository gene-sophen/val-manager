// A static release tree keeps the source-relative URLs intact under /val-manager/.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app='设计文档/UI原型/complete-prototype-01';
function build(output=path.join(root,'_site')){
 output=path.resolve(output);if(output===root||!output.startsWith(root+path.sep))throw Error('发布输出必须位于独立工作区子目录');
 // Never clear a directory implicitly: a fresh output guarantees no stray reports or saves.
 if(fs.existsSync(output))throw Error('请使用新的空发布目录，原目录不会被删除');
 fs.mkdirSync(output,{recursive:true});const files=[];
 function copy(relative){const source=path.join(root,relative),target=path.join(output,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);files.push(relative.replaceAll('\\','/'));}
 function tree(relative,html=true){for(const e of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const child=path.join(relative,e.name);if(e.isDirectory()){if(e.name!=='preview')tree(child,html);}else if(/\.(?:html|css|js|json|webmanifest|svg|png|webp|jpe?g|gif|woff2?|ttf)$/i.test(e.name)&&!e.name.includes('.test.')&&!e.name.endsWith('.template.html')&&(html||!e.name.endsWith('.html')))copy(child);}}
 for(const dir of ['complete-prototype-01','art-direction-01','art-direction-03','layout-rebuild-01','navigation-rebuild-01'])tree('设计文档/UI原型/'+dir,dir==='complete-prototype-01');
 for(const file of fs.readdirSync(path.join(root,'游戏')))if(file.endsWith('.js'))copy('游戏/'+file);
 tree('引擎/maps');
 for(const dir of ['选手半身像','英雄头像','队伍logo','切面海报','地图官方','地图参考','地图风格','底纹','赛区图标','字体'])tree('素材库/'+dir);
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+app+'/index.html"><title>VAL MANAGER</title></head><body><a href="'+app+'/index.html">进入 VAL MANAGER</a></body></html>';
 fs.writeFileSync(path.join(output,'index.html'),html);fs.writeFileSync(path.join(output,'.nojekyll'),'');
 const included=new Set(files),context={self:{addEventListener(){}},URL};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,app,'sw.js'),'utf8')+'\nthis.shell=SHELL;',context);
 const requireURL=(url,base)=>{if(/^(?:data:|https?:|#)/.test(url))return;const p=path.relative(root,path.resolve(root,base,decodeURI(url.split(/[?#]/)[0]))).replaceAll('\\','/');const target=p.endsWith('/')?p+'index.html':p;if(!included.has(target)&&!included.has(target+'/index.html'))throw Error('发布缺失资源或大小写不匹配：'+p);};
 for(const url of context.shell)requireURL(url,app);
 for(const file of files){if(file.endsWith('.html'))for(const m of fs.readFileSync(path.join(root,file),'utf8').matchAll(/(?:src|href)="([^"]+)"/g))if(!m[1].endsWith('.md'))requireURL(m[1],path.dirname(file));if(file.endsWith('.css'))for(const m of fs.readFileSync(path.join(root,file),'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g))requireURL(m[1],path.dirname(file));}
 const x=require('./tests/helpers/live-ui.cjs').load('pages-assets');
 for(const card of x.DEMO.cards){for(const asset of [card.photo,'队伍logo/'+card.team+'.png',...(card.agents||[]).map(a=>card.agentAssets?.[a]||'英雄头像/'+a+'.png')].filter(Boolean))requireURL(asset,'素材库');}
 for(const m of x.PROTOTYPE_RULES.mapCatalog)for(const suffix of ['.webp','-poster.webp','-plan.webp'])requireURL('地图官方/'+m.id+suffix,'素材库');
 const bytes=files.reduce((n,file)=>n+fs.statSync(path.join(output,file)).size,0);return {output,files:files.length,bytes,entry:app+'/index.html'};
}
if(require.main===module)console.log(JSON.stringify(build(process.argv[2])));
module.exports={build};
