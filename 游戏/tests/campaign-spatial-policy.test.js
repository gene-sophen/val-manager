const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match'),H=require('./helpers/live-ui.cjs');
const policy={releaseId:'test-only-current-candidate',versions:Object.fromEntries(['ascent',...S.mapIds].map(id=>[id,id==='ascent'?'ascent-balance-5':id+'-balance-3']))};
test('a closed release still fails closed and legacy numerical fixtures retain their model',()=>{const status=require('../content/map-balance-status.json'),gate=status.releaseGate;try{status.releaseGate=false;assert.equal(S.campaignPolicy(),null);}finally{status.releaseGate=gate;}const x=H.load('not-released'),s=H.begin(x,undefined,false);assert.equal(s.spatialEnabled,false);assert.equal(s.spatialCampaignPolicy,null);});
test('an incomplete release gate fails before opening a new year or consuming cards',()=>{
 const x=H.load('bad-release'),s=H.begin(x,undefined,false),before=JSON.stringify(s);x.SPATIAL_MATCH.campaignPolicy=()=>{throw Error('发布配置未完整验收');};assert.throws(()=>x.PROTOTYPE_RULES.newRun(s,x.CN_CONTENT,x.CN_DRAW,x.Math.random),/未完整验收/);assert.equal(JSON.stringify(s),before);
});
test('a formally selected map freezes its season policy, respects real heroes and restores the same next round',()=>{
 const x=H.load('spatial-policy-formal'),R=x.PROTOTYPE_RULES;x.SPATIAL_MATCH.campaignPolicy=()=>structuredClone(policy);const s=H.begin(x);assert.equal(s.spatialEnabled,true);assert.deepEqual(JSON.parse(JSON.stringify(s.spatialCampaignPolicy)),policy);H.veto(x,s);s.run='match';const mapId=R.mapsFor(s)[0];s.agents[0]=Object.fromEntries(s.roster.map((k,i)=>[k,x.AGENT_SELECTION.recommend(x.FLOW_UI.lineup(s),x.CN_CONTENT.agents,mapId).agents[i]]));R.resetMap(s);R.stepRound(s);const m=s.liveMaps[0];assert.equal(m.spatial.initial.behaviorVersion,policy.versions[mapId]);assert.equal(m.spatial.version,mapId==='ascent'?5:6);assert.equal(m.progression.roundsSettled,1);
 const copy=JSON.parse(JSON.stringify(s));x.SPATIAL_MATCH.campaignPolicy=()=>null;R.stepRound(s);R.stepRound(copy);assert.equal(JSON.stringify(s.liveMaps),JSON.stringify(copy.liveMaps));assert.equal(JSON.stringify(s.team),JSON.stringify(copy.team));
 x.SEASON_REVIEW.spatial(copy,6,'split');assert.equal(copy.spatialCampaignPolicy,null);assert.equal(copy.liveMaps[0].spatial.initial.behaviorVersion,'split-balance-3');
});
test('published new campaigns select the nine frozen revisions while loading an old year preserves its model',()=>{
 const x=H.load('published-season',{spatial:true}),R=x.PROTOTYPE_RULES,s=H.begin(x,undefined,false),released=S.campaignPolicy();assert(released);assert.equal(released.releaseId,'campaign-spatial-20261008-1');assert.deepEqual(JSON.parse(JSON.stringify(s.spatialCampaignPolicy)),released);assert.equal(s.spatialEnabled,true);assert.equal(s.spatialVersion,6);
 const old=H.begin(H.load('old-numeric-season'),undefined,false);R.init(old);assert.equal(old.spatialEnabled,false);assert.equal(old.spatialCampaignPolicy,null);
 const status=require('../content/map-balance-status.json'),saved=status.candidateVersions.split;try{delete status.candidateVersions.split;assert.throws(()=>S.campaignPolicy(),/未完整验收/);}finally{status.candidateVersions.split=saved;}
});
test('invalid release rejects before the content upgrade wrapper changes a frozen season',()=>{
 const C=require('../career-store'),x=H.load('frozen-invalid-release'),R=x.PROTOTYPE_RULES,b=C.contentBridge(x.DEMO,R,x.CN_CONTENT),s=H.begin(x,undefined,false);b.freeze(s);s.contentSnapshot.uiCards[0].AIM=23;b.bind(s);const before=JSON.stringify(s),cards=JSON.stringify(x.DEMO.cards);x.SPATIAL_MATCH.campaignPolicy=()=>{throw Error('发布配置未完整验收');};assert.throws(()=>R.newRun(s,x.CN_CONTENT,x.CN_DRAW,x.Math.random),/未完整验收/);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(x.DEMO.cards),cards);
});
