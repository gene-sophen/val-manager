/* One read-only decision source for match navigation, controls and committed results. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MATCH_UI_STATE=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const ended=m=>!!m&&Math.max(m.home,m.away)>=13&&Math.abs(m.home-m.away)>=2;
 const key=s=>[s.year,s.matchToken,s.map].join(':');
 function derive(s,R={},c={}){
  const m=s.liveMaps?.[s.map],history=s.reviewMap!==null&&s.reviewMap!==undefined,over=R.mapOver?R.mapOver(s):ended(m),rows=(s.liveMaps||[]).filter(ended),series=[rows.filter(x=>x.home>x.away).length,rows.filter(x=>x.home<x.away).length],seriesOver=R.seriesOver?R.seriesOver(s):Math.max(...series)>=Math.ceil((s.bestOf||3)/2),maps=R.mapsFor?R.mapsFor(s):s.matchMaps||[],score=m?[m.home,m.away]:R.score?R.score(s):[0,0];
  let state='manual',label='已暂停推进 · 可看战报',primaryAction={action:'next-round',label:s.round?'下一分 · 直接看比分':'开始第一分'},nextRoute='campaign/match';
  if(c.storageError){state='save-error';label='保存失败 · 当前进度未提交';primaryAction={action:'export-draft',label:'导出未提交进度'};}
  else if(history&&c.route==='campaign/map-result'){state='history';label='查看已完成地图';primaryAction={go:'campaign/series-result',label:'返回系列赛赛果'};nextRoute=primaryAction.go;}
  else if(s.completedMatch){state='series-complete';label='系列赛已确认';primaryAction={go:'campaign/series-result',label:'查看系列赛结果'};nextRoute=primaryAction.go;}
  else if(over){state='map-complete';label='本图结束 · '+score.join(':');primaryAction=c.route==='campaign/map-result'?{action:'next-map',label:seriesOver?'确认系列赛结果':'准备第 '+(s.map+2)+' 图 · '+(c.mapName?.(maps[s.map+1])||maps[s.map+1]||'下一图')}:{action:'open-map-result',label:'查看本图结果'};nextRoute=seriesOver?'campaign/series-result':'campaign/agents';}
  else if(c.busy){state=c.stopRequested?'stopping':c.work?.operation==='replay'?'recovering':'computing';label=state==='stopping'?'已接收停止 · 本分后等待':state==='recovering'?'正在恢复历史回放':'正在计算第 '+(s.round+1)+' 分';}
  else if(c.error){state='compute-error';label='本分未完成 · 原比分保留';primaryAction={action:'retry-round',label:'重试本分'};}
  else if(s.coachWindow){state='coaching';label=s.coachWindow==='half'?'中场 · 等待教练确认':s.coachWindow==='opponent'?'对方暂停 · 等待教练确认':'战术暂停 · 等待教练确认';primaryAction={action:'resume-window',label:s.coachWindow==='half'?'保留战术，开始下半场':'保留战术，继续比赛'};}
  else if(s.preparingMap){state='preparing';label='准备第 '+(s.map+1)+' 图';nextRoute=(s.roster||[]).some(k=>!s.agents?.[s.map]?.[k])?'campaign/agents':'campaign/tactics';primaryAction={go:nextRoute,label:nextRoute.endsWith('agents')?'选择本图特工':'确认本图攻防方案'};}
  else if(s.playing){state='automatic';label='自动推进 · 已完成 '+s.round+' 分';}
  const allowedActions=['save-exit','export-diagnostics','export-layout-diagnostics','export-save','export-draft','save-library','review-backup','return-library','export-library-backup','restore-save','close-dialog','speed','cancel-replay'];
  if(!c.storageError){if(!over&&!s.coachWindow)allowedActions.push('play-toggle','request-stop','timeout');if(!c.busy&&!over&&!s.coachWindow)allowedActions.push('next-round','retry-round','skip-map','watch-round');if(!c.busy&&s.coachWindow)allowedActions.push('adjust-window','resume-window','resume-from-home');if(over&&(!c.busy||c.work?.operation==='replay'))allowedActions.push('open-map-result','next-map');}
  return {state,label,primaryAction,nextRoute,allowedActions,score,series,seriesOver,map:maps[s.map]||m?.mapId,nextMap:maps[s.map+1]||null,key:key(s),over};
 }
 return {derive,key,ended};
});
