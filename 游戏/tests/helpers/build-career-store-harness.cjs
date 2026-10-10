const fs=require('node:fs'),path=require('node:path'),{load,begin}=require('./live-ui.cjs'),C=require('../../career-store');
const x=load('closure-storage'),bridge=C.contentBridge(x.DEMO,x.PROTOTYPE_RULES,x.CN_CONTENT),s=begin(x);bridge.freeze(s);
const fresh=x.DEMO.seed();bridge.freeze(fresh);
const output=path.resolve(__dirname,'../../out/career-storage-check.html');
const script=`
const fresh=${JSON.stringify(fresh)},initial=${JSON.stringify(s)},result=document.getElementById('result');
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};let checks=[];
const original=JSON.stringify(initial),legacy={getItem:()=>original};
function seedRaw(name,value){return new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put(value,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};q.onerror=()=>reject(q.error);});}
document.getElementById('run').onclick=async()=>{checks=[];try{
const name='val-manager-test-closure-'+crypto.randomUUID(),options={indexedDB,databaseName:name,test:true,legacyStorage:legacy,freeze:s=>s,initial:()=>structuredClone(initial)};
const a=CAREER_STORE.create(options),s=await a.load();check(await a.legacyRaw()===original,'旧档原文完整备份且源未改动');
const b=CAREER_STORE.create(options);await b.load();s.coachName='事务保存';await a.save(s);let conflict=false;try{await b.save({...s,coachName:'不能覆盖'});}catch(e){conflict=true;}check(conflict,'并发旧版本被拒绝');let recoveryConflict=false;try{await b.restore(await a.exportRaw(),{recover:true});}catch(e){recoveryConflict=true;}check(recoveryConflict,'恢复模式也不能绕过并发保护');check(JSON.parse(await a.exportRaw()).state.coachName==='事务保存','并发未覆盖有效存档');
await a.save({...s,coachName:'第二次保存'});const previous=await a.previous();check(previous.state.coachName==='事务保存','保留上一个完整有效存档');const backup=await a.exportRaw();check(CAREER_STORE.parse(backup).state.coachName==='第二次保存','导出可校验恢复');
const before=await a.exportRaw();let invalid=false;try{await a.restore('{broken');}catch(e){invalid=true;}check(invalid&&await a.exportRaw()===before,'损坏导入不覆盖当前数据');
await a.restore(JSON.stringify(previous));check(JSON.parse(await a.exportRaw()).state.coachName==='事务保存','显式恢复并保留被替换档');const restartStore=CAREER_STORE.create({...options,initial:()=>structuredClone(fresh)});await restartStore.load();const beforeRestart=await restartStore.exportRaw();const clean=await restartStore.restart();check(clean.run==='none'&&clean.roster.length===0&&clean.unlocked.length===0&&clean.seasons.length===0,'清空生涯并从空阵容、空图鉴开始');await restartStore.save({...clean,coachName:'重新开始之后'});check(JSON.stringify((await restartStore.clearedBackup()).state)===JSON.stringify(CAREER_STORE.parse(beforeRestart).state),'清空前原档保留，可恢复');await restartStore.close();await a.close();await b.close();
const damaged=JSON.parse(before);damaged.state.coachName='损坏';await seedRaw(name,damaged);const c=CAREER_STORE.create(options);let corrupt=false;try{await c.load();}catch(e){corrupt=true;}check(corrupt,'启动校验损坏原档而非静默重开');check(JSON.parse(await c.exportRaw()).state.coachName==='损坏','损坏原文可导出');await c.restore(backup,{recover:true});check((await c.load()).coachName==='第二次保存','损坏恢复闭环');await c.close();
const badName='val-manager-test-closure-'+crypto.randomUUID(),bad=CAREER_STORE.create({...options,databaseName:badName,legacyStorage:{getItem:()=>'{broken'}});let malformed=false;try{await bad.load();}catch(e){malformed=true;}check(malformed,'损坏旧档不自动覆盖或初始化');await bad.close();
result.textContent=JSON.stringify({passed:true,database:name,checks},null,2);
}catch(e){result.textContent=JSON.stringify({passed:false,error:e.message,checks},null,2);}};
`;
fs.writeFileSync(output,'<!doctype html><meta charset="utf-8"><title>当前征战事务存档验收（独立数据库）</title><h1>当前征战事务存档验收</h1><p>只使用随机命名的 val-manager-test-closure 数据库；不会访问用户默认存档。</p><button id="run">运行独立存档检查</button><pre id="result">等待</pre><script src="../career-store.js"></script><script>'+script+'</script>');console.log(output);
