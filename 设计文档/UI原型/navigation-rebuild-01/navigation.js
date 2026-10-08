(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const asset=s=>'../../../素材库/'+encodeURI(s);
 const team=VISUAL_PLAYERS.map(p=>({...p,trait:NAV_TRAITS[p.name]}));
 const diamond={...cardSampleDiamond(),trait:'首杀机器',moment:'冥驹审判',event:'2023 · 东京大师赛'};
 const album=[...team,...PACK_EXTRA,diamond,...COLLECTION_EXTRA.map(p=>({...p,trait:NAV_TRAITS[p.name]}))];
 const key=p=>p.name+'-'+p.tier;
 const icons={team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87',campaign:'M5 21V3 M5 4h14l-4 5 4 5H5',archive:'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h4',cup:'M8 3h8v5a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6',search:'M21 21l-5-5 M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13'};
 const icon=id=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[id]}"/></svg>`;
 const titles={team:'战队',campaign:'征战',archive:'档案'};
 const phases=['启点赛','大师赛①','第一赛段常规赛','第一赛段季后赛','大师赛②','第二赛段常规赛','第二赛段季后赛','冠军赛'];
 const defaults={teamQuery:'',albumQuery:'',sort:'default',tier:'all',region:'all',albumSort:'default',archive:'album',positions:{}};
 let state={...defaults},route='',paneKey='',subpage='',profilePlayer=null;
 const viewState={calendarPast:false,roster:false,records:{},teamHelp:false,recordHelp:{}};
 let restoreFocusAction='';
 let restoreFocusSelector='';
 let filterDraft=null;
 const regionNames={CN:'中国',AMER:'美洲',EMEA:'欧洲中东非',PAC:'太平洋'};
 try{const saved=JSON.parse(sessionStorage.getItem('vm-nav-study')||'null');if(saved){for(const k of ['teamQuery','albumQuery'])if(typeof saved[k]==='string')state[k]=saved[k];if(['default','rating','AIM','SYN','SEN'].includes(saved.sort))state.sort=saved.sort;if(['all','金','银','铜','钻'].includes(saved.tier))state.tier=saved.tier;if(['all',...Object.keys(regionNames)].includes(saved.region))state.region=saved.region;if(['default','rating','name'].includes(saved.albumSort))state.albumSort=saved.albumSort;if(['album','career'].includes(saved.archive))state.archive=saved.archive;if(saved.positions&&typeof saved.positions==='object')state.positions=saved.positions;}}catch{}
 const save=()=>{try{sessionStorage.setItem('vm-nav-study',JSON.stringify(state));}catch{}};
 function remember(){if(paneKey)state.positions[paneKey]=$('nav-scroll').scrollTop;save();}
 function go(next,returnFocus=''){remember();if(location.hash==='#'+next)return;const from=location.hash.slice(1)||'campaign';history.pushState({navStudy:true,from,returnFocus},'', '#'+next);$('nav-dialog').close();$('filter-dialog').close();render();}
 function openDialog(title,body){$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('nav-dialog').showModal();}
 function versus(){return `<div class="versus"><div><img src="${asset('队伍logo/EDG.png')}" alt=""><strong>EDG</strong></div><span>VS</span><div><img src="${asset('队伍logo/BLG.png')}" alt=""><strong>BLG</strong></div></div>`;}
 function campaign(){return `<div class="campaign"><div class="run-heading"><span>第 01 赛年</span><b>待备战</b></div><section class="match-panel"><span class="phase-label">第一赛段</span><h3>常规赛</h3>${versus()}<span class="match-format">BO3</span></section><button class="blue-button" data-action="prepare">进入备战 <span aria-hidden="true">→</span></button><div class="overview-title"><h3>赛年进度</h3><button data-action="calendar">查看赛历 ↗</button></div><div class="stage-track" aria-label="八个阶段，当前第三阶段">${phases.map((p,i)=>`<span class="${i<2?'done':i===2?'current':''}" title="${p}"></span>`).join('')}</div><div class="next-stage"><span>当前 · 常规赛</span><span>03 / 08</span></div><div class="overview-title"><h3>战队</h3></div><button class="team-shortcut" data-go="team"><span class="avatar-stack">${team.slice(0,3).map(p=>`<img src="${asset('选手半身像/'+p.name+'.png')}" alt="">`).join('')}</span><span><strong>EDG</strong><small>5 名选手</small></span><b aria-hidden="true">→</b></button></div>`;}
 function calendarPage(){return `<div class="calendar-page"><div class="sub-kicker">第 01 赛年 <span>03 / 08</span></div><section class="current-phase"><span class="phase-status">当前阶段</span><h3>第一赛段常规赛</h3><div class="calendar-match"><span>EDG <i>vs</i> BLG</span><b>BO3</b></div></section><details class="past-phases" ${viewState.calendarPast?'open':''}><summary>已过阶段 <span>2</span></summary><ol>${phases.slice(0,2).map((p,i)=>`<li><b>0${i+1}</b><span>${p}</span><small>已结束</small></li>`).join('')}</ol></details><div class="section-caption">后续阶段</div><ol class="future-phases">${phases.slice(3).map((p,i)=>`<li><span class="phase-number">${String(i+4).padStart(2,'0')}</span><div><strong>${p}</strong><small>${[0,1,3,4].includes(i)?'资格待定':'未开始'}</small></div>${i===4?icon('cup'):''}</li>`).join('')}</ol></div>`;}
 function preparePage(){return `<div class="prepare-page"><div class="prep-context"><span>第一赛段 · 常规赛</span><b>BO3</b></div><section class="prep-match">${versus()}</section><details class="roster-disclosure" ${viewState.roster?'open':''}><summary><span class="avatar-stack">${team.slice(0,3).map(p=>`<img src="${asset('选手半身像/'+p.name+'.png')}" alt="">`).join('')}</span><span><strong>出战阵容</strong><small>5 名选手</small></span><span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="players-grid prep-roster">${team.map(p=>renderNavCard(p,key(p))).join('')}</div></details><div class="section-caption">赛前准备</div><section class="prep-current"><div class="step-icon">01</div><div><span class="phase-status">当前步骤</span><h3>地图 BP</h3><p>确定三张地图与攻防顺序</p></div></section><div class="prep-later"><span>02</span><div><strong>选择特工</strong><small>每张地图开赛前选择</small></div></div><div class="prep-later"><span>03</span><div><strong>战术布置</strong><small>安排执行优先级</small></div></div></div>`;}
 function returnToParent(){remember();const from=history.state?.navStudy?history.state.from:null;restoreFocusSelector=history.state?.returnFocus||'';restoreFocusAction=from==='campaign'&&['calendar','prepare'].includes(subpage)?subpage:'';if(from){history.back();}else{const fallback=route==='archive'?(subpage==='player'?'archive/album':'archive/career'):route==='team'?'team':'campaign';history.replaceState(null,'','#'+fallback);render();}}
 function search(value,label){return `<label class="players-search">${icon('search')}<input id="query" type="search" autocomplete="off" value="${esc(value)}" placeholder="${label}" aria-label="${label}"></label>`;}
 function teamPage(){return `<div class="team-summary"><button class="team-profile-entry" data-action="team-profile" aria-label="查看 EDG 战队资料"><img src="${asset('队伍logo/EDG.png')}" alt=""><div><h3>EDG</h3><small>本次征战</small></div><span>资料 →</span></button><span id="result-count">5 名选手</span></div><form class="players-tools" role="search">${search(state.teamQuery,'搜索选手')}<label class="players-sort"><span class="sr-only">排序方式</span><select id="sort">${[['default','默认排序'],['rating','总评 ↓'],['AIM','枪法 ↓'],['SYN','协同 ↓'],['SEN','意识 ↓']].map(([v,l])=>`<option value="${v}" ${state.sort===v?'selected':''}>${l}</option>`).join('')}</select></label></form><div class="players-grid" id="results"></div>`;}
 function archiveSwitch(){return `<div class="archive-switch" role="group" aria-label="档案内容"><button data-go="archive/album" aria-pressed="${state.archive==='album'}">图鉴</button><button data-go="archive/career" aria-pressed="${state.archive==='career'}">生涯</button></div>`;}
 function archivePage(){return archiveSwitch()+(state.archive==='album'?`<form class="archive-tools" role="search"><div class="archive-search-row">${search(state.albumQuery,'搜索选手或队伍')}<button type="button" class="filter-entry" id="filter-entry" aria-haspopup="dialog">筛选 <span id="filter-count"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16 M7 12h10 M10 18h4"/></svg></button></div><div class="archive-filter-summary"><div class="archive-count" id="result-count" aria-live="polite"></div><div id="filter-tags" class="filter-tags"></div></div></form><div class="players-grid" id="results"></div>`:career());}
 function albumResults(filters=state){
  const term=state.albumQuery.trim().toLowerCase();
  const list=album.filter(p=>`${p.name} ${p.team} ${p.agents.join(' ')}`.toLowerCase().includes(term)&&(filters.tier==='all'||p.tier===filters.tier)&&(filters.region==='all'||p.region===filters.region));
  if(filters.albumSort==='rating')list.sort((a,b)=>b.rating-a.rating);
  if(filters.albumSort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  return list;
 }
 function renderFilterDraft(){
  const groups=[['tier','品质',[['all','全部'],['铜','铜卡'],['银','银卡'],['金','金卡'],['钻','钻卡']]],['region','赛区',[['all','全部'],...Object.entries(regionNames)]],['albumSort','排序',[['default','默认'],['rating','总评优先'],['name','姓名']]]];
  $('filter-fields').innerHTML=groups.map(([field,title,options])=>`<fieldset><legend>${title}</legend><div class="filter-options">${options.map(([value,label])=>`<button type="button" data-filter-field="${field}" data-filter-value="${value}" aria-pressed="${filterDraft[field]===value}">${label}</button>`).join('')}</div></fieldset>`).join('');
  $('filter-apply').textContent='查看 '+albumResults(filterDraft).length+' 张';
 }
 function openFilters(){filterDraft={tier:state.tier,region:state.region,albumSort:state.albumSort};renderFilterDraft();$('filter-dialog').showModal();}
 function career(){return `<div class="career"><div class="coach-id"><div class="coach-symbol">${icon('cup')}</div><div><h3>执教档案</h3><p>第一个赛年</p></div></div><div class="career-run"><span>01</span><div><strong>当前征战</strong><small>第一赛段 · 进行中</small></div><button data-go="campaign">继续 →</button></div><div class="overview-title"><h3>赛年记录</h3></div><div class="career-empty">${icon('cup')}<strong>尚无完成的赛年</strong><p>完成征战后，在这里回顾成绩与荣誉。</p></div><div class="overview-title"><h3>执教积累</h3></div><button class="career-link" data-action="relationships">${icon('team')}选手关系<span>→</span></button><button class="career-link" data-action="honors">${icon('cup')}荣誉记录<span>→</span></button></div>`;}
 const reviews={campaign:['先看到下一步。','征战是默认落点，首屏围绕当前比赛组织。',[['主入口居中','当前对阵与进入备战占主要位置，不再先穿过大图或长地图。'],['赛历收起','首屏只留当前进度，完整八阶段按需查看。'],['战队作为捷径','看阵容进入左侧 Tab，避免在征战页重复摆满五张卡。']]],team:['五人队，直接查看。','名单先看卡面，队伍资料从上方入口查看。',[['卡面继续沿用','人物、特工、特性和三维保持原位置，所有品质外框一致。'],['工具保持一行','搜索和排序可操作，进入详情后返回原位置。'],['队伍资料集中查看','三维与下一场放入资料页；名单首屏保留人物面积。']]],archive:['收藏与经历，归于档案。','图鉴负责看卡，生涯负责看执教记录；共用一个底栏入口。',[['条件集中设置','品质、赛区、排序在同一面板中设置，预览数量后再应用。'],['取消不会改变列表','关闭面板保留原条件；已应用条件在列表上方可以单独移除。'],['分别记住位置','切到生涯再回来，图鉴的筛选与滚动位置保持。']]]};
 function render(){
  const path=location.hash.slice(1).split('/').map(part=>{try{return decodeURIComponent(part);}catch{return part;}});route=titles[path[0]]?path[0]:'campaign';
  profilePlayer=path[1]==='player'?album.find(p=>key(p)===path[2]):null;
  subpage=profilePlayer?'player':route==='campaign'&&['calendar','prepare'].includes(path[1])?path[1]:route==='team'&&path[1]==='overview'?'overview':route==='archive'&&['relationships','honors'].includes(path[1])?path[1]:'';
  if(route==='archive'&&['album','career'].includes(path[1]))state.archive=path[1];
  paneKey=subpage?route+'/'+subpage+(profilePlayer?'/'+key(profilePlayer):''):route==='archive'?state.archive:route;
  const hasDock=['calendar','prepare','player','overview'].includes(subpage);
  document.querySelector('.nav-phone').classList.toggle('in-subpage',!!subpage);
  document.querySelector('.nav-phone').classList.toggle('no-dock',!!subpage&&!hasDock);
  $('page-back').hidden=!subpage;
  $('page-back').setAttribute('aria-label','返回上一页');
  $('main-nav').hidden=!!subpage;
  $('subpage-dock').hidden=!hasDock;
  $('subpage-dock').innerHTML=subpage==='calendar'?'<button class="blue-button" data-go="campaign/prepare">查看当前对阵 →</button>':subpage==='prepare'?'<button class="blue-button" data-action="bp-order">查看 BP 顺序</button>':subpage==='player'?'<button class="blue-button" data-action="card-face">查看卡面</button>':subpage==='overview'?'<button class="blue-button" data-go="campaign/prepare">进入备战 →</button>':'';
  const detailTitles={calendar:'赛年赛历',prepare:'赛前备战',player:'选手资料',overview:'战队资料',relationships:'选手关系',honors:'荣誉记录'};
  $('page-title').textContent=detailTitles[subpage]||titles[route];
  $('main-nav').innerHTML=['team','campaign','archive'].map(r=>`<button data-go="${r==='archive'?'archive/'+state.archive:r}" class="${r==='campaign'?'core-nav':''}" ${route===r?'aria-current="page"':''}>${icon(r)}${titles[r]}</button>`).join('');
  $('page-body').innerHTML=subpage==='player'?NAV_PROFILE_UI.player(profilePlayer,album.filter(p=>p.name===profilePlayer.name)):subpage==='overview'?NAV_PROFILE_UI.team(team):['relationships','honors'].includes(subpage)?NAV_PROFILE_UI.records(subpage):subpage==='calendar'?calendarPage():subpage==='prepare'?preparePage():route==='campaign'?campaign():route==='team'?teamPage():archivePage();
  const subReviews={calendar:['当前阶段先被看到。','赛历改成独立页面，先看当前阶段，再决定是否展开过去的记录。',[['分层浏览','当前对阵突出，已过阶段可折叠，未来阶段保留次序与状态。'],['主操作明确','底部进入当前对阵，不需要滚回顶部找入口。'],['返回保留位置','详情不叠加成多层弹窗，回到征战时保留浏览位置。']]],prepare:['一屏只聚焦当前步骤。','缩小重复的对阵展示，把阵容查看与当前准备步骤放在同一页。',[['阵容按需查看','默认是摘要，展开后使用完整卡片；点卡看详情，关闭仍在原位置。'],['区分先后顺序','当前 BP 突出，后续选特工和战术作为顺序提示。'],['本批边界','支持查看 BP 顺序，实际禁选、特工选择和战术编辑在后续批次制作。']]]};
  Object.assign(subReviews,{player:['资料分层，卡面仍是主角。','先看人物、个人能力和特工，再按需展开记录。',[['卡面快速查看','列表点击仍放大卡面，进一步查看资料才进入独立页面。'],['切版本不加层','普通卡与钻卡切换后，返回仍回到原入口。'],['记录归属清楚','熟识属于同一选手；荣誉属于实际参赛的卡版本。本样例没有结算记录。']]],overview:['队伍资料，集中在一页。','三维、五人阵容和下一场各有明确位置。',[['队伍三维已更新','按最新定案使用羁绊、状态、熟练；76 / 82 / 68 只是固定布局样例。'],['说明按需展开','含义放在展开区，首屏先给数值和人物。'],['查看自然衔接','点人物进入资料，返回队伍原位置；底部进入备战。']]],relationships:['共事记录按选手查看。','当前先完成无记录状态及返回路径。',[['熟识跨版本共享','同名卡的熟识记录归于一个选手。'],['记录按需阅读','规则说明折叠，减少首屏文字。'],['本批状态','已结算记录的列表将在记录样例批次补齐。']]],honors:['荣誉保留具体归属。','当前没有赛年荣誉，先验证空态和查看层级。',[['具体卡版本','荣誉只记在实际参赛的卡版本。'],['离队保留历史','离队后保留此前已获得的荣誉。'],['返回原位置','回到生涯保持浏览位置和入口焦点。']]]});
  const review=subpage?subReviews[subpage]:reviews[route];$('review-title').textContent=review[0];$('review-description').textContent=review[1];$('review-points').innerHTML=review[2].map(([title,copy])=>`<li><strong>${title}</strong><p>${copy}</p></li>`).join('');
  if($('results'))updateResults();
  $('nav-scroll').scrollTop=Number(state.positions[paneKey])||0;save();
  if(restoreFocusSelector){document.querySelector(restoreFocusSelector)?.focus({preventScroll:true});restoreFocusSelector='';}
  else if(restoreFocusAction&&!subpage){document.querySelector(`[data-action="${restoreFocusAction}"]`)?.focus({preventScroll:true});restoreFocusAction='';}
  else if(subpage)$('page-title').focus({preventScroll:true});
  document.querySelector('.past-phases')?.addEventListener('toggle',e=>viewState.calendarPast=e.target.open);
  document.querySelector('.roster-disclosure')?.addEventListener('toggle',e=>viewState.roster=e.target.open);
  const recordDetail=document.querySelector('.profile-records');if(recordDetail){const recordKey=key(profilePlayer);recordDetail.open=!!viewState.records[recordKey];recordDetail.addEventListener('toggle',e=>viewState.records[recordKey]=e.target.open);}
  const teamHelp=document.querySelector('.team-metric-help');if(teamHelp){teamHelp.open=viewState.teamHelp;teamHelp.addEventListener('toggle',e=>viewState.teamHelp=e.target.open);}
  const recordHelp=document.querySelector('.record-scope');if(recordHelp){recordHelp.open=!!viewState.recordHelp[subpage];const recordKind=subpage;recordHelp.addEventListener('toggle',e=>viewState.recordHelp[recordKind]=e.target.open);}
 }
 function showCard(p,withProfile=true){openDialog(p.name,`<div class="players-grid detail-card-wrap">${renderNavCard(p,'detail').replace('<button ','<article ').replace('</button>','</article>')}</div>${p.tier==='钻'?`<div class="detail-traits"><span class="detail-trait-label">通用特性</span>${renderNavTrait(p)}</div>`:''}${withProfile?`<button class="blue-button dialog-profile-link" data-open-profile="${esc(key(p))}">选手资料 →</button>`:''}`);}
 function openProfile(playerKey,focus=''){go(route+'/player/'+playerKey,focus);}
 function updateResults(){
  const isTeam=route==='team',term=state.teamQuery.trim().toLowerCase();
  let list=isTeam?team.filter(p=>`${p.name} ${p.team} ${p.agents.join(' ')}`.toLowerCase().includes(term)):albumResults();
  if(isTeam&&state.sort!=='default')list.sort((a,b)=>b[state.sort]-a[state.sort]);
  $('results').dataset.sort=isTeam?state.sort:'default';
  $('results').innerHTML=list.length?list.map(p=>renderNavCard(p,key(p),isTeam?state.sort:'default')).join(''):'<div class="players-empty"><h3>没有匹配结果</h3><button data-action="clear">清除条件</button></div>';
  $('result-count').textContent=isTeam?list.length+' 名选手':'已解锁 · '+list.length+' 张';
  if(!isTeam){
   const tags=[];
   if(state.tier!=='all')tags.push(['tier',state.tier+'卡']);
   if(state.region!=='all')tags.push(['region',regionNames[state.region]]);
   if(state.albumSort!=='default')tags.push(['albumSort',state.albumSort==='rating'?'总评优先':'姓名']);
   $('filter-count').textContent=tags.length||'';
   $('filter-tags').innerHTML=tags.map(([field,label])=>`<button type="button" data-clear-filter="${field}" aria-label="移除${label}条件">${label}<span aria-hidden="true">×</span></button>`).join('');
  }
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='filter-entry'){openFilters();return;}
  if(button.dataset.openProfile){openProfile(button.dataset.openProfile,subpage==='overview'?`[data-open-profile="${button.dataset.openProfile}"]`:`[data-player="${button.dataset.openProfile}"]`);return;}
  if(button.dataset.version){const next=album.find(p=>key(p)===button.dataset.version&&p.name===profilePlayer?.name);if(next){remember();const nextPath=route+'/player/'+key(next);state.positions[nextPath]=0;history.replaceState(history.state,'','#'+nextPath);render();document.querySelector(`[data-version="${key(next)}"]`)?.focus({preventScroll:true});}return;}
  if(button.dataset.clearFilter){state[button.dataset.clearFilter]=button.dataset.clearFilter==='albumSort'?'default':'all';updateResults();save();return;}
  if(button.dataset.go){go(button.dataset.go);return;}
  if(button.dataset.player){const p=album.find(p=>key(p)===button.dataset.player);if(p)showCard(p);return;}
  switch(button.dataset.action){
   case 'calendar':go('campaign/calendar');break;
   case 'prepare':go('campaign/prepare');break;
   case 'team-profile':go('team/overview','[data-action="team-profile"]');break;
   case 'card-face':if(profilePlayer)showCard(profilePlayer,false);break;
   case 'bp-order':openDialog('BO3 · BP 顺序',`<p class="dialog-copy">A / B 代表选图顺序。</p><ol class="bp-order">${[['A','禁用地图'],['B','禁用地图'],['A','选择图一','B 选边'],['B','选择图二','A 选边'],['A','禁用地图'],['B','禁用地图'],['','剩余地图为图三','A 选边']].map(([side,label,note],i)=>`<li><span>${i+1}</span><b class="${side==='B'?'side-b':''}">${side||'—'}</b><div><strong>${label}</strong>${note?`<small>${note}</small>`:''}</div></li>`).join('')}</ol>`);break;
   case 'relationships':go('archive/relationships','[data-action="relationships"]');break;
   case 'honors':go('archive/honors','[data-action="honors"]');break;
   case 'clear':if(route==='team')state.teamQuery='';else{state.albumQuery='';state.tier='all';state.region='all';state.albumSort='default';}state.positions[paneKey]=0;render();$('query')?.focus();break;
  }
 });
 document.addEventListener('input',event=>{if(event.target.id!=='query')return;state[route==='team'?'teamQuery':'albumQuery']=event.target.value;updateResults();state.positions[paneKey]=0;save();});
 document.addEventListener('change',event=>{if(!['sort','tier'].includes(event.target.id))return;state[event.target.id]=event.target.value;updateResults();save();});
 document.addEventListener('submit',event=>{event.preventDefault();$('query')?.blur();});
 $('filter-dialog').addEventListener('click',event=>{
  const button=event.target.closest('[data-filter-field]');
  if(button){const field=button.dataset.filterField,value=button.dataset.filterValue;filterDraft[field]=value;renderFilterDraft();$('filter-fields').querySelector(`[data-filter-field="${field}"][data-filter-value="${value}"]`).focus();}
 });
 $('filter-close').onclick=()=>$('filter-dialog').close();
 $('filter-reset').onclick=()=>{filterDraft={tier:'all',region:'all',albumSort:'default'};renderFilterDraft();};
 $('filter-apply').onclick=()=>{Object.assign(state,filterDraft);state.positions.album=0;save();$('filter-dialog').close();updateResults();$('nav-scroll').scrollTop=0;$('filter-entry').focus({preventScroll:true});};
 $('page-back').onclick=returnToParent;
 $('dialog-close').onclick=()=>$('nav-dialog').close();
 $('nav-dialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();});
 $('nav-scroll').addEventListener('scroll',remember,{passive:true});
 window.addEventListener('hashchange',()=>{remember();$('nav-dialog').close();$('filter-dialog').close();render();});window.addEventListener('pagehide',remember);
 $('screen-size').addEventListener('change',event=>document.querySelector('.nav-phone').classList.toggle('short',event.target.value==='small'));
 render();
})();
