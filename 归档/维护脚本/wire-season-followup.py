from pathlib import Path
root=Path(__file__).resolve().parents[2]
ui=root/'设计文档/UI原型/complete-prototype-01'
def edit(file,changes):
 p=file if isinstance(file,Path) else ui/file
 s=p.read_text(encoding='utf-8')
 for a,b in changes:
  if a not in s: raise ValueError(f'Missing patch in {p}: {a[:100]}')
  s=s.replace(a,b)
 p.write_text(s,encoding='utf-8')
edit('app.js',[
 ("STORE='vm-complete-ui-v2',PREVIEW_STORE='vm-complete-ui-v2-preview'","STORE='vm-complete-ui-v3',PREVIEW_STORE='vm-complete-ui-v3-preview'"),
 ("s.opened=[10,10,10];s.unlocked", "s.simulation='fixture';s.opened=[10,10,10];s.unlocked"),
 ("if(sub==='map-result'&&s.reviewMap===null&&s.round<R.rounds(s)[s.map].length)","if(sub==='map-result'&&s.reviewMap===null&&!R.mapOver(s))"),
 ("blocked='本场 BO3 尚未结束。'","blocked='本场系列赛尚未结束。'"),
 ("s.coachWindow?10000:5000/s.speed", "s.coachWindow?10000:s.fastForward?40:5000/s.speed"),
 ("if(s.round>=R.rounds(s)[s.map].length){s.playing=false;refresh();return;}const win=R.rounds(s)[s.map][s.round];s.round++;R.roundGrowth(s,win,D.cards);R.settleMap(s,D.cards);", "if(R.mapOver(s)){s.playing=false;refresh();return;}if(s.simulation==='live')R.stepRound(s);else{const win=R.rounds(s)[s.map][s.round];s.round++;R.roundGrowth(s,win,D.cards);R.settleMap(s,D.cards);}"),
 ("s.halftimeSeen=true;s.coachWindow='half';", "s.halftimeSeen=true;s.coachWindow='half';R.adaptOpponent?.(s);"),
 ("else if(s.round===8&&!s.aiPaused){s.aiPaused=true;R.chargeTimeout(s,'opponent');}", "else if(!R.mapOver(s)&&!s.coachWindow&&R.timeoutLeft(s,'opponent')>0&&((s.round===8&&!s.aiPaused)||(s.simulation==='live'&&s.round===18&&R.score(s)[1]<R.score(s)[0])||(s.simulation==='live'&&s.round===26))){s.aiPaused=true;R.chargeTimeout(s,'opponent');}"),
 ("if(s.round===R.rounds(s)[s.map].length)s.playing=false;refresh();", "if(R.mapOver(s)){s.playing=false;s.fastForward=false;}if(s.coachWindow)s.playing=false;refresh();"),
 ("s.bp.push(id);s.pendingMap='';R.fillOpponentBP(s);", "if(s.simulation==='live')R.bpMove(s,id);else{s.bp.push(id);R.fillOpponentBP(s);}s.pendingMap='';"),
 ("按 BO3 顺序，本图由我方选择开局方向。", "按 BO${s.bestOf||3} 顺序，本图由我方选择开局方向。"),
 ("s.bpRole=b.dataset.bpRole;s.sideChosen=[false,false,false];R.fillOpponentBP(s);", "if(s.simulation==='live')R.chooseBPRole(s,b.dataset.bpRole);else{s.bpRole=b.dataset.bpRole;s.sideChosen=[false,false,false];R.fillOpponentBP(s);}"),
 ("s.sides[Number(b.dataset.sideIndex)]=b.dataset.side;s.sideChosen??=[false,false,false];s.sideChosen[Number(b.dataset.sideIndex)]=true;", "if(s.simulation==='live')R.setSide(s,Number(b.dataset.sideIndex),b.dataset.side);else{s.sides[Number(b.dataset.sideIndex)]=b.dataset.side;s.sideChosen??=[false,false,false];s.sideChosen[Number(b.dataset.sideIndex)]=true;}"),
 ("case 'settle-stage':R.settleStage(s,D.cards);go('campaign/stage-result');break;", "case 'settle-stage':go(R.settleStage(s,D.cards)===false?'campaign':'campaign/stage-result');break;"),
 ("case 'settle-skipped':if(!R.eligible(s)){", "case 'settle-skipped':if(!R.eligible(s)||(s.simulation==='live'&&!s.stageSession?.pending)){"),
 ("s.completedMatch=false;go('campaign',true);break;}", "s.completedMatch=false;if(s.simulation==='live'){R.prepareSeason(s);resetMatch();}go('campaign',true);break;}"),
 ("R.resetMap(s);go('campaign/match');s.playing", "R.resetMap(s);R.startMap?.(s);go('campaign/match');s.playing"),
 ("R.resetMap(s);s.playing=true;s.completedMatch", "R.resetMap(s);R.startMap?.(s);s.playing=true;s.completedMatch"),
 ("case 'skip-map':{s.playing=false;stopTimer();const seq", "case 'skip-map':{if(s.coachWindow)break;if(s.simulation==='live'){s.fastForward=true;s.playing=true;refresh();break;}s.playing=false;stopTimer();const seq"),
 ("case 'next-map':if(s.round<R.rounds(s)[s.map].length)break;", "case 'next-map':if(!R.mapOver(s))break;if(s.simulation==='live'){if(R.seriesOver(s)){s.completedMatch=true;R.submitFormal(s);go('campaign/series-result');}else{s.map++;R.resetMap(s);go('campaign/agents');}break;}"),
 ("function resetMatch(){R.resetMatch(s);s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;}", "function resetMatch(){if(s.simulation==='live')R.prepareStage(s);R.resetMatch(s);if(s.simulation!=='live'){s.sides=['defense','attack','attack'];s.side2Chosen=false;s.side3Chosen=false;}}"),
 (".concat(D.clubs.map(c=>F.asset('队伍logo/'+c+'.png')))",".concat(D.clubs.map(c=>F.asset('队伍logo/'+c+'.png')),D.allMaps.map(m=>F.asset('地图官方/'+m.id+'.webp')))")
])
edit('index.html',[
 ('<script src="prototype-rules.js', '<script src="../../../游戏/tournament.js?v=20261004-season-1"></script><script src="../../../游戏/season-2026.js?v=20261004-season-1"></script><script src="prototype-rules.js'),
 ('<script src="flow-view.js">', '<script src="runtime-model.js?v=20261004-season-1"></script><script src="flow-view.js">'),
 ('<script src="app.js?v=', '<script src="runtime-views.js?v=20261004-season-1"></script><script src="app.js?v='),
 ('比赛赛果、晋级和成长为界面样例，2D 为布局示意，未接正式引擎。','新征战接入赛果、签表、晋级与积分模拟；地图采用官方实景。精确空间推演尚未接入。')
])
edit('sw.js',[("'followup-views.js',", "'followup-views.js','runtime-model.js','runtime-views.js','../../../游戏/tournament.js','../../../游戏/season-2026.js',")])
edit('followup-views.js',[("v.body=v.body.replace('id=\"album-results\"','class=\"thumb-grid album-thumb-grid\" id=\"album-results\"');", "v.body=v.body.replace(/class=\"[^\"]*\" id=\"album-results\"/,'class=\"thumb-grid album-thumb-grid\" id=\"album-results\"');")])
edit(root/'游戏/season-2026.js',[
 ('out.swiss.eliminated.slice(0,2),out.swiss.eliminated.slice(2)', "out.swiss.eliminated.filter(t=>out.swiss.records[t].w===1),out.swiss.eliminated.filter(t=>out.swiss.records[t].w===0)"),
 ('out.gsl.eliminated.slice(0,4),out.gsl.eliminated.slice(4)', 'out.gsl.third,out.gsl.fourth'),
 ("session.phase===0&&node.bestOf===5?5:3", "3")
])
edit(root/'游戏/tournament.js',[
 ('const games=[],qualified=[],eliminated=[];groups.forEach', 'const games=[],qualified=[],eliminated=[],third=[],fourth=[];groups.forEach'),
 ('eliminated.push(out.results.D.loser,out.results.L.loser);});return {games,qualified,eliminated};', 'third.push(out.results.D.loser);fourth.push(out.results.L.loser);eliminated.push(out.results.D.loser,out.results.L.loser);});return {games,qualified,eliminated,third,fourth};'),
 ("const a=tables[0][i].id,b=tables[1][i].id,node={id:prefix+'seed:'+i,a,b,bestOf:3,label:'同名次种子赛'};const r=play(node);games.push({...node,...r});seeds.push(r.winner,r.loser);", "seeds.push(tables[0][i].id,tables[1][i].id);")
])
print('Wired season, veto and live rounds; preserved fixture preview and older save keys.')
