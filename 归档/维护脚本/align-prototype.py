from pathlib import Path
p = Path('设计文档/UI原型/complete-prototype-01')
app = (p/'app.js').read_text(encoding='utf-8')
def replace(a,b):
 global app
 assert a in app, a[:90]
 app=app.replace(a,b)
def fn(start,end,new):
 global app
 a=app.index(start); b=app.index(end,a); app=app[:a]+new+'\n '+app[b:]
replace("STORE='vm-complete-ui-v1'", "STORE='vm-complete-ui-v2',PREVIEW_STORE='vm-complete-ui-v2-preview',R=PROTOTYPE_RULES")
replace("let s=D.seed(),path", "let previewMode=false; let s=D.seed(),path")
replace("stored?.version===1", "stored?.version===2")
replace(" s.playing=false;\n const save", " R.init(s);D.sync(s);s.playing=false;\n const save")
replace("localStorage.setItem(STORE,JSON.stringify", "localStorage.setItem(previewMode?PREVIEW_STORE:STORE,JSON.stringify")
fn('function setScene(scene)', 'const chapters=', '''function enterPreview(){if(!previewMode){save();previewMode=true;}}
 function setScene(scene){enterPreview();stopTimer();const settings={coachName:s.coachName,reducedMotion:s.reducedMotion,largeText:s.largeText};s={...D.seed(),...settings};disclosures={};
 if(scene!=='fresh'){R.newRun(s,CN_CONTENT,CN_DRAW,Math.random);s.packs[0]=[...D.demoRoster(),...s.packs[0].filter(k=>!D.demoRoster().includes(k))].slice(0,10);s.unlocked=[...new Set([...s.unlocked,...s.packs[0]])];D.sync(s);R.register(s,D.demoRoster(),D.cards);s.run='active';s.chosenPack=0;s.lineup=[...s.roster];s.phase=2;}
 if(scene==='empty'){s.history=false;s.seasons=[];}
 if(scene==='reinforce'){s.phase=1;R.openReinforcement(s,CN_DRAW,Math.random);}
 if(scene==='loss'||scene==='sweep'){s.resultMode=scene;s.phase=3;s.map=1;s.bp=seededBP();s.round=R.rounds(s)[1].length;s.completedMatch=true;s.run='match';if(scene==='loss')s.qualificationOverrides={4:false};for(let i=0;i<=s.map;i++){const old=s.map;s.map=i;s.round=R.rounds(s)[i].length;R.settleMap(s,D.cards);s.map=old;}R.matchGrowth(s,D.cards,'formal',scene==='sweep',0);}
 if(scene==='miss-world'){s.scenario='miss-world';s.phase=1;}
 if(scene==='miss-playoffs'){s.scenario='miss-playoffs';s.phase=3;}
 if(scene==='overtime'){s.scenario='overtime';s.phase=0;s.bp=seededBP();s.run='match';s.round=24;s.halftimeSeen=true;}
 if(scene==='records'||scene==='ended'){s.phase=1;s.completedMatch=true;R.settleStage(s,D.cards);s.phase=7;s.completedMatch=true;R.settleStage(s,D.cards);R.finish(s);}
 save();go(scene==='loss'||scene==='sweep'?'campaign/series-result':scene==='records'||scene==='empty'?'archive/career':scene==='reinforce'?'campaign/reinforce':scene==='overtime'?'campaign/match':'campaign',true);}
 function leavePreview(){stopTimer();previewMode=false;try{s=JSON.parse(localStorage.getItem(STORE))||D.seed();}catch{s=D.seed();}R.init(s);D.sync(s);s.playing=false;go(s.lastRoute||'campaign',true);}
 ''')
