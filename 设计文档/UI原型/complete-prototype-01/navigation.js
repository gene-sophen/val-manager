/* UI navigation policy: completed game actions must never be replayed by Back. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VM_NAV=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const draftPages=new Set(['start','packs','reveal','batch','compare','draft','pick','confirm']);
 function parent(route,s={}){
  const [root,page]=route.split('/');
  if(root==='team')return page==='map'?'team/maps':'team';
  if(root==='archive')return page==='player'?'archive/album':page==='relation'?'archive/relationships':page==='dictionary'?'archive/career':'archive/career';
  if(root!=='campaign')return 'campaign';
  if(draftPages.has(page))return s.run==='draft'?({packs:'campaign',reveal:'campaign/packs',batch:'campaign/packs',compare:'campaign/packs',draft:'campaign/packs',pick:'campaign/compare',confirm:'campaign/pick'}[page]||'campaign'):'campaign';
  if(page==='tactics'&&s.adjusting)return 'campaign/match';
  if(['match','series-result','stage-result','year-result'].includes(page))return 'campaign';
  if(page==='map-result')return s.reviewMap!==null&&s.reviewMap!==undefined?'campaign/series-result':'campaign/match';
  if(page==='reinforce-review')return s.run==='reinforce'?'campaign/reinforce':'campaign';
  if(['prepare','bp','agents','tactics','series-prepare'].includes(page)){
   if(s.seriesEditing!==null&&s.seriesEditing!==undefined&&['agents','tactics'].includes(page))return 'campaign/series-prepare';
   if(s.completedMatch)return 'campaign/series-result';
   if(s.run==='match'&&s.round>0)return 'campaign/match';
   if(page==='agents'&&s.map>0)return 'campaign';
   return {bp:'campaign/prepare',agents:'campaign/bp',tactics:'campaign/agents','series-prepare':'campaign/bp'}[page]||'campaign';
  }
  return 'campaign';
 }
 function target(route,from,s={}){
  if(route.startsWith('campaign/')&&route.split('/')[1]!=='player')return parent(route,s);
  if(from&&from!==route){
   const [,page]=from.split('/');
   if(from.startsWith('campaign/')&&draftPages.has(page)&&s.run!=='draft')return 'campaign';
   if(from.startsWith('campaign/reinforce')&&s.run!=='reinforce')return 'campaign';
   return from;
  }
  return parent(route,s);
 }
 function dockTone(view){return view.dockTone==='secondary'||view.action==='card-face'||/^返回/.test(view.dock||'')?'secondary':'primary';}
 function resume(s={}){
  if(s.run==='reinforce')return 'campaign/reinforce';
  if(s.run==='draft')return s.opened?.every(n=>n===10)?'campaign/draft':'campaign/packs';
  if(s.completedMatch)return 'campaign/series-result';
  if((s.bp?.length||0)<7)return s.bp?.length?'campaign/bp':'campaign/prepare';
  if((s.sideChosen||[]).some(v=>!v))return 'campaign/bp';
  if(s.seriesFlowVersion===1&&s.run==='active'&&s.roster?.length===5)return 'campaign/series-prepare';
  if((s.roster||[]).some(k=>!s.agents?.[s.map||0]?.[k]))return 'campaign/agents';
  return s.preparingMap?'campaign/tactics':s.run==='match'?'campaign/match':'campaign/tactics';
 }
 function normalize(route,s={}){
  if(!route.startsWith('campaign/'))return route;
  const page=route.split('/')[1];
  if(draftPages.has(page)&&page!=='start'&&s.run!=='draft')return 'campaign';
  if(page?.startsWith('reinforce')&&s.run!=='reinforce')return 'campaign';
  if(['prepare','bp','agents','tactics','series-prepare'].includes(page)&&(s.completedMatch||s.run==='match'&&!s.adjusting&&!s.preparingMap))return 'campaign';
  return route;
 }
 return Object.freeze({parent,target,dockTone,resume,normalize});
});
