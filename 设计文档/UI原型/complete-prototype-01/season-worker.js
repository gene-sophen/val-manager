// No DOM or database access: compute a private copy, then let the UI commit once.
const release=new URL(self.location.href).searchParams.get('v');
self.window=self;
importScripts(...['team-style','map-baseline','map-veto','stage-feedback','content-defaults','team-power','round-outcome','tournament','season-2026'].map(n=>'../../../游戏/'+n+'.js?v='+release));
self.onmessage=({data})=>{
 const {id,input}=data,started=Date.now();
 try{
  self.CN_CONTENT={mapSideData:input.mapSideData};
  const {ctx,phase,maps}=input;
  const session=input.session||SEASON_2026.prepare(ctx,phase,maps);
  self.postMessage({id,progress:{phase,completed:0,elapsed:Date.now()-started}});
  SEASON_2026.progress(ctx,session,maps,{onProgress:p=>self.postMessage({id,progress:{...p,elapsed:Date.now()-started}})});
  self.postMessage({id,ctx,session,elapsed:Date.now()-started,cache:SEASON_2026.profileCacheStats()});
 }catch(error){self.postMessage({id,error:error.message});}
};
