// Browser-only IndexedDB integration checks. Uses a fresh, isolated database per run.
const fs = require('node:fs');
const path = require('node:path');
const { bundle } = require('../../build_web');
const output = path.join(__dirname, '../../out/storage-check.html');
const script = `
const { indexedDBStore } = __require('', '游戏/storage.js');
const result=document.getElementById('result'),button=document.getElementById('run');
function check(ok,message){if(!ok)throw new Error(message);checks.push(message);}
let checks=[];
function seedDatabase(name,value){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(name,1);
 req.onupgradeneeded=()=>req.result.createObjectStore('save');
 req.onerror=()=>reject(req.error);
 req.onsuccess=()=>{const db=req.result,tx=db.transaction('save','readwrite');tx.objectStore('save').put(value,'career');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};
});}
button.onclick=async()=>{button.disabled=true;checks=[];try{
 const name='val-manager-disposable-check-'+crypto.randomUUID();
 const old={schemaVersion:1,revision:7,processedCommandIds:[],career:{album:{'normal:chichoo':2},honors:[{title:'旧测试荣誉'}],runHistory:[]},activeRun:{id:'old-run',phase:'ready',ownedCards:[{instanceId:'old-card'}]}};
 await seedDatabase(name,old);
 const store=indexedDBStore(indexedDB,name);
 let state=await store.load();
 check(state.schemaVersion===2&&state.revision===8,'v1 数据库真实升级到 v2');
 check(JSON.stringify(state.legacyArchives[0].snapshot)===JSON.stringify(old),'旧征程完整归档');
 check(state.activeRun===null&&state.career.album['normal:chichoo']===2&&state.career.honors.length===1,'图鉴荣誉保留，旧赛事不伪装成新版');
 check(JSON.stringify(JSON.parse(await store.exportLegacyRaw())[0])===JSON.stringify(old),'原始 v1 可导出');
 state=await indexedDBStore(indexedDB,name).load();
 check(state.revision===8&&state.legacyArchives.length===1&&JSON.parse(await store.exportLegacyRaw()).length===1,'重新打开不会重复迁移或重复备份');
 const begin={id:'begin',expectedRevision:8,type:'begin_run',payload:{seed:42,runId:'browser-check-run'}};
 state=await store.dispatch(begin);
 const races=await Promise.allSettled([
  store.dispatch({id:'choose-a',expectedRevision:9,type:'select_home_team',payload:{teamId:'EDG'}}),
  store.dispatch({id:'choose-b',expectedRevision:9,type:'select_home_team',payload:{teamId:'NOVA'}})
 ]);
 check(races.filter(r=>r.status==='fulfilled').length===1&&races.filter(r=>r.status==='rejected').length===1,'并发不同命令只有一份成功，不覆盖新版本');
 state=await store.load();
 const open={id:'open',expectedRevision:state.revision,type:'open_initial_packs'};
 await Promise.all([store.dispatch(open),store.dispatch(open)]);
 state=await store.load();
 check(state.activeRun.starterPacks.length===3&&state.activeRun.packIndex===3&&Object.keys(state.ledger).length===1,'重复提交仅生成三个包和一次结算');
 const before=await store.exportRaw();
 try{await store.dispatch({id:'invalid',expectedRevision:state.revision,type:'confirm_lineup',payload:{instanceIds:[]}});}catch(error){}
 check(await store.exportRaw()===before,'失败事务不留下半份阵容');
 const damaged={schemaVersion:99,revision:123,valuable:'KEEP ORIGINAL'};
 const badName=name+'-unknown';await seedDatabase(badName,damaged);
 const badStore=indexedDBStore(indexedDB,badName);
 let rejected=false;try{await badStore.load();}catch(error){rejected=true;}
 check(rejected&&JSON.stringify(JSON.parse(await badStore.exportRaw()))===JSON.stringify(damaged),'未知存档拒绝读取并保留原始数据');
 result.textContent=JSON.stringify({passed:true,checks},null,2);result.dataset.status='passed';
}catch(error){result.textContent=JSON.stringify({passed:false,checks,error:String(error)},null,2);result.dataset.status='failed';}finally{button.disabled=false;}};
`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>浏览器存档验证</title><h1>真实 IndexedDB 验证</h1><p>每次创建独立测试数据库，不读写游戏正式存档。</p><button id="run">运行存档验证</button><pre id="result" data-status="pending">未运行</pre><script>${bundle()}\n${script}</script></html>`, 'utf8');
console.log(output);
