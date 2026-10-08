/* Isolated review scenes built by the real tournament graph, using fixed seeds.
   They never overwrite the user's campaign. No forged semifinal/final results. */
window.SEASON_REVIEW={preparation(s){
 const R=PROTOTYPE_RULES,pool=R.mapCatalog.slice(0,7).map(m=>m.id);
 Object.assign(s,{simulation:'live',spatialCampaignPolicy:null,spatialEnabled:false,spatialVersion:null,spatialPreviewBehaviorVersion:null,club:'EDG',phase:0,run:'active',activeMaps:pool,seasonEngine:SEASON_2026.create('team-style-preparation',CN_CONTENT.rosters,CN_CONTENT.globalCards,'EDG'),stageSession:null});
 R.prepareStage(s);R.resetMatch(s);
},spatial(s,version=2,mapId='ascent'){
 const S=SEASON_2026,R=PROTOTYPE_RULES,V=MAP_VETO;
 const rest=R.mapCatalog.filter(m=>m.id!==mapId).slice(0,6).map(m=>m.id),pool=[...rest.slice(0,2),mapId,...rest.slice(2)];
 Object.assign(s,{simulation:'live',spatialCampaignPolicy:null,spatialEnabled:true,spatialVersion:version,spatialPreviewBehaviorVersion:version===6&&mapId!=='ascent'?mapId+'-balance-3':version===5&&mapId==='ascent'?'ascent-balance-5':null,club:'EDG',phase:0,run:'active',activeMaps:pool,seasonEngine:S.create(mapId+'-spatial-review',CN_CONTENT.rosters,CN_CONTENT.globalCards,'EDG',{teamStyle:version>=5}),stageSession:null});
 R.prepareStage(s);
 // A named map review fixes a legal veto using neutral BP knowledge. Restore
 // the generated opponent map strengths before freezing any combat inputs.
 const reviewRival=s.seasonEngine.teams.find(t=>t.id===s.opponentId),knowledge=reviewRival.mapKnowledge;
 try{reviewRival.mapKnowledge={};R.resetMatch(s);
  while(s.bp.length<7){const step=V.sequence(s.veto)[s.bp.length],available=pool.filter(id=>!s.bp.includes(id));R.bpMove(s,step.kind==='pick'&&available.includes(mapId)?mapId:available.find(id=>id!==mapId)||available[0]);}
  let index;while((index=R.pendingSide(s))!==undefined)R.setSide(s,index,'attack');
  if(R.mapsFor(s)[0]!==mapId)throw Error('指定地图预览禁选不一致');
 }finally{if(knowledge)reviewRival.mapKnowledge=knowledge;else delete reviewRival.mapKnowledge;}
 s.agents={0:Object.fromEntries(s.roster.map((k,i)=>[k,AGENT_SELECTION.recommend(FLOW_UI.lineup(s),CN_CONTENT.agents,mapId).agents[i]]))};
 s.run='match';s.map=0;R.resetMap(s);R.stepRound(s);s.playing=false;
},final(s,lower=false){
 const S=SEASON_2026,R=PROTOTYPE_RULES,pool=R.mapCatalog.slice(0,7).map(m=>m.id);
 const ctx=S.create('bo5-preview-'+(lower?3:1),CN_CONTENT.rosters,CN_CONTENT.globalCards,'EDG',{teamStyle:false});
 for(let phase=0;phase<3;phase++)S.commitStage(ctx,phase,S.runStage(ctx,phase,n=>S.simulate(ctx,n,pool)));
 const session=S.prepare(ctx,3,pool);
 while(!session.complete){S.progress(ctx,session,pool);const n=session.pending;if(n?.grandFinal)break;if(n)S.submit(session,S.simulate(ctx,{...n,bestOf:n.playedBestOf},pool));}
 if(!session.pending?.grandFinal||((session.pending.upperTeam==='EDG')===lower))throw Error('决赛预览种子与签表不一致');
 Object.assign(s,{simulation:'live',club:'EDG',phase:3,run:'active',activeMaps:pool,seasonEngine:ctx,stageSession:session});R.prepareStage(s);R.resetMatch(s);
}};