replace("['sweep','两图获胜']", "['sweep','两图获胜'],['miss-world','未晋级世界赛'],['miss-playoffs','未晋级季后赛'],['overtime','加时与暂停']")
replace("A.mapDetail(id)","A.mapDetail(id,s)")
fn('// Direct links are viewable',"if(s.run==='draft'", """D.sync(s);
  $('preview-banner').hidden=!previewMode;
  const sub=parts[1],draft=['packs','reveal','compare','pick','confirm'],matchPages=['prepare','bp','agents','tactics','match','map-result','series-result','stage-result'];
  let blocked='';
  if(parts[0]==='campaign'&&draft.includes(sub)&&(s.run!=='draft'||!s.packs.length))blocked='请先选择主队并开启本次三个包。';
  if(parts[0]==='campaign'&&['pick','confirm'].includes(sub)&&s.chosenPack===null)blocked='请先选定一个完整卡包。';
  if(sub==='confirm'&&s.lineup.length!==5)blocked='请先从选定卡包选择五位队员。';
  if(parts[0]==='campaign'&&matchPages.includes(sub)&&(!s.roster.length||!['active','match'].includes(s.run)))blocked='当前没有可进行的正式比赛。';
  if(parts[0]==='campaign'&&['prepare','bp','agents','tactics','match'].includes(sub)&&!R.eligible(s))blocked='本阶段未晋级，请先结算赛历。';
  if(['agents','tactics','match','map-result','series-result'].includes(sub)&&s.bp.length!==7)blocked='请先完成地图 BP。';
  if(sub==='map-result'&&s.reviewMap===null&&s.round<R.rounds(s)[s.map].length)blocked='本图尚未结束。';
  if(sub==='series-result'&&!s.completedMatch)blocked='本场 BO3 尚未结束。';
  if(sub==='stage-result'&&!s.stageRecords.some(r=>r.phase===s.phase))blocked='本阶段尚未结算。';
  if(['reinforce','reinforce-review'].includes(sub)&&s.run!=='reinforce')blocked='当前没有补强窗口。';
  if(sub==='year-result'&&(s.phase!==7||!s.stageRecords.some(r=>r.phase===7)))blocked='本赛年尚未结束。';
  """)
replace("view=currentView(parts);", "view=blocked?{title:'继续当前征战',body:F.empty('当前步骤尚未开放',blocked),dock:'返回征战',go:'campaign'}:currentView(parts);")
replace("['AMER','美洲'],['EMEA','欧洲中东非'],['PAC','太平洋']", "")
fn('function validLineup(list)', 'function selectPlayer', "function validLineup(list){return R.validate(list,D.cards,s.run==='reinforce'?[...s.roster,...s.reinforcementPack]:s.packs[s.chosenPack]);}")
replace("const list=s[field];if(list.includes(k))", "const list=s[field],allowed=field==='reinforce'&&s.run==='reinforce'?[...s.roster,...s.reinforcementPack]:field==='lineup'&&s.run==='draft'?s.packs[s.chosenPack]:[];if(!card(k)||!allowed?.includes(k)){toast('该卡不在本次候选范围。');return;}if(list.includes(k))")
fn('function advanceRound()', 'function beginAdjust', '''function advanceRound(){if(s.coachWindow||s.adjusting)return;if(s.round>=R.rounds(s)[s.map].length){s.playing=false;refresh();return;}const win=R.rounds(s)[s.map][s.round];s.round++;R.roundGrowth(s,win,D.cards);R.settleMap(s,D.cards);
 if(s.round===12&&!s.halftimeSeen){s.halftimeSeen=true;s.playing=false;s.coachWindow='half';}
 else if(s.round===8&&!s.aiPaused){s.aiPaused=true;R.chargeTimeout(s,'opponent');s.playing=false;}
 if(s.round===R.rounds(s)[s.map].length)s.playing=false;refresh();}
 ''')
replace("function beginAdjust(kind){stopTimer();", "function beginAdjust(kind){if(!s.coachWindow)return;stopTimer();")
replace("return ['icebox','bind','ascent','haven','pearl','sunset','lotus'];", "return [...s.activeMaps];")
fn('function previewPage(r)', 'function chooseBP', '''function previewPage(r){if(!chapters.some(([route])=>route===r))return;setScene(r.includes('reinforce')?'reinforce':r.includes('year-result')?'ended':r.includes('series-result')?'sweep':r.includes('season')?'records':r==='campaign/start'?'fresh':'active');
 if(['campaign/packs','campaign/reveal','campaign/compare','campaign/pick','campaign/confirm'].includes(r)){s.run='draft';s.chosenPack=r.endsWith('pick')||r.endsWith('confirm')?0:null;s.lineup=r.endsWith('confirm')?D.demoRoster():[];}
 if(['campaign/agents','campaign/tactics','campaign/match','campaign/map-result'].includes(r)){s.bp=seededBP();s.run='match';s.map=0;s.round=r.endsWith('map-result')?R.rounds(s)[0].length:0;s.agents={0:recommendAgents()};}
 if(r==='campaign/stage-result'){s.completedMatch=true;R.settleStage(s,D.cards);}
 if(r==='archive/player/ZmjjKK-钻')r='archive/player/'+D.key(D.cards.find(p=>p.name==='ZmjjKK'&&p.tier==='钻'));
 go(r);}
 function recommendAgents(){const people=F.lineup(s),out={};const solve=i=>{if(i===people.length)return true;const p=people[i];for(const a of [...p.agents,...CN_CONTENT.agents]){if(Object.values(out).includes(a))continue;out[D.key(p)]=a;if(solve(i+1))return true;delete out[D.key(p)];}return false;};solve(0);return out;}
 ''')
