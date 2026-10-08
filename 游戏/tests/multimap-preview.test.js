const test=require('node:test'),assert=require('node:assert/strict'),H=require('./helpers/live-ui.cjs');
test('explicit map review uses the latest candidate and never carries its spatial behavior into a new campaign',()=>{
 const x=H.load('multimap-review-isolation'),original=H.begin(x,undefined,false),before=JSON.stringify(original);
 for(const id of x.SPATIAL_MATCH.mapIds){
  const preview=JSON.parse(before);x.SEASON_REVIEW.spatial(preview,6,id);
  const behavior=id+'-balance-3';
  assert.equal(preview.liveMaps[0].spatial.initial.behaviorVersion,behavior,id);
  assert.equal(preview.liveMaps[0].replay.behaviorVersion,behavior,id);
  assert.equal(JSON.stringify(original),before);
  H.begin(x,preview);assert.equal(preview.spatialEnabled,false);assert.equal(preview.spatialPreviewBehaviorVersion,null);
  H.veto(x,preview);preview.agents={0:Object.fromEntries(preview.roster.map((k,i)=>[k,x.AGENT_SELECTION.recommend(x.FLOW_UI.lineup(preview),x.CN_CONTENT.agents,x.FLOW_UI.matchMap(preview).id).agents[i]]))};
  x.PROTOTYPE_RULES.stepRound(preview);assert(!preview.liveMaps[0].spatial,id+' formal campaign changed');
 }
});
