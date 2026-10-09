(async () => {
 'use strict';
 const testDatabase=document.querySelector('meta[name="career-test-database"]')?.content;
 if(testDatabase&&(!/^val-manager-test-[\w-]+$/.test(testDatabase)||!decodeURIComponent(location.pathname).endsWith('/游戏/out/career-browser-check.html')))throw Error('验收页只能使用独立测试数据库');
 const D=DEMO,F=FLOW_UI,A=ARCHIVE_UI,$=id=>document.getElementById(id),STORE=testDatabase?testDatabase+'-legacy':'vm-complete-ui-v3',PREVIEW_STORE=testDatabase?testDatabase+'-preview':'vm-complete-ui-v3-preview',R=PROTOTYPE_RULES;
 const card=k=>D.cards.find(p=>D.key(p)===k),esc=F.esc;
 let previewMode=false; let s=D.seed(),path='',view=null,filterDraft=null,timer=null,toastTimer=null,installPrompt=null,registration=null,cacheReady=false,focusNext='',returnFocus='',disclosures={},storageError=null,pendingImport=null;
 const bridge=CAREER_STORE.contentBridge(D,R,CN_CONTENT),durable=CAREER_STORE.create({indexedDB:window.indexedDB,...(testDatabase?{databaseName:testDatabase,test:true}:{}),legacyStorage:{getItem:key=>window.localStorage.getItem(key)},legacyKey:STORE,freeze:bridge.freeze,initial:()=>D.seed()});
 try{previewMode=sessionStorage.getItem(PREVIEW_STORE)==='active';}catch{}
 try{if(previewMode){const raw=localStorage.getItem(PREVIEW_STORE);s=raw?JSON.parse(raw):D.seed();bridge.freeze(s);CAREER_STORE.validate(s);}else s=await durable.load();bridge.bind(s);}catch(error){storageError=error;bridge.freeze(s);bridge.bind(s);}
 R.init(s);D.sync(s);s.playing=false;
 const save=()=>{if(storageError)return;R.compact?.(s);s.lastRoute=path;bridge.freeze(s);if(previewMode){try{localStorage.setItem(PREVIEW_STORE,JSON.stringify(s));}catch(error){failStorage(error);}return;}durable.save(s).catch(failStorage);};
 function failStorage(error){if(storageError)return;storageError=error;s.playing=false;stopTimer();showStorageError();}
 function showStorageError(){dialog('存档需要处理',`<p class="dialog-copy">${esc(storageError.message)}。原存档未被覆盖，继续操作已暂停。</p><div class="dialog-actions"><button data-action="export-save" class="quiet-button">导出原始存档</button><button data-action="export-legacy" class="quiet-button">导出原始旧档</button><button data-action="export-draft" class="quiet-button">导出当前未提交进度</button><button data-action="recover-save" class="quiet-button">查看上个有效存档</button><button data-action="import-save" class="blue-button">从备份恢复</button><button data-action="reload-save" class="quiet-button">重新载入</button></div>`);}
 let exportURL='';
 function download(raw,name){if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([raw],{type:'application/json'}));dialog('存档备份已准备好',`<p class="dialog-copy">将这份备份保存在其他位置，需要时可在设置导入。</p><a class="blue-button full" id="backup-download" download="${esc(name)}">下载存档备份</a><details class="plain-details"><summary>复制备份内容</summary><textarea id="backup-text" aria-label="备份内容" readonly rows="6" style="width:100%"></textarea></details>`);$('backup-download').href=exportURL;$('backup-text').value=raw;}
 async function restoreSave(){if(!pendingImport)return;try{if(previewMode){s=CAREER_STORE.unpack(CAREER_STORE.parse(pendingImport));localStorage.setItem(PREVIEW_STORE,JSON.stringify(s));}else s=await durable.restore(pendingImport,{recover:!!storageError});pendingImport=null;storageError=null;bridge.bind(s);R.init(s);D.sync(s);s.playing=false;path='';go(s.lastRoute||'campaign',true);toast('备份已恢复。');}catch(e){toast(e.message);}}
 function reviewImport(raw){const e=CAREER_STORE.parse(raw),v=e.state;pendingImport=raw;dialog('恢复这份备份？',`<p class="dialog-copy">${esc(v.coachName)} · 第 ${v.year} 赛年 · ${esc(D.phases[v.phase])}。${previewMode?'仅替换独立预览。':'当前进度会先保留备份，然后恢复这份存档。'}</p><div class="dialog-actions"><button class="quiet-button" data-action="close-dialog">取消</button><button class="blue-button" data-action="restore-save">恢复备份</button></div>`);}
 const importFile=document.createElement('input');importFile.type='file';importFile.accept='.json,application/json';importFile.hidden=true;document.body.append(importFile);importFile.onchange=async()=>{const f=importFile.files[0];if(!f)return;try{if(f.size>30_000_000)throw Error('备份文件过大');reviewImport(await f.text());}catch(e){toast(e.message);}importFile.value='';};
 function remember(){if(!path)return;s.positions[path]=$('nav-scroll').scrollTop;disclosures[path]=[...$('page-body').querySelectorAll('details')].map(e=>e.open);save();}
 const routeURL=next=>location.pathname+location.search+"#"+next;
 const parsed=()=>location.hash.slice(1).split('/').map(v=>{try{return decodeURIComponent(v);}catch{return v;}});
 function go(next,replace=false,focus=''){remember();stopTimer();s.playing=false;const from=path||'campaign';$('app-dialog').close();$('filter-dialog').close();$('toast').hidden=true;clearTimeout(toastTimer);history[replace?'replaceState':'pushState']({uiDemo:true,from,focus},'',routeURL(next));render();}
 function back(){remember();stopTimer();s.playing=false;if(path==='campaign/tactics'&&s.adjusting){cancelAdjustment();return;}const from=history.state?.uiDemo?history.state.from:null;returnFocus=history.state?.focus||'';if(from)history.back();else go(path.startsWith('archive/')?'archive/'+(path.includes('player')?'album':'career'):path.startsWith('team/')?'team':'campaign',true);}
 function refresh(focus=''){remember();focusNext=focus;render();}
 function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
 function dialog(title,body){$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('app-dialog').showModal();initReveal($('app-dialog'));}
 function initReveal(root){for(const reveal of root.querySelectorAll('.quality-reveal')){const img=reveal.querySelector('.balance-portrait');reveal.classList.add('reveal-loading');const ready=()=>{if(!reveal.isConnected)return;reveal.classList.remove('reveal-loading');reveal.classList.add('reveal-ready');};if(!img||img.complete&&img.naturalWidth){ready();}else{img.addEventListener('load',ready,{once:true});img.addEventListener('error',ready,{once:true});if(img.decode)img.decode().then(ready,()=>{});}}}
 document.addEventListener('animationend',e=>{if(e.animationName==='mobile-reveal-card')e.target.closest('.quality-reveal')?.classList.add('reveal-complete');});
 function showCard(k,reveal=false){const p=card(k);if(!p)return;const root=path.split('/')[0];dialog(reveal?'揭晓选手':p.name,`${reveal?F.revealEffect(p,`<div class="players-grid detail-card-wrap">${renderNavCard(p,'detail').replace('<button ','<article ').replace('</button>','</article>')}</div>`):`<div class="players-grid detail-card-wrap">${renderNavCard(p,'detail').replace('<button ','<article ').replace('</button>','</article>')}</div>`}${p.tier==='钻'?`<div class="detail-traits"><span class="detail-trait-label">通用特性</span>${renderNavTrait(p)}</div>`:''}${!path.includes('/player/')?`<button class="blue-button dialog-profile-link" data-go="${root}/player/${k}">选手资料 →</button>`:''}`);}
 function enterPreview(){if(!previewMode){save();previewMode=true;try{sessionStorage.setItem(PREVIEW_STORE,'active');}catch{}}}
 function setScene(scene){enterPreview();stopTimer();const settings={coachName:s.coachName,reducedMotion:s.reducedMotion,largeText:s.largeText};s={...D.seed(),...settings};disclosures={};
 if(scene!=='fresh'){R.newRun(s,CN_CONTENT,CN_DRAW,Math.random);s.simulation='fixture';s.opened=[10,10,10];s.unlocked=[...new Set(s.packs.flat())];s.packs[0]=[...D.demoRoster(),...s.packs[0].filter(k=>!D.demoRoster().includes(k))].slice(0,10);s.unlocked=[...new Set([...s.unlocked,...s.packs[0]])];D.sync(s);R.register(s,D.demoRoster(),D.cards);s.run='active';s.chosenPack=0;s.lineup=[...s.roster];s.phase=2;}
 if(scene==='final5'||scene==='final5-lower')SEASON_REVIEW.final(s,scene==='final5-lower');
 if(scene==='team-style')SEASON_REVIEW.preparation(s);
 if(scene==='ascent')SEASON_REVIEW.spatial(s);
 if(scene==='ascent-v3')SEASON_REVIEW.spatial(s,3);
 if(scene==='ascent-v4')SEASON_REVIEW.spatial(s,4);
 if(scene.startsWith('map-')&&SPATIAL_MATCH.mapIds.includes(scene.slice(4)))SEASON_REVIEW.spatial(s,6,scene.slice(4));
 if(scene==='ascent-v5')SEASON_REVIEW.spatial(s,5);
 if(scene==='empty'){s.history=false;s.seasons=[];}
 if(scene==='reinforce'){s.phase=1;R.openReinforcement(s,CN_DRAW,Math.random);}
 if(scene==='loss'||scene==='sweep'){s.resultMode=scene;s.phase=3;s.map=1;s.bp=seededBP();s.round=R.rounds(s)[1].length;s.completedMatch=true;s.run='match';if(scene==='loss')s.qualificationOverrides={4:false};for(let i=0;i<=s.map;i++){const old=s.map;s.map=i;s.round=R.rounds(s)[i].length;R.settleMap(s,D.cards);s.map=old;}R.matchGrowth(s,D.cards,'formal',scene==='sweep',0);}
 if(scene==='miss-world'){s.scenario='miss-world';s.phase=1;}
 if(scene==='miss-playoffs'){s.scenario='miss-playoffs';s.phase=3;}
 if(scene==='overtime'){s.scenario='overtime';s.phase=0;s.bp=seededBP();s.run='match';s.round=24;s.halftimeSeen=true;s.agents={0:recommendAgents()};}
 if(scene==='records'||scene==='ended'){for(let i=0;i<8;i++){s.phase=i;s.completedMatch=true;R.settleStage(s,D.cards);}R.finish(s);}
 save();go(scene==='team-style'?'campaign/prepare':scene==='loss'||scene==='sweep'?'campaign/series-result':scene==='records'||scene==='empty'?'archive/career':scene==='reinforce'?'campaign/reinforce':scene.startsWith('map-')||scene==='overtime'||scene==='ascent'||(scene==='ascent-v3'||scene==='ascent-v4'||scene==='ascent-v5')?'campaign/match':'campaign',true);}
 async function leavePreview(){stopTimer();try{await durable.flush();const own=await durable.load();previewMode=false;sessionStorage.removeItem(PREVIEW_STORE);s=own;bridge.bind(s);R.init(s);D.sync(s);s.playing=false;path='';go(s.lastRoute||'campaign',true);}catch(error){failStorage(error);}}
 
 const chapters=[['campaign','征战首页'],['campaign/start','选择主队'],['campaign/packs','开启卡包'],['campaign/reveal','逐张揭晓'],['campaign/compare','比较三个包'],['campaign/pick','选择五人'],['campaign/confirm','阵容确认'],['campaign/calendar','赛历'],['campaign/standings','阶段成绩'],['campaign/prepare','赛前备战'],['campaign/bp','地图 BP'],['campaign/agents','特工选择'],['campaign/tactics','战术排序'],['campaign/match','战报 / 观赛'],['campaign/map-result','单图结算'],['campaign/series-result','系列赛结算'],['campaign/stage-result','阶段结算'],['campaign/reinforce','补强阵容'],['campaign/reinforce-review','补强比较'],['campaign/year-result','赛年收获'],['team','战队名单'],['team/overview','队伍资料'],['team/maps','地图资料'],['archive/album','图鉴'],['archive/player/ZmjjKK-金','选手资料'],['archive/player/ZmjjKK-钻','钻卡资料'],['archive/career','生涯'],['archive/coach','教练资料'],['archive/season/1','历年回顾'],['archive/relationships','选手关系'],['archive/honors','荣誉记录'],['archive/settings','设置'],['archive/loading','加载状态'],['archive/error','错误恢复'],['archive/offline','离线状态']];
 const mapScenes=SPATIAL_MATCH.mapIds.map(id=>['map-'+id,PROTOTYPE_RULES.mapCatalog.find(m=>m.id===id)?.name+' · 空间观战']);
 const scenes=[['fresh','从头开局'],['team-style','队伍风格 · 赛前备战'],['active','继续征战'],['records','完整档案'],['empty','首次档案'],['reinforce','补强窗口'],['ended','赛年结束'],['loss','失利与出局'],['sweep','两图获胜'],['miss-world','未晋级世界赛'],['miss-playoffs','未晋级季后赛'],['overtime','加时与暂停'],['ascent','Ascent 旧版行动回放'],['ascent-v3','Ascent 新版空间与交火'],['ascent-v4','Ascent 分层站位与交火'],['ascent-v5','Ascent 墙门、解说与卡牌效果'],['final5','胜者组 BO5 决赛'],['final5-lower','败者组 BO5 决赛'],...mapScenes];
 $('scene-list').innerHTML=scenes.map(([id,label])=>`<button data-scene="${id}">${label}</button>`).join('');$('page-list').innerHTML=chapters.map(([r,label])=>`<button data-preview="${r}">${label}</button>`).join('');
 const navIcon={team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7',campaign:'M5 21V3 M5 4h14l-4 5 4 5H5',archive:'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h4'};
 function currentView(parts){const [root,sub,id]=parts;if(sub==='player')return A.player(s,id);if(root==='campaign'){const methods={start:'start',packs:'packs',reveal:'reveal',compare:'compare',pick:'pick',confirm:'confirm',calendar:'calendar',standings:'standings',prepare:'prepare',bp:'bp',agents:'agents',tactics:'tactics',match:'match','map-result':'mapResult','series-result':'series','stage-result':'stage',reinforce:'reinforce','reinforce-review':'compareTeam','year-result':'year'};return F[methods[sub]||'home'](s);}if(root==='team')return sub==='overview'?A.overview(s):sub==='maps'?A.maps(s):sub==='map'?A.mapDetail(id,s):A.team(s);if(root==='archive'){if(sub==='album'||!sub)return A.album(s);if(sub==='career')return A.career(s);if(sub==='season')return A.season(s,id||1);if(sub==='relation')return A.relation(s,id);if(['loading','error','offline'].includes(sub))return A.state(sub);return A[sub]?.(s)||A.career(s);}return F.home(s);}
 function render(){stopTimer();let parts=parsed();if(!['campaign','team','archive'].includes(parts[0])){history.replaceState(null,'',routeURL('campaign'));parts=['campaign'];}path=parts.join('/');s.archive=parts[0]==='archive'&&['album','career'].includes(parts[1])?parts[1]:s.archive;
  D.sync(s);
  $('preview-banner').hidden=!previewMode;
  const sub=parts[1],draft=['packs','reveal','compare','pick','confirm'],matchPages=['prepare','bp','agents','tactics','match','map-result','series-result','stage-result'];
  let blocked='';
  if(parts[0]==='campaign'&&draft.includes(sub)&&(s.run!=='draft'||!s.packs.length))blocked='请先选择主队并开启本次三个包。';
  if(parts[0]==='campaign'&&['pick','confirm'].includes(sub)&&s.chosenPack===null)blocked='请先选定一个完整卡包。';
  if(sub==='confirm'&&s.lineup.length!==5)blocked='请先从选定卡包选择五位队员。';
  if(parts[0]==='campaign'&&matchPages.includes(sub)&&(!s.roster.length||!['active','match'].includes(s.run)))blocked='当前没有可进行的正式比赛。';
  if(parts[0]==='campaign'&&['prepare','bp','agents','tactics','match'].includes(sub)&&!R.eligible(s))blocked='本阶段未晋级，请先结算赛历。';
  if(['agents','tactics','match','map-result','series-result'].includes(sub)&&s.bp.length!==7)blocked='请先完成地图 BP。';
  if(sub==='tactics'&&s.run==='match'&&s.round>0&&!s.coachWindow)blocked='当前仅为观看暂停；战术调整需要中场或任一方的战术暂停。';
  if(sub==='tactics'&&s.round>0&&!s.adjusting)blocked='请从比赛中的调整按钮进入当前执教窗口。';
  if(['tactics','match'].includes(sub)&&s.roster.some(k=>!s.agents[s.map]?.[k]))blocked='请先为本图五位队员选择特工。';
  if(['agents','tactics','match'].includes(sub)&&s.bp.length===7&&R.pendingSide(s)!==undefined)blocked='请先完成本场地图开局选边。';
  if(sub==='match'&&s.run!=='match')blocked='请先完成赛前准备并开始本图比赛。';
  if(sub==='agents'&&s.run==='match'&&s.round>0)blocked='本图已经开始，不能在比赛中更换特工。';
  if(sub==='map-result'&&s.reviewMap===null&&!R.mapOver(s))blocked='本图尚未结束。';
  if(sub==='series-result'&&!s.completedMatch)blocked='本场系列赛尚未结束。';
  if(sub==='stage-result'&&!s.stageRecords.some(r=>r.phase===s.phase))blocked='本阶段尚未结算。';
  if(['reinforce','reinforce-review'].includes(sub)&&s.run!=='reinforce')blocked='当前没有补强窗口。';
  if(sub==='year-result'&&(s.phase!==7||!s.stageRecords.some(r=>r.phase===7)))blocked='本赛年尚未结束。';
  
 if(s.run==='draft'&&['packs','reveal','compare','pick','confirm'].includes(parts[1]))s.draftRoute=path;
  view=blocked?{title:'继续当前征战',body:F.empty('当前步骤尚未开放',blocked),dock:'返回征战',go:'campaign'}:currentView(parts);const top=['campaign','team','archive/album','archive/career','archive'].includes(path),dock=!!view.dock;
  const phone=document.querySelector('.app-phone');phone.classList.toggle('in-subpage',!top);phone.classList.toggle('no-dock',!top&&!dock);phone.classList.toggle('reduce-motion',s.reducedMotion);phone.classList.toggle('large-text',s.largeText);
  $('page-back').hidden=top;$('main-nav').hidden=!top;$('subpage-dock').hidden=!dock;$('page-title').textContent=view.title;
  $('main-nav').innerHTML=[['team','战队'],['campaign','征战'],['archive','档案']].map(([r,label])=>`<button data-go="${r==='archive'?'archive/'+s.archive:r}" class="${r==='campaign'?'core-nav':''}" ${parts[0]===r?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${navIcon[r]}"/></svg>${label}</button>`).join('');
  $('subpage-dock').innerHTML=dock?`<button class="blue-button" ${view.go?'data-go="'+view.go+'"':'data-action="'+view.action+'"'} ${view.disabled?'disabled':''}>${view.dock}</button>`:'';$('page-body').innerHTML=view.body;initReveal($('page-body'));for(const img of $('page-body').querySelectorAll('img')){img.decoding='async';if(!img.closest('.quality-reveal,.map-grid'))img.loading='lazy';}
  if($('album-results'))updateAlbum();if($('team-results'))updateTeam();
  [...$('page-body').querySelectorAll('details')].forEach((e,i)=>{if(disclosures[path]?.[i])e.open=true;});$('nav-scroll').scrollTop=Number(s.positions[path])||0;
  if(focusNext||returnFocus){document.querySelector(focusNext||returnFocus)?.focus({preventScroll:true});focusNext='';returnFocus='';}else if(!top)$('page-title').focus({preventScroll:true});
  if($('offline-setting'))$('offline-setting').textContent=testDatabase?'隔离验收页':cacheReady?'已可离线浏览':'正在准备资源';updateConnection();save();
  if(path==='campaign/match'&&s.playing)startTimer();
 }
 function albumResults(filters=s){const q=s.query.trim().toLowerCase();const list=D.cards.filter(p=>s.unlocked.includes(D.key(p))&&`${p.name} ${p.team} ${p.agents.join(' ')}`.toLowerCase().includes(q)&&(filters.tier==='all'||filters.tier===p.tier)&&(filters.region==='all'||filters.region===p.region));if(filters.sort==='rating')list.sort((a,b)=>b.rating-a.rating);if(filters.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));return list;}
 function updateAlbum(){const list=albumResults();$('album-results').innerHTML=list.length?list.map(p=>renderNavThumb(p,D.key(p))).join(''):`<div class="players-empty"><h3>${s.unlocked.length?'没有匹配结果':'还没有解锁的卡片'}</h3><button ${s.unlocked.length?'data-action="clear-filters"':'data-go="campaign/start"'}>${s.unlocked.length?'清除条件':'去开启卡包'}</button></div>`;$('result-count').textContent='已解锁 · '+list.length+' 张';const tags=[];if(s.tier!=='all')tags.push(['tier',s.tier+'卡']);if(s.region!=='all')tags.push(['region',{CN:'中国',AMER:'美洲',PAC:'太平洋',EMEA:'欧洲中东非'}[s.region]]);if(s.sort!=='default')tags.push(['sort',s.sort==='rating'?'总评优先':'姓名']);$('filter-count').textContent=tags.length||'';$('filter-tags').innerHTML=tags.map(([field,label])=>`<button data-clear-filter="${field}">${label}<span aria-label="移除此条件">×</span></button>`).join('');}
 function updateTeam(){const q=s.teamQuery.toLowerCase(),list=F.lineup(s).filter(p=>p.name.toLowerCase().includes(q));if(s.teamSort!=='default')list.sort((a,b)=>b[s.teamSort]-a[s.teamSort]);$('team-results').dataset.sort=s.teamSort;$('team-results').innerHTML=list.length?list.map(p=>renderNavCard(p,D.key(p),s.teamSort)).join(''):'<div class="players-empty"><h3>没有匹配结果</h3><button data-action="clear-team">清除搜索</button></div>';$('team-count').textContent=list.length+' 名选手';}
 function filterUI(){const groups=[['tier','品质',[['all','全部'],['铜','铜卡'],['银','银卡'],['金','金卡'],['钻','钻卡']]],['region','赛区',[['all','全部'],['CN','中国'],]],['sort','排序',[['default','默认'],['rating','总评优先'],['name','姓名']]]];$('filter-fields').innerHTML=groups.map(([field,title,options])=>`<fieldset><legend>${title}</legend><div class="filter-options">${options.map(([value,label])=>`<button data-filter-field="${field}" data-filter-value="${value}" aria-pressed="${filterDraft[field]===value}">${label}</button>`).join('')}</div></fieldset>`).join('');$('filter-apply').textContent='查看 '+albumResults(filterDraft).length+' 张';}
 function validLineup(list){if(s.run==='reinforce'&&s.reinforcementOpened<10)return '请先揭晓补强包';return R.validate(list,D.cards,s.run==='reinforce'?[...s.roster,...s.reinforcementPack]:s.packs[s.chosenPack]);}
 function selectPlayer(field,k,max){const list=s[field],allowed=field==='reinforce'&&s.run==='reinforce'?[...s.roster,...s.reinforcementPack]:field==='lineup'&&s.run==='draft'?s.packs[s.chosenPack]:[];if(!card(k)||!allowed?.includes(k)){toast('该卡不在本次候选范围。');return;}if(list.includes(k)){s[field]=list.filter(v=>v!==k);refresh();return;}if(list.length>=max){toast('先移出一位队员，再加入新人。');return;}if(list.some(v=>card(v).name===card(k).name)){toast('同一选手只能选择一个版本。');return;}if(card(k).tier==='钻'&&list.some(v=>card(v).tier==='钻')){toast('阵容最多一张钻卡。');return;}list.push(k);refresh();}
 function stopTimer(){clearTimeout(timer);timer=null;}
 function startTimer(delay){stopTimer();if(s.coachWindow||s.adjusting)return;timer=setTimeout(()=>{if(s.coachWindow||s.adjusting)return;if(R.replayPending?.(s))startTimer(250);else advanceRound();},delay??(s.fastForward?40:Math.max(3600,R.replayDuration?.(s)||0)));}
 function advanceRound(){if(storageError||s.coachWindow||s.adjusting)return;if(R.mapOver(s)){s.playing=false;refresh();return;}if(s.simulation==='live')R.stepRound(s);else{const win=R.rounds(s)[s.map][s.round];s.round++;R.roundGrowth(s,win,D.cards);R.settleMap(s,D.cards);}
 if(!R.spatialMap?.(s)&&s.round===12&&!s.halftimeSeen){s.halftimeSeen=true;s.coachWindow='half';R.adaptOpponent?.(s);}
 else if(!R.spatialMap?.(s)&&!R.mapOver(s)&&!s.coachWindow&&R.timeoutLeft(s,'opponent')>0&&(s.simulation==='live'?R.shouldOpponentTimeout(s):s.round===8&&!s.aiPaused)){s.aiPaused=true;R.chargeTimeout(s,'opponent');}
 if(R.mapOver(s)){s.playing=false;s.fastForward=false;}if(s.coachWindow)s.playing=false;refresh();}
 
 function beginAdjust(kind){if(!s.coachWindow)return;stopTimer();s.playing=false;s.adjustBackup={attack:[...s.attack],defense:[...s.defense]};s.adjusting=kind;$('app-dialog').close();go('campaign/tactics');}
 function seededBP(){s.sideChosen=[true,true,true];return [...s.activeMaps];}
 function previewPage(r){if(!chapters.some(([route])=>route===r))return;setScene(r.includes('reinforce')?'reinforce':r.includes('year-result')?'ended':r.includes('series-result')?'sweep':(r.includes('season')||['archive/career','archive/relationships','archive/honors'].includes(r))?'records':r==='campaign/start'?'fresh':'active');
 if(['campaign/packs','campaign/reveal','campaign/compare','campaign/pick','campaign/confirm'].includes(r)){s.run='draft';s.chosenPack=r.endsWith('pick')||r.endsWith('confirm')?0:null;s.lineup=r.endsWith('confirm')?D.demoRoster():[];if(r==='campaign/packs'||r==='campaign/reveal'){s.opened=[0,0,0];s.unlocked=[];if(r==='campaign/reveal')R.reveal(s);}}
 if(['campaign/agents','campaign/tactics','campaign/match','campaign/map-result'].includes(r)){s.bp=seededBP();s.run='match';s.map=0;s.round=r.endsWith('map-result')?R.rounds(s)[0].length:0;s.agents={0:recommendAgents()};}
 if(r==='campaign/stage-result'){s.completedMatch=true;R.settleStage(s,D.cards);}
 if(r==='archive/player/ZmjjKK-钻'){s.unlocked=[...new Set([...s.unlocked,D.key(D.cards.find(p=>p.name==='ZmjjKK'&&p.tier==='钻'))])];}if(r==='archive/player/ZmjjKK-钻')r='archive/player/'+D.key(D.cards.find(p=>p.name==='ZmjjKK'&&p.tier==='钻'));
 go(r);}
 function recommendAgents(){const members=F.lineup(s),selection=AGENT_SELECTION.recommend(members,CN_CONTENT.agents,F.matchMap(s).id);return Object.fromEntries(members.map((p,i)=>[D.key(p),selection.agents[i]]));}
 
 function chooseBP(id){if(s.bp.includes(id)||!s.activeMaps.includes(id)||s.bp.length>=7||R.bpActor(s)!=='player')return;if(s.simulation==='live')R.bpMove(s,id);else{s.bp.push(id);R.fillOpponentBP(s);}s.pendingMap='';refresh();promptSide();}
 function promptSide(){const index=R.pendingSide(s);if(index===undefined)return;const id=R.mapsFor(s)[index],map=R.mapCatalog.find(m=>m.id===id);dialog('图 '+(index+1)+' · '+(map?.name||id),`<div class="side-map">${map?D.art(map):''}<strong>${esc(map?.name||id)}</strong><span>BO${s.bestOf||3} · 图 ${index+1} · 我方选边</span></div><div class="side-choice"><button data-side-index="${index}" data-side="attack">进攻开局</button><button data-side-index="${index}" data-side="defense">防守开局</button></div>`);}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
  const storageActions=['export-save','export-draft','export-legacy','import-save','recover-save','restore-save','reload-save','close-dialog'];if(storageError&&!storageActions.includes(b.dataset.action)){showStorageError();return;}
  if(b.dataset.scene){setScene(b.dataset.scene);$('app-dialog').close();return;}
  if(b.dataset.preview){previewPage(b.dataset.preview);return;}
  if(b.dataset.go){let focus='';if(b.dataset.go.includes('/player/'))focus=path==='team/overview'?`[data-open-profile="${b.dataset.go.split('/').pop()}"]`:`[data-player="${b.dataset.go.split('/').pop()}"]`;go(b.dataset.go,false,focus);return;}
  if('revealSkip' in b.dataset){b.closest('.quality-reveal').classList.add('reveal-complete');return;}
  if(b.dataset.effectPreview){const p=D.cards.find(p=>p.tier===b.dataset.effectPreview);showCard(D.key(p),true);$('dialog-title').textContent='动效预览 · '+p.tier+'卡';return;}
  if(b.dataset.player||b.dataset.card){showCard(b.dataset.player||b.dataset.card);return;}
  if(b.dataset.openProfile){go(path.split('/')[0]+'/player/'+b.dataset.openProfile,false,`[data-open-profile="${b.dataset.openProfile}"]`);return;}
  if(b.dataset.version){const p=card(b.dataset.version),current=card(parsed()[2]);if(p?.name===current?.name){remember();const next=parsed()[0]+'/player/'+b.dataset.version;s.positions[next]=0;history.replaceState(history.state,'',routeURL(next));render();document.querySelector(`[data-version="${b.dataset.version}"]`)?.focus({preventScroll:true});}return;}
  if(b.dataset.club){s.nextClub=b.dataset.club;refresh(`[data-club="${b.dataset.club}"]`);return;}
  if(b.dataset.pack!==undefined){if(s.chosenPack!==null){toast('整包已锁定，请先重新选择整包。');return;}s.pack=Number(b.dataset.pack);refresh(`[data-pack="${s.pack}"]`);return;}
  if(b.dataset.pick){selectPlayer('lineup',b.dataset.pick,5);return;}
  if(b.dataset.reinforce){selectPlayer('reinforce',b.dataset.reinforce,5);return;}
  if(b.dataset.bpRole){if(s.bp.length)return;if(s.simulation==='live')R.chooseBPRole(s,b.dataset.bpRole);else{s.bpRole=b.dataset.bpRole;s.sideChosen=[false,false,false];R.fillOpponentBP(s);}refresh();return;}
  if(b.dataset.map){s.pendingMap=b.dataset.map;refresh(`[data-map="${s.pendingMap}"]`);return;}
  if(b.dataset.mapPlan){const m=D.allMaps.find(m=>m.id===b.dataset.mapPlan);dialog(m.name+' · 战术图',`<div class="detail-layout">${D.softPlan(m)}</div><details class="plain-details"><summary>查看官方原图</summary><img class="map-layout" src="${F.asset('地图官方/'+m.id+'-plan.webp')}" alt="${m.name} 官方俯视图"></details>`);return;}
  if(b.dataset.mapDetail){go('team/map/'+b.dataset.mapDetail);return;}
  if(b.dataset.agent){if(!s.roster.includes(b.dataset.agentPlayer)||!CN_CONTENT.agents.includes(b.dataset.agent)){toast('当前阵容或特工不合法。');return;}const field=s.agents[s.map]||(s.agents[s.map]={});if(Object.entries(field).some(([k,a])=>k!==b.dataset.agentPlayer&&a===b.dataset.agent)){toast('同一队伍不能重复选择特工。');return;}field[b.dataset.agentPlayer]=b.dataset.agent;refresh(`[data-agent-player="${b.dataset.agentPlayer}"][data-agent="${b.dataset.agent}"]`);return;}
  if(b.dataset.tacticSide){s.tacticSide=b.dataset.tacticSide;refresh(`[data-tactic-side="${s.tacticSide}"]`);return;}
  if(b.dataset.tacticMove!==undefined){if(s.run==='match'&&!s.coachWindow){toast('仅赛前、中场与战术暂停可调整。');return;}const i=Number(b.dataset.tacticMove),j=i+Number(b.dataset.direction),list=s[s.tacticSide];if(j>=0&&j<list.length){[list[i],list[j]]=[list[j],list[i]];refresh(`[data-tactic-move="${j}"][data-direction="${b.dataset.direction}"]`);}return;}
  if(b.dataset.sideIndex!==undefined){if(s.simulation==='live')R.setSide(s,Number(b.dataset.sideIndex),b.dataset.side);else{s.sides[Number(b.dataset.sideIndex)]=b.dataset.side;s.sideChosen??=[false,false,false];s.sideChosen[Number(b.dataset.sideIndex)]=true;}if(b.dataset.sideIndex==='1')s.side2Chosen=true;if(b.dataset.sideIndex==='2')s.side3Chosen=true;$('app-dialog').close();refresh();promptSide();return;}
  if(b.dataset.standing){s.bracket=b.dataset.standing==='bracket';refresh(`[data-standing="${b.dataset.standing}"]`);return;}
  if(b.dataset.resultMap!==undefined){s.reviewMap=Number(b.dataset.resultMap);go('campaign/map-result');return;}
  if(b.dataset.season){go('archive/season/'+b.dataset.season);return;}
  if(b.dataset.locked!==undefined){dialog('尚未解锁','<p class="dialog-copy">在征战开包中获得此卡后，可以在图鉴查看。</p>');return;}
  if(b.dataset.clearFilter){s[b.dataset.clearFilter]=b.dataset.clearFilter==='sort'?'default':'all';updateAlbum();save();return;}
  if(b.dataset.filterField){filterDraft[b.dataset.filterField]=b.dataset.filterValue;filterUI();$('filter-fields').querySelector(`[data-filter-field="${b.dataset.filterField}"][data-filter-value="${b.dataset.filterValue}"]`).focus();return;}
  if(b.id==='filter-entry'){filterDraft={tier:s.tier,region:s.region,sort:s.sort};filterUI();$('filter-dialog').showModal();return;}
  switch(b.dataset.action){
   case 'export-save':(async()=>{try{download(previewMode?JSON.stringify(CAREER_STORE.pack(s),null,2):await durable.exportRaw(),'val-manager-career.json');}catch(e){toast(e.message);}})();break;
   case 'export-draft':try{download(JSON.stringify(CAREER_STORE.pack(s),null,2),'val-manager-uncommitted.json');}catch(e){toast(e.message);}break;
   case 'export-legacy':(async()=>{try{const raw=await durable.legacyRaw();if(raw)download(raw,'val-manager-legacy-original.json');else toast('没有待迁移的旧档。');}catch(e){toast(e.message);}})();break;
   case 'import-save':importFile.click();break;
   case 'recover-save':(async()=>{try{if(previewMode)throw Error('预览没有正式存档恢复记录');reviewImport(JSON.stringify(await durable.previous()));}catch(e){toast(e.message);}})();break;
   case 'restore-save':restoreSave();break;
   case 'reload-save':location.reload();break;
   case 'leave-preview':leavePreview();break;
   case 'reselect-pack':s.chosenPack=null;s.lineup=[];go('campaign/packs');break;
   case 'auto-agents':s.agents[s.map]=recommendAgents();refresh();break;
   case 'settle-stage':go(R.settleStage(s,D.cards)===false?'campaign':'campaign/stage-result');break;
   case 'settle-skipped':if(!R.eligible(s)||(s.simulation==='live'&&!s.stageSession?.pending)){go(R.settleStage(s,D.cards)===false?'campaign':'campaign/stage-result');}break;
   case 'adjust-window':beginAdjust(s.coachWindow);break;
   case 'resume-window':s.coachWindow='';s.playing=true;refresh();break;
   case 'start-packs':if(s.run!=='none'&&s.run!=='finished'&&s.run!=='draft'){dialog('开始新的征战？','<p class="dialog-copy">当前演示阵容与比赛进度会被新的征战替换，图鉴与生涯展示保留。</p><div class="dialog-actions"><button class="quiet-button" data-action="close-dialog">保留当前</button><button class="blue-button" data-action="new-run">开始新的征战</button></div>');}else startPacks();break;
   case 'new-run':startPacks();break;
   case 'open-pack':if(s.opened[s.pack]===10)go('campaign/packs');else{R.reveal(s);go('campaign/reveal');}break;
   case 'next-pack':s.pack=s.opened.findIndex(n=>n<10);if(s.pack<0)s.pack=0;go('campaign/packs');break;
   case 'reveal-reinforcement':{if(s.run!=='reinforce'||s.reinforcementOpened>=10)break;const k=R.reveal(s,true);$('app-dialog').close();refresh();showCard(k,true);break;}
   case 'next-card':if(s.opened[s.pack]>=10)go('campaign/packs');else{R.reveal(s);refresh();}break;
   case 'compare-packs':go('campaign/compare');break;
   case 'choose-pack':if(s.run!=='draft'||!s.packs.length||!s.opened.every(n=>n===10))break;s.chosenPack=s.pack;s.lineup=[];go('campaign/pick');break;
   case 'confirm-lineup':{const error=validLineup(s.lineup);if(error)toast(error);else go('campaign/confirm');break;}
   case 'begin-year':{if(s.run!=='draft'||s.chosenPack===null)break;const error=validLineup(s.lineup);if(error){toast(error);break;}R.register(s,s.lineup,D.cards);s.run='active';s.phase=0;s.bp=[];s.map=0;s.round=0;s.agents={};s.completedMatch=false;if(s.simulation==='live'){R.prepareSeason(s);resetMatch();}go('campaign',true);break;}
   case 'bp-confirm':if(s.pendingMap&&!s.bp.includes(s.pendingMap))chooseBP(s.pendingMap);break;
 case 'bp-help':dialog('BO3 · 禁选顺序','<ol class="bp-order">'+['我方禁用','对方禁用','我方选图一 · 对方选边','对方选图二 · 我方选边','我方禁用','对方禁用','剩余图三 · 我方选边'].map((t,i)=>`<li><span>${i+1}</span><strong>${t}</strong></li>`).join('')+'</ol>');break;
   case 'bp-complete':if(s.bp.length!==7)break;if(R.pendingSide(s)!==undefined){promptSide();break;}s.map=0;s.reviewMap=null;go('campaign/agents');break;
   case 'agents-confirm':if(Object.keys(s.agents[s.map]||{}).length===5){if(s.map===0)go('campaign/tactics');else{s.run='match';R.resetMap(s);R.startMap?.(s);go('campaign/match');s.playing=true;refresh();}}break;
   case 'tactics-confirm':if(s.adjusting){s.adjusting='';s.adjustBackup=null;s.coachWindow='';go('campaign/match',true);s.playing=true;refresh();toast('战术已保存，继续比赛。');}else{if(s.run==='match'&&s.round>0){toast('当前不是战术调整窗口。');break;}s.run='match';R.resetMap(s);R.startMap?.(s);s.playing=true;s.completedMatch=false;go('campaign/match');s.playing=true;refresh();}break;
   
 case 'cancel-adjust':cancelAdjustment();break;
   case 'play-toggle':s.playing=!s.playing;refresh();break;
   case 'speed':s.speed=s.liveMaps?.[s.map]?.spatial?({.5:1,1:2,2:4,4:.5}[s.speed]||1):s.speed===1?2:s.speed===2?4:1;refresh('[data-action="speed"]');break;
   case 'next-round':{if(storageError)break;stopTimer();if(ROUND_PRESENTATION.advance(s,R,D.cards)){if(!R.spatialMap(s)&&s.round===12&&!s.halftimeSeen){s.halftimeSeen=true;s.coachWindow='half';R.adaptOpponent?.(s);}else if(!R.spatialMap(s)&&!R.mapOver(s)&&!s.coachWindow&&R.timeoutLeft(s,'opponent')>0&&R.shouldOpponentTimeout(s)){s.aiPaused=true;R.chargeTimeout(s,'opponent');}refresh();}break;}
   case 'watch-round':s.playing=false;s.fastForward=false;s.skippedReplay=null;s.watchedReplay=null;stopTimer();refresh();break;
   case 'skip-map':{if(s.coachWindow)break;if(s.simulation==='live'){s.fastForward=true;s.playing=true;refresh();break;}s.playing=false;stopTimer();const seq=R.rounds(s)[s.map];while(s.round<seq.length){R.roundGrowth(s,seq[s.round],D.cards);s.round++;}s.halftimeSeen=true;s.aiPaused=true;R.settleMap(s,D.cards);save();go('campaign/map-result');break;}
   case 'timeout':if(R.chargeTimeout(s)){s.playing=false;stopTimer();refresh();}break;
   case 'adjust-timeout':beginAdjust('timeout');break;
   
 case 'resume-half':$('app-dialog').close();refresh();break;
   case 'adjust-half':beginAdjust('half');break;
   case 'save-exit':s.playing=false;go('campaign',true);if(previewMode)toast('预览进度已保存。');else durable.flush().then(()=>{if(!storageError)toast('征战进度已保存。');});break;
   case 'next-map':if(!R.mapOver(s))break;if(s.simulation==='live'){if(R.seriesOver(s)){s.completedMatch=true;R.submitFormal(s);go('campaign/series-result');}else{s.map++;R.resetMap(s);go('campaign/agents');}break;}if(s.map<R.results(s).length-1){s.map++;R.resetMap(s);go('campaign/agents');}else{s.completedMatch=true;R.matchGrowth(s,D.cards,'formal',R.results(s).filter(r=>r.win).length===2,0);go('campaign/series-result');}break;
   case 'advance-stage':if(!s.stageRecords.some(r=>r.phase===s.phase))break;if(s.phase===7){go('campaign/year-result');}else if([1,4].includes(s.phase)){R.openReinforcement(s,CN_DRAW,Math.random);D.sync(s);go('campaign/reinforce',true);}else{s.phase++;R.rotate(s,s.phase,Math.random);resetMatch();go('campaign',true);}break;
   
 case 'retain-team':s.reinforce=[...s.roster];go('campaign/reinforce-review');break;
   case 'reinforce-review':{const error=validLineup(s.reinforce);if(error)toast(error);else go('campaign/reinforce-review');break;}
   case 'reinforce-confirm':{const error=validLineup(s.reinforce);if(error){toast(error);break;}R.register(s,s.reinforce,D.cards);s.reinforcementPack=[];s.reinforce=[];s.phase=Math.min(7,s.phase+1);R.rotate(s,s.phase,Math.random);resetMatch();go('campaign',true);toast('补强已确认，本次换人不可撤销。');break;}
   case 'finish-year':if(R.finish(s))go('archive/career',true);break;
   
 case 'card-face':showCard(parsed()[2]==='ZmjjKK-钻'?D.key(D.cards.find(p=>p.name==='ZmjjKK'&&p.tier==='钻')):parsed()[2]);break;
   case 'clear-filters':s.query='';s.tier='all';s.region='all';s.sort='default';refresh();break;
   case 'clear-team':s.teamQuery='';refresh();break;
   case 'rename':dialog('编辑昵称',`<form class="rename-form"><label for="coach-name">教练昵称</label><input id="coach-name" maxlength="16" value="${esc(s.coachName)}" autocomplete="off"><button class="blue-button full" data-action="save-name" type="button">保存昵称</button></form>`);break;
   case 'save-name':{const name=$('coach-name').value.trim();if(!name){$('coach-name').focus();toast('昵称不能为空。');break;}s.coachName=name;$('app-dialog').close();refresh();break;}
   case 'scene-menu':dialog('预览章节',`<p class="dialog-copy">章节预览在独立沙盒中运行；随时返回自己的征战，不覆盖进度。</p><div class="scene-list">${scenes.map(([id,label])=>`<button data-scene="${id}">${label}</button>`).join('')}</div><details class="plain-details"><summary>全部页面</summary><div class="page-list">${chapters.map(([r,label])=>`<button data-preview="${r}">${label}</button>`).join('')}</div></details>`);break;
   case 'reset-demo':dialog('恢复预览场景？','<p class="dialog-copy">恢复独立预览沙盒的展示状态，我的征战保持原样。</p><div class="dialog-actions"><button class="quiet-button" data-action="close-dialog">取消</button><button class="blue-button" data-scene="active">恢复预览</button></div>');break;
   case 'abandon-run':dialog('结束当前征战？','<p class="dialog-copy">当前阵容与未完成的进度会结束。已解锁卡片和已收录的生涯记录保留。</p><div class="dialog-actions"><button class="quiet-button" data-action="close-dialog">继续执教</button><button class="blue-button" data-action="confirm-abandon">结束征战</button></div>');break;
   case 'confirm-abandon':s.run='none';s.roster=[];s.lineup=[];s.reinforce=[];s.bp=[];s.playing=false;go('campaign',true);break;
   case 'install':if(installPrompt){installPrompt.prompt();installPrompt=null;}else dialog('安装到主屏幕','<p class="dialog-copy">在支持安装的浏览器菜单中选择“安装应用”或“添加到主屏幕”。离线资源准备完成后，可以离线浏览。</p>');break;
   case 'check-update':if(registration)PWA_UPDATE.check(registration,()=>toast('正在准备更新…')).then(status=>{if(status==='ready')dialog('发现更新','<p class="dialog-copy">更新会保留征战存档。</p><button class="blue-button full" data-action="apply-update">保存并更新</button>');else toast('已是当前版本。');}).catch(e=>toast(e.message));else toast('当前浏览器尚未启用离线服务。');break;
   case 'apply-update':remember();PWA_UPDATE.activate(registration,async()=>{await durable.flush();if(storageError)throw storageError;}).catch(e=>toast(e.message));break;
   case 'recover':go('archive/career',true);break;
   case 'close-dialog':$('app-dialog').close();break;
  }
 });
 function resetMatch(){if(s.simulation==='live')R.prepareStage(s);R.resetMatch(s);if(s.simulation!=='live'){s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;}}
 function cancelAdjustment(){if(s.adjustBackup){s.attack=[...s.adjustBackup.attack];s.defense=[...s.adjustBackup.defense];}s.adjusting='';s.adjustBackup=null;go('campaign/match',true);}
 function startPacks(){s.club=s.nextClub||s.club;s.nextClub=null;R.newRun(s,CN_CONTENT,CN_DRAW,Math.random);D.sync(s);s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;s.attack=[...D.tactics.attack];s.defense=[...D.tactics.defense];s.positions={};go('campaign/packs');}
 
 document.addEventListener('input',e=>{if(e.target.id==='album-query'){s.query=e.target.value;updateAlbum();save();}if(e.target.id==='team-query'){s.teamQuery=e.target.value;updateTeam();save();}});
 document.addEventListener('change',e=>{if(e.target.id==='team-sort'){s.teamSort=e.target.value;updateTeam();save();}if(e.target.id==='reduced-motion'){s.reducedMotion=e.target.checked;refresh();}if(e.target.id==='large-text'){s.largeText=e.target.checked;refresh();}});
 document.addEventListener('submit',e=>{e.preventDefault();document.activeElement?.blur();});
 $('filter-close').onclick=()=>$('filter-dialog').close();$('filter-reset').onclick=()=>{filterDraft={tier:'all',region:'all',sort:'default'};filterUI();};$('filter-apply').onclick=()=>{Object.assign(s,filterDraft);s.positions[path]=0;$('filter-dialog').close();updateAlbum();$('nav-scroll').scrollTop=0;save();$('filter-entry').focus({preventScroll:true});};
 $('page-back').onclick=back;$('dialog-close').onclick=()=>$('app-dialog').close();for(const id of ['app-dialog','filter-dialog'])$(id).addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();});
 $('nav-scroll').addEventListener('scroll',()=>{if(path)s.positions[path]=$('nav-scroll').scrollTop;},{passive:true});$('screen-size').onchange=e=>document.querySelector('.app-phone').classList.toggle('short',e.target.value==='small');
 window.addEventListener('hashchange',()=>{remember();stopTimer();s.playing=false;if(path==='campaign/tactics'&&s.adjusting&&parsed().join('/')==='campaign/match'){if(s.adjustBackup){s.attack=[...s.adjustBackup.attack];s.defense=[...s.adjustBackup.defense];}s.adjusting='';s.adjustBackup=null;}$('app-dialog').close();$('filter-dialog').close();render();});window.addEventListener('pagehide',()=>{s.playing=false;remember();stopTimer();});document.addEventListener('visibilitychange',()=>{if(document.hidden){s.playing=false;stopTimer();save();}});
 function updateConnection(){$('connection').hidden=navigator.onLine||previewMode;$('preview-banner').firstChild.textContent='独立章节预览'+(!navigator.onLine?' · 离线':'');}
 window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
 async function setupOffline(){if(testDatabase){$('cache-status').textContent='隔离验收页 · 离线安装请使用正式入口';return;}if(!('serviceWorker' in navigator)){ $('cache-status').textContent='当前浏览器不支持离线缓存';return;}try{registration=await navigator.serviceWorker.register('sw.js?v=20261009-mobile-2',{updateViaCache:'none'});await navigator.serviceWorker.ready;const urls=[...new Set(D.cards.flatMap(p=>[F.photo(p),F.asset(p.photo||'选手半身像/'+p.name+'.png','thumb'),F.asset('队伍logo/'+p.team+'.png'),...p.agents.map(a=>F.asset(p.agentAssets?.[a]||'英雄头像/'+a+'.png'))]).concat(D.clubs.map(c=>F.asset('队伍logo/'+c+'.png')),Object.keys(window.VM_IMAGE_MANIFEST?.assets||{}).filter(k=>k.startsWith('英雄头像/')).map(k=>F.asset(k)),D.allMaps.flatMap(m=>[F.asset('地图官方/'+m.id+'.webp'),F.asset('地图官方/'+m.id+'-poster.webp'),F.asset('地图官方/'+m.id+'-poster.webp','thumb'),F.asset('地图官方/'+m.id+'-plan.webp')])))].map(u=>new URL(u,location.href).href);const worker=registration.active||navigator.serviceWorker.controller;worker?.postMessage({type:'CACHE_ASSETS',urls});registration.addEventListener('updatefound',()=>{const w=registration.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)toast('发现更新，可在设置中安装。');});});}catch{$('cache-status').textContent='离线资源暂未准备完成，可在设置中重试';}}
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='CACHE_READY'){cacheReady=true;$('cache-status').textContent='离线资源已准备好 · '+e.data.count+' 项';if($('offline-setting'))$('offline-setting').textContent='已可离线浏览';}if(e.data?.type==='CACHE_ERROR')$('cache-status').textContent='部分资源未缓存，联网后可重试';});
 let controlled=!!navigator.serviceWorker?.controller;navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(controlled)location.reload();controlled=true;});
 const requested=new URLSearchParams(location.search),requestedScene=requested.get('scene'),requestedPage=requested.get('preview');
 if(scenes.some(([id])=>id===requestedScene)){setScene(requestedScene);if(requestedPage)previewPage(requestedPage);const clean=new URL(location.href);clean.searchParams.delete('scene');clean.searchParams.delete('preview');history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);}
 else{if(!location.hash)history.replaceState(null,'',routeURL(s.lastRoute||'campaign'));render();}setupOffline();if(storageError)showStorageError();
})();
