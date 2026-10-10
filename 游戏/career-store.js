/* Durable store for the current UI business state. Legacy business stores stay intact. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CAREER_STORE=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const FORMAT='val-manager-career-1',DATABASE='val-manager-complete-career-v1';
 const key=p=>p.name+'-'+p.tier+(p.cut?'-'+p.cut:'');
 const clone=v=>JSON.parse(JSON.stringify(v));
 function hash(raw){let n=2166136261;for(let i=0;i<raw.length;i++){n^=raw.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16).padStart(8,'0');}
 function validate(s){
  if(!s||s.version!==2||!['none','draft','active','match','reinforce','finished'].includes(s.run))throw Error('不支持的征战存档版本或流程');
  for(const field of ['roster','lineup','reinforce','unlocked','packs','opened','bp','seasons'])if(!Array.isArray(s[field]))throw Error('存档字段不完整：'+field);
  if(!Number.isInteger(s.phase)||s.phase<0||s.phase>7||!Number.isInteger(s.year)||s.year<0)throw Error('存档赛年或阶段无效');
  if(!Array.isArray(s.ledger)||!s.positions||typeof s.positions!=='object'||!s.agents||typeof s.agents!=='object')throw Error('存档缺少进度或结算账本');
  for(const side of ['attack','defense'])if(!Array.isArray(s[side])||s[side].length!==5||new Set(s[side]).size!==5)throw Error('存档战术排序无效');
  for(const values of [s.team,s.coach,s.mapKnowledge])if(!values||Object.values(values).some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('存档队伍或教练数值无效');
  if(s.tacticalProfile){if(s.tacticalProfile.version!=='team-style-1')throw Error('不支持的战术分版本');for(const side of ['attack','defense'])if(s.tacticalProfile[side]?.length!==5||s.tacticalProfile[side].some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('存档战术熟练无效');}
  const snap=s.contentSnapshot;if(!snap?.content?.cards?.length||!Array.isArray(snap.uiCards)||!Array.isArray(snap.mapCatalog))throw Error('存档缺少冻结的内容');
  const keys=new Set(snap.uiCards.map(key));
  for(const field of ['roster','lineup','reinforce','unlocked','reinforcementPack'])for(const k of s[field]||[])if(!keys.has(k))throw Error('存档引用未知选手：'+k);
  for(const pack of s.packs)for(const k of pack)if(!keys.has(k))throw Error('存档卡包引用未知选手：'+k);
  for(const p of [...snap.uiCards,...(snap.content.globalCards||[])])for(const k of ['AIM','SYN','SEN'])if(!Number.isFinite(p[k])||p[k]<0||p[k]>100)throw Error('存档卡牌数值无效');
  for(const p of snap.uiCards){for(const k of ['name','tier','team','region','cut','trait','moment','event','photo'])if(p[k]&&/[<>"'`\u0000-\u001f]/.test(p[k]))throw Error('备份卡牌含不允许的展示字符');for(const asset of [p.photo,...Object.values(p.agentAssets||{})].filter(Boolean))if(/(^[a-z]+:|^\/|\.\.|[<>"'`\u0000-\u001f])/i.test(asset))throw Error('备份卡牌资源路径无效');}
  if(s.seasonEngine&&!['2026-season-1','2026-season-2'].includes(s.seasonEngine.version))throw Error('此客户端不支持该赛制版本');
  const policy=s.spatialCampaignPolicy,ids=['ascent','haven','split','sunset','breeze','lotus','fracture','abyss','summit'];
  if(policy){
   if(typeof policy.releaseId!=='string'||!/^[-\w]{1,80}$/.test(policy.releaseId)||!policy.versions||Object.keys(policy.versions).length!==ids.length||ids.some(id=>!([id==='ascent'?'ascent-balance-3':id+'-balance-1',id==='ascent'?'ascent-balance-4':id+'-balance-2',id==='ascent'?'ascent-balance-5':id+'-balance-3'].includes(policy.versions[id]))))throw Error('此客户端不支持该赛年的空间引擎版本');
   if(!s.spatialEnabled||s.spatialVersion!==6)throw Error('存档空间引擎策略与模式不一致');
  }
  for(const m of s.liveMaps||[]){
   if(m.model&&m.model!=='team-style-1')throw Error('此客户端不支持该比赛版本');
   if(policy&&m.rounds?.length){
    const fine=m.spatial;
    if(!fine||fine.version!==(m.mapId==='ascent'?5:6)||fine.initial?.behaviorVersion!==policy.versions[m.mapId]||(fine.version===6&&fine.initial.mapId!==m.mapId))throw Error('存档比赛与赛年空间版本不一致');
    if(!Array.isArray(fine.commands)||fine.commands.length!==m.rounds.length-1||m.home+m.away!==m.rounds.length||fine.boundary?.scoreA!==m.home||fine.boundary?.scoreB!==m.away)throw Error('存档空间比分或指令账本不完整');
   }
  }
  return s;
 }
 function pack(state,revision=0){const s=clone(validate(state));s.playing=false;const raw=JSON.stringify(s);return {format:FORMAT,revision,updatedAt:Date.now(),checksum:hash(raw),state:s};}
 function unpack(value){if(!value||value.format!==FORMAT||!Number.isInteger(value.revision)||value.revision<0)throw Error('不是可识别的征战备份');if(hash(JSON.stringify(value.state))!==value.checksum)throw Error('存档校验失败，原始数据已保留');return clone(validate(value.state));}
 function parse(raw){const p=JSON.parse(raw,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('备份包含不允许的字段');return v;});unpack(p);return p;}
 function contentBridge(D,R,C){
  const latest=clone({content:C,uiCards:D.cards,mapCatalog:R.mapCatalog});
  function bind(s){const snap=s.contentSnapshot||latest;for(const k of Object.keys(C))delete C[k];Object.assign(C,clone(snap.content));D.cards=clone(snap.uiCards);D.pool=D.cards;D.clubs=C.clubs;R.mapCatalog=clone(snap.mapCatalog);D.allMaps=R.mapCatalog;return s;}
  function freeze(s){if(!s.contentSnapshot)s.contentSnapshot=clone(latest);return s;}
  const newRun=R.newRun,finish=R.finish;
  R.newRun=(s,...args)=>{R.preflightNewRun?.();const retained=s.contentSnapshot?.uiCards||[];s.contentSnapshot=clone(latest);const keys=new Set(s.contentSnapshot.uiCards.map(key));for(const p of retained)if(!keys.has(key(p)))s.contentSnapshot.uiCards.push(clone(p));bind(s);return newRun(s,...args);};
  R.finish=s=>{const ok=finish(s);if(ok){const y=s.seasons.find(y=>y.year===s.year);if(y&&!y.cardSnapshot)y.cardSnapshot=clone(D.cards);}return ok;};
  return {bind,freeze,latest:()=>clone(latest)};
 }
 function open(indexedDB,name){if(!indexedDB)return Promise.reject(Error('当前浏览器不支持事务存档'));return new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{q.result.createObjectStore('records');q.result.createObjectStore('backups');};q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('存档数据库被旧页面占用'));q.onsuccess=()=>{q.result.onversionchange=()=>q.result.close();resolve(q.result);};});}
 function create({indexedDB,databaseName=DATABASE,legacyStorage,legacyKey='vm-complete-ui-v3',freeze,initial,test=false}){
  if(test&&!/^val-manager-test-[\w-]+$/.test(databaseName))throw Error('测试必须使用唯一临时数据库');
  let db,revision=0,queue=Promise.resolve(),blocked=null,observed=null;
  let opened;const ready=()=>opened||(opened=open(indexedDB,databaseName).then(v=>db=v));
  async function transaction(write,job){await ready();return new Promise((resolve,reject)=>{const tx=db.transaction(['records','backups'],write?'readwrite':'readonly');let result,failure;const records=tx.objectStore('records'),backups=tx.objectStore('backups');const q=records.get('current');q.onsuccess=()=>{try{job({tx,records,backups,current:q.result,set:v=>result=v});}catch(e){failure=e;tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(failure||tx.error||Error('存档事务失败'));});}
  async function load(){return transaction(true,({records,backups,current,set})=>{
   observed=current?hash(JSON.stringify(current)):null;if(current){if(Number.isInteger(current.revision))revision=current.revision;const s=unpack(current);set(s);return;}
   const raw=legacyStorage?.getItem(legacyKey);let s;
   if(raw){s=JSON.parse(raw);if(s.version!==2)throw Error('旧档版本不支持，原始存档保持原样');freeze(s);}else{s=initial();freeze(s);}
   const envelope=pack(s);records.put(envelope,'current');if(raw)backups.put({raw,kind:'legacy',createdAt:Date.now()},'legacy-original');revision=0;observed=hash(JSON.stringify(envelope));set(clone(s));
  });}
  function enqueue(job){const next=queue.then(()=>{if(blocked)throw blocked;return job();});queue=next.catch(e=>{blocked=e;});return next;}
  function save(state){const copy=clone(state);return enqueue(()=>transaction(true,({records,current,set})=>{if(!current)throw Error('当前存档缺失');unpack(current);if(current.revision!==revision||hash(JSON.stringify(current))!==observed)throw Error('其他窗口已更新存档，请导出当前进度后重新载入');const envelope=pack(copy,revision+1);if(current.checksum===envelope.checksum){set(current.revision);return;}records.put(current,'previous');records.put(envelope,'current');revision=envelope.revision;observed=hash(JSON.stringify(envelope));set(revision);}));}
  async function exportRaw(){await queue;return transaction(false,({current,set})=>{if(!current)throw Error('暂无事务存档，可导出原始旧档');set(JSON.stringify(current,null,2));});}
  async function previous(){return transaction(false,({records,set})=>{const q=records.get('previous');q.onsuccess=()=>{try{if(!q.result)throw Error('尚无上一个有效存档');unpack(q.result);set(q.result);}catch(e){set({error:e.message});}};}).then(v=>{if(v?.error)throw Error(v.error);if(!v)throw Error('尚无上一个有效存档');return v;});}
  async function clearedBackup(){return transaction(false,({records,set})=>{const q=records.get('cleared-career');q.onsuccess=()=>set(q.result);}).then(v=>{if(!v)throw Error('暂无清空前的存档');unpack(v);return v;});}
  async function legacyRaw(){try{await ready();}catch{return legacyStorage?.getItem(legacyKey)??null;}return new Promise((resolve,reject)=>{const tx=db.transaction('backups','readonly'),q=tx.objectStore('backups').get('legacy-original');q.onsuccess=()=>resolve(q.result?.raw??legacyStorage?.getItem(legacyKey)??null);q.onerror=()=>reject(q.error);});}
  // Import is an explicit user action. The displaced record is durably archived first.
  async function restore(raw,{recover=false}={}){const incoming=parse(raw);await queue;const s=await transaction(true,({records,backups,current,set})=>{if((current?hash(JSON.stringify(current)):null)!==observed)throw Error('其他窗口已更新存档，请重新载入后导入');if(current)backups.put({raw:JSON.stringify(current),kind:recover?'recovery':'import',createdAt:Date.now()},'before-restore:'+Date.now()+':'+hash(JSON.stringify(current)));const e=pack(incoming.state,(Number.isInteger(current?.revision)?current.revision:revision)+1);records.put(e,'current');revision=e.revision;observed=hash(JSON.stringify(e));set(clone(e.state));});blocked=null;return s;}
  // Explicit fresh-start action: archive the displaced career before replacing active progress.
  async function restart(state){await queue;const fresh=state?clone(state):initial();freeze(fresh);const incoming=pack(fresh);const restored=await transaction(true,({records,backups,current,set})=>{if((current?hash(JSON.stringify(current)):null)!==observed)throw Error('其他窗口已更新存档，请重新载入后重开');if(current)backups.put({raw:JSON.stringify(current),kind:'restart',createdAt:Date.now()},'before-restart:'+Date.now()+':'+hash(JSON.stringify(current)));const e=pack(incoming.state,(Number.isInteger(current?.revision)?current.revision:revision)+1);records.clear();if(current){records.put(current,'previous');records.put(current,'cleared-career');}records.put(e,'current');revision=e.revision;observed=hash(JSON.stringify(e));set(clone(e.state));});blocked=null;return restored;}
  return {load,save,exportRaw,previous,clearedBackup,legacyRaw,restore,restart,flush:()=>queue,revision:()=>revision,close:async()=>{await queue;await ready();db.close();}};
 }
 return {FORMAT,DATABASE,hash,validate,pack,unpack,parse,create,contentBridge};
});
