/* UI navigation policy: completed game actions must never be replayed by Back. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VM_NAV=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const draftPages=new Set(['start','packs','reveal','compare','pick','confirm']);
 function parent(route,s={}){
  const [root,page]=route.split('/');
  if(root==='team')return page==='map'?'team/maps':'team';
  if(root==='archive')return page==='player'?'archive/album':page==='relation'?'archive/relationships':'archive/career';
  if(root!=='campaign')return 'campaign';
  if(draftPages.has(page))return s.run==='draft'?({packs:'campaign',reveal:'campaign/packs',compare:'campaign/packs',pick:'campaign/compare',confirm:'campaign/pick'}[page]||'campaign'):'campaign';
  if(page==='tactics'&&s.adjusting)return 'campaign/match';
  if(['match','series-result','stage-result','year-result'].includes(page))return 'campaign';
  if(page==='map-result')return s.reviewMap!==null&&s.reviewMap!==undefined?'campaign/series-result':'campaign/match';
  if(page==='reinforce-review')return s.run==='reinforce'?'campaign/reinforce':'campaign';
  if(['prepare','bp','agents','tactics'].includes(page)){
   if(s.completedMatch)return 'campaign';
   if(s.run==='match'&&s.round>0)return 'campaign/match';
   if(page==='agents'&&s.map>0)return 'campaign';
   return {bp:'campaign/prepare',agents:'campaign/bp',tactics:'campaign/agents'}[page]||'campaign';
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
 function dockTone(view){return view.action==='card-face'||/^返回/.test(view.dock||'')?'secondary':'primary';}
 function resume(s={}){
  if(s.run==='reinforce')return 'campaign/reinforce';
  if(s.run==='draft')return s.chosenPack!==null&&s.chosenPack!==undefined?'campaign/pick':'campaign/packs';
  if(s.completedMatch)return 'campaign';
  if((s.bp?.length||0)<7)return s.bp?.length?'campaign/bp':'campaign/prepare';
  if((s.sideChosen||[]).some(v=>!v))return 'campaign/bp';
  if((s.roster||[]).some(k=>!s.agents?.[s.map||0]?.[k]))return 'campaign/agents';
  return s.run==='match'?'campaign/match':'campaign/tactics';
 }
 function normalize(route,s={}){
  if(!route.startsWith('campaign/'))return route;
  const page=route.split('/')[1];
  if(draftPages.has(page)&&page!=='start'&&s.run!=='draft')return 'campaign';
  if(page?.startsWith('reinforce')&&s.run!=='reinforce')return 'campaign';
  if(['prepare','bp','agents','tactics'].includes(page)&&(s.completedMatch||s.run==='match'&&!s.adjusting))return 'campaign';
  return route;
 }
 return Object.freeze({parent,target,dockTone,resume,normalize});
});
