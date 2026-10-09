const {test}=require('node:test');
const assert=require('node:assert/strict');
const N=require('../../设计文档/UI原型/complete-prototype-01/navigation.js');
test('cold detail links return to the correct containing list',()=>{
 assert.equal(N.target('team/map/ascent',null,{}),'team/maps');
 assert.equal(N.target('archive/relation/player',null,{}),'archive/relationships');
 assert.equal(N.target('archive/player/player',null,{}),'archive/album');
});
test('match and completed workflow back routes never re-enter obsolete preparation',()=>{
 const s={run:'match',round:5,map:0,completedMatch:false};
 assert.equal(N.target('campaign/match','campaign/tactics',s),'campaign');
 assert.equal(N.target('campaign/tactics','campaign/agents',s),'campaign/match');
 assert.equal(N.target('campaign/series-result','campaign/map-result',{...s,completedMatch:true}),'campaign');
 assert.equal(N.target('campaign/pick','campaign/compare',{run:'active'}),'campaign');
 assert.equal(N.target('campaign/map-result','campaign/series-result',{...s,reviewMap:0}),'campaign/series-result');
});
test('settings and player detail preserve the opener; duplicate and expired openers fall back',()=>{
 assert.equal(N.target('archive/settings','campaign/match',{run:'match'}),'campaign/match');
 assert.equal(N.target('archive/player/x','team',{run:'active'}),'team');
 assert.equal(N.target('campaign/player/x','campaign/pick',{run:'draft'}),'campaign/pick');
 assert.equal(N.target('archive/settings','archive/settings',{}),'archive/career');
 assert.equal(N.target('archive/settings','campaign/reveal',{run:'active'}),'campaign');
 assert.equal(N.target('archive/settings','campaign/reinforce',{run:'active'}),'campaign');
});
test('only progress/confirmation uses the primary dock; return and card inspection are auxiliary',()=>{
 assert.equal(N.dockTone({dock:'返回征战',go:'campaign'}),'secondary');
 assert.equal(N.dockTone({dock:'查看卡面',action:'card-face'}),'secondary');
 assert.equal(N.dockTone({dock:'查看本图结算 →',go:'campaign/map-result'}),'primary');
 assert.equal(N.dockTone({dock:'确认阵容',action:'begin-year'}),'primary');
});
test('resume respects unfinished veto, agent choices and tactics without restarting a map',()=>{
 const s={run:'active',bp:[],roster:['a','b'],map:0};
 assert.equal(N.resume(s),'campaign/prepare');
 s.bp=['map'];assert.equal(N.resume(s),'campaign/bp');
 s.bp=Array(7).fill('map');s.sideChosen=[true,false,true];assert.equal(N.resume(s),'campaign/bp');
 s.sideChosen=[true,true,true];assert.equal(N.resume(s),'campaign/agents');
 s.agents={0:{a:'Jett',b:'Sova'}};assert.equal(N.resume(s),'campaign/tactics');
 s.run='match';assert.equal(N.resume(s),'campaign/match');
 s.map=1;assert.equal(N.resume(s),'campaign/agents');
});
test('native Back cannot expose expired draft or restart preparations after a match starts',()=>{
 assert.equal(N.normalize('campaign/tactics',{run:'match',round:0}),'campaign');
 assert.equal(N.normalize('campaign/reveal',{run:'active'}),'campaign');
 assert.equal(N.normalize('campaign/match',{run:'match',round:5}),'campaign/match');
 assert.equal(N.normalize('campaign/tactics',{run:'match',adjusting:'half'}),'campaign/tactics');
});