fn('function chooseBP(id)', "document.addEventListener('click'", '''function chooseBP(id){if(s.bp.includes(id)||!s.activeMaps.includes(id)||s.bp.length>=7)return;s.bp.push(id);s.pendingMap='';while([1,3,5].includes(s.bp.length)){const next=s.activeMaps.find(id=>!s.bp.includes(id));s.bp.push(next);}if(s.bp.length===6)s.bp.push(s.activeMaps.find(id=>!s.bp.includes(id)));refresh();
 if(s.bp.length>=4&&!s.side2Chosen){dialog('图二 · 选择开局攻防','<p class="dialog-copy">对方选择图二，我方选择进攻或防守开局。</p><div class="side-choice"><button data-side-index="1" data-side="attack">进攻开局</button><button data-side-index="1" data-side="defense">防守开局</button></div>');}
 else if(s.bp.length===7&&!s.side3Chosen)chooseDeciderSide();}
 function chooseDeciderSide(){dialog('图三 · 选择开局攻防','<p class="dialog-copy">剩余图为决胜图；本原型示例由我方选择开局边，正式选边资格由赛事配置提供。</p><div class="side-choice"><button data-side-index="2" data-side="attack">进攻开局</button><button data-side-index="2" data-side="defense">防守开局</button></div>');}
 ''')
replace("if(b.dataset.pack!==undefined){s.pack", "if(b.dataset.pack!==undefined){if(s.chosenPack!==null){toast('整包已锁定，请先重新选择整包。');return;}s.pack")
replace("const field=s.agents[s.map]", "if(!s.roster.includes(b.dataset.agentPlayer)||!CN_CONTENT.agents.includes(b.dataset.agent)){toast('当前阵容或特工不合法。');return;}const field=s.agents[s.map]")
replace("if(b.dataset.tacticMove!==undefined){const i", "if(b.dataset.tacticMove!==undefined){if(s.run==='match'&&!s.coachWindow){toast('仅赛前、中场与战术暂停可调整。');return;}const i")
replace("s.sides[Number(b.dataset.sideIndex)]=b.dataset.side;$('app-dialog').close();refresh();", "s.sides[Number(b.dataset.sideIndex)]=b.dataset.side;if(b.dataset.sideIndex==='1')s.side2Chosen=true;if(b.dataset.sideIndex==='2')s.side3Chosen=true;$('app-dialog').close();refresh();if(s.bp.length===7&&!s.side3Chosen)chooseDeciderSide();")
replace("s.map=Number(b.dataset.resultMap);", "s.reviewMap=Number(b.dataset.resultMap);")
replace("switch(b.dataset.action){", """switch(b.dataset.action){
   case 'leave-preview':leavePreview();break;
   case 'reselect-pack':s.chosenPack=null;s.lineup=[];go('campaign/packs');break;
   case 'auto-agents':s.agents[s.map]=recommendAgents();refresh();break;
   case 'settle-stage':R.settleStage(s,D.cards);go('campaign/stage-result');break;
   case 'settle-skipped':if(!R.eligible(s)){R.settleStage(s,D.cards);go('campaign/stage-result');}break;
   case 'adjust-window':beginAdjust(s.coachWindow);break;
   case 'resume-window':s.coachWindow='';s.playing=true;refresh();break;""")
replace("case 'choose-pack':s.lineup=[];go('campaign/pick');", "case 'choose-pack':if(s.run!=='draft'||!s.packs.length)break;s.chosenPack=s.pack;s.lineup=[];go('campaign/pick');")
replace("s.roster=[...s.lineup];s.run='active';", "R.register(s,s.lineup,D.cards);s.run='active';")
fn("case 'bp-confirm':", "case 'bp-help':", "case 'bp-confirm':if(s.pendingMap&&!s.bp.includes(s.pendingMap))chooseBP(s.pendingMap);break;")
replace("case 'bp-complete':s.map=0;", "case 'bp-complete':if(s.bp.length!==7)break;s.map=0;s.reviewMap=null;")
fn("case 'tactics-confirm':", "case 'cancel-adjust':", """case 'tactics-confirm':if(s.adjusting){s.adjusting='';s.adjustBackup=null;s.coachWindow='';go('campaign/match',true);s.playing=true;refresh();toast('战术已保存，继续比赛。');}else{if(s.run==='match'&&s.round>0){toast('当前不是战术调整窗口。');break;}s.run='match';R.resetMap(s);s.playing=true;s.completedMatch=false;go('campaign/match');s.playing=true;refresh();}break;
   """)
