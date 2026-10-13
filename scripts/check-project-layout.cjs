// Read-only repository check. Does not create or open any application database.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app=path.join(root,'设计文档/UI原型/complete-prototype-01');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='out'?[]:files(path.join(dir,e.name))):[path.join(dir,e.name)]);}
function check(){
 const errors=[],modules=files(path.join(root,'游戏')).concat(files(path.join(root,'引擎'))).filter(p=>/\.(?:js|cjs)$/.test(p));
 for(const file of modules){const text=fs.readFileSync(file,'utf8');try{new vm.Script(text,{filename:file});}catch(e){errors.push(e.message);}for(const m of text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){const target=path.resolve(path.dirname(file),m[1]);if(![target,target+'.js',target+'.cjs',target+'.json',path.join(target,'index.js')].some(p=>fs.existsSync(p)&&fs.statSync(p).isFile()))errors.push('模块不存在：'+path.relative(root,file)+' → '+m[1]);}}
 const html=fs.readFileSync(path.join(app,'index.html'),'utf8');let boot=0;for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(/^(?:https?:|#)/.test(m[1]))continue;const target=path.resolve(app,decodeURI(m[1].split('?')[0]));if(!fs.existsSync(target))errors.push('启动资源不存在：'+m[1]);boot++;}
 const context={self:{addEventListener(){}},URL};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(app,'sw.js'),'utf8')+'\nthis.shell=SHELL;',context);for(const uri of context.shell)if(!fs.existsSync(path.resolve(app,uri)))errors.push('离线资源不存在：'+uri);
 const aliases=require('../设计文档/UI原型/共享资源/compatibility.json'),seen=new Set();for(const {source,alias}of aliases){if(!source.startsWith('设计文档/UI原型/共享资源/')||!alias.startsWith('设计文档/UI原型/')||alias.includes('..')||seen.has(alias)||!fs.existsSync(path.join(root,source)))errors.push('兼容映射无效：'+alias);seen.add(alias);}
 if(errors.length)throw Error(errors.join('\n'));return {modules:modules.length,bootResources:boot,offlineResources:context.shell.length,compatibilityAliases:aliases.length};
}
if(require.main===module)console.log(JSON.stringify(check()));module.exports={check};
