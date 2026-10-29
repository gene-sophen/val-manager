const test=require('node:test'),assert=require('node:assert/strict'),P=require('../pwa-update');
test('an update still installing is offered only after the waiting worker is ready',async()=>{let change,pending=false;const worker={state:'installing',addEventListener:(_,fn)=>change=fn,removeEventListener:()=>{}},reg={installing:worker,waiting:null,update:async()=>{}};const result=P.check(reg,()=>pending=true);await new Promise(resolve=>setImmediate(resolve));assert(pending);worker.state='installed';reg.waiting=worker;change();assert.equal(await result,'ready');});
test('activation never overtakes a durable save and a failed save cannot reload the career',async()=>{let resolve,activated=0;const reg={waiting:{postMessage:m=>{assert.equal(m.type,'ACTIVATE');activated++;}}},flush=new Promise(r=>resolve=r),result=P.activate(reg,()=>flush);await new Promise(r=>setImmediate(r));assert.equal(activated,0);resolve();assert(await result);assert.equal(activated,1);await assert.rejects(P.activate(reg,async()=>{throw Error('save failed');}),/save failed/);assert.equal(activated,1);});
test('failed installation preserves the current client instead of pretending that an update is ready',async()=>{let change;const worker={state:'installing',addEventListener:(_,fn)=>change=fn,removeEventListener:()=>{}},result=P.check({installing:worker,waiting:null,update:async()=>{}});await new Promise(r=>setImmediate(r));worker.state='redundant';change();await assert.rejects(result,/当前版本仍可使用/);});
// A healthy network must not partially replace an installed page and its scripts.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('installed navigation and mandatory scripts stay on one cached release until activation',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/sw.js'),'utf8'),listeners={},base='https://example.test/val-manager/设计文档/UI原型/complete-prototype-01/';let network=0,writes=0;
 const cached=new Map(),cache={match:async(request,options)=>{const u=new URL(request.url||request,base);if(options?.ignoreSearch)u.search='';return cached.get(u.href);},put:async()=>writes++};
 const self={location:{href:base+'sw.js',origin:'https://example.test'},addEventListener:(name,fn)=>listeners[name]=fn};const context={self,URL,Response,caches:{open:async()=>cache},fetch:async()=>{network++;return new Response('future-network-version');}};vm.createContext(context);vm.runInContext(source+'\nthis.version=VERSION;',context);
 cached.set(new URL('index.html',base).href,new Response('installed-page'));cached.set(new URL('app.js?v='+context.version,base).href,new Response('installed-script'));
 async function request(file,mode){let response;listeners.fetch({request:{method:'GET',url:new URL(file,base).href,mode},respondWith:value=>response=value});return (await response).text();}
 assert.equal(await request('index.html?scene=old','navigate'),'installed-page');assert.equal(await request('app.js?v='+context.version,'cors'),'installed-script');assert.equal(network,0);assert.equal(writes,0);
 assert.equal(await request('optional-image.webp','cors'),'future-network-version');assert.equal(network,1);
});
test('an old page can still load its own scripts while the new worker waits for reload',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/sw.js'),'utf8'),listeners={},base='https://example.test/val-manager/设计文档/UI原型/complete-prototype-01/';let network=0;
 const empty={match:async()=>null,put:async()=>{}},self={location:{href:base+'sw.js',origin:'https://example.test'},addEventListener:(name,fn)=>listeners[name]=fn};
 const context={self,URL,Response,caches:{open:async()=>empty,match:async request=>new URL(request.url||request,base).search.includes('old')?new Response('previous-release-script'):null},fetch:async()=>{network++;return new Response('mixed-network-version');}};vm.createContext(context);vm.runInContext(source,context);
 let response;listeners.fetch({request:{method:'GET',url:new URL('app.js?v=old',base).href,mode:'cors'},respondWith:value=>response=value});assert.equal(await(await response).text(),'previous-release-script');assert.equal(network,0);
});
test('activation retains one previous release and removes only older caches',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01/sw.js'),'utf8'),listeners={},removed=[];let activation;
 const self={location:{href:'https://example.test/sw.js',origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>listeners[name]=fn};const context={self,URL,Response,caches:{keys:async()=>['vm-ui-complete-v011','vm-ui-complete-v013','vm-ui-complete-v012'],delete:async key=>removed.push(key)},fetch:async()=>{throw Error('unused');}};vm.createContext(context);vm.runInContext(source,context);
 listeners.activate({waitUntil:value=>activation=value});await activation;assert.deepEqual(removed,['vm-ui-complete-v011','vm-ui-complete-v013']);
});