fn("case 'skip-map':", "case 'resume-half':", """case 'skip-map':{s.playing=false;stopTimer();const seq=R.rounds(s)[s.map];while(s.round<seq.length){R.roundGrowth(s,seq[s.round],D.cards);s.round++;}s.halftimeSeen=true;s.aiPaused=true;R.settleMap(s,D.cards);save();go('campaign/map-result');break;}
   case 'timeout':if(R.chargeTimeout(s)){s.playing=false;stopTimer();refresh();}break;
   case 'adjust-timeout':beginAdjust('timeout');break;
   """)
fn("case 'next-map':", "case 'retain-team':", """case 'next-map':if(s.round<R.rounds(s)[s.map].length)break;if(s.map<R.results(s).length-1){s.map++;R.resetMap(s);go('campaign/agents');}else{s.completedMatch=true;R.matchGrowth(s,D.cards,'formal',R.results(s).filter(r=>r.win).length===2,0);go('campaign/series-result');}break;
   case 'advance-stage':if(!s.stageRecords.some(r=>r.phase===s.phase))break;if(s.phase===7){go('campaign/year-result');}else if([1,4].includes(s.phase)){R.openReinforcement(s,CN_DRAW,Math.random);D.sync(s);go('campaign/reinforce',true);}else{s.phase++;R.rotate(s,s.phase,Math.random);resetMatch();go('campaign',true);}break;
   """)
replace("s.roster=[...s.reinforce];s.phase", "R.register(s,s.reinforce,D.cards);s.reinforcementPack=[];s.reinforce=[];s.phase")
replace("resetMatch();go('campaign',true);toast('新阵容已确认。');", "R.rotate(s,s.phase,Math.random);resetMatch();go('campaign',true);toast('补强已确认，本次换人不可撤销。');")
fn("case 'finish-year':", "case 'card-face':", "case 'finish-year':if(R.finish(s))go('archive/career',true);break;\n   ")
replace("showCard(parsed()[2]);", "showCard(parsed()[2]==='ZmjjKK-钻'?D.key(D.cards.find(p=>p.name==='ZmjjKK'&&p.tier==='钻')):parsed()[2]);")
replace("切换会替换当前本机演示进度。", "章节预览在独立沙盒中运行；随时返回自己的征战，不覆盖进度。")
fn('function resetMatch()', 'function cancelAdjustment()', "function resetMatch(){R.resetMatch(s);s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;}")
replace("s.adjusting='';s.adjustBackup=null;go('campaign/match',true);", "s.adjusting='';s.adjustBackup=null;go('campaign/match',true);")
fn('function startPacks()', "document.addEventListener('input'", """function startPacks(){s.club=s.nextClub||s.club;s.nextClub=null;R.newRun(s,CN_CONTENT,CN_DRAW,Math.random);D.sync(s);s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;s.attack=[...D.tactics.attack];s.defense=[...D.tactics.defense];s.positions={};go('campaign/packs');}
 """)
(p/'app.js').write_text(app,encoding='utf-8')
index=(p/'index.html').read_text(encoding='utf-8')
index=index.replace('VAL MANAGER · 完整交互原型','VAL MANAGER · 征战前端定稿')
index=index.replace('<div class="balance-scroll"','<div id="preview-banner" class="preview-banner" hidden>独立章节预览<button data-action="leave-preview">返回我的征战 →</button></div><div class="balance-scroll"')
index=index.replace('全部比赛、赛果、开包与历史为固定演示；选择只改变本机原型状态，未接玩法引擎。','开包使用现有 CN 卡池与概率；比赛赛果、晋级和成长为界面样例，2D 为布局示意，未接正式引擎。右侧预览独立运行，不覆盖你的征战。')
index=index.replace('一套可以走完的界面。','这一年，由你执教。').replace('先完整体验，再调整局部。','组队、BP、临场调整与赛年积累，贯穿同一次征战。')
index=index.replace('<script src="flow-view.js">','<script src="content-snapshot.js"></script><script src="prototype-rules.js"></script><script src="aligned-data.js"></script><script src="flow-view.js">')
index=index.replace('<script src="app.js">','<script src="aligned-views.js"></script><script src="app.js">')
(p/'index.html').write_text(index,encoding='utf-8')
profile=(p/'profile-view.js').read_text(encoding='utf-8').replace("const key=p=>p.name+'-'+p.tier;","const key=p=>DEMO.key(p);")
profile=profile.replace("v.tier==='钻'?'东京 · 钻卡':v.tier+'卡'", "v.tier==='钻'?v.cut+' · 钻卡':v.tier+'卡'")
(p/'profile-view.js').write_text(profile,encoding='utf-8')
sw=(p/'sw.js').read_text(encoding='utf-8').replace('vm-ui-complete-v1','vm-ui-complete-v2').replace("'app.js',","'app.js','content-snapshot.js','prototype-rules.js','aligned-data.js','aligned-views.js',")
(p/'sw.js').write_text(sw,encoding='utf-8')
