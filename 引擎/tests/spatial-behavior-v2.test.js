const test=require('node:test'),assert=require('node:assert/strict'),P=require('../spatial-behavior-v2');
test('defensive duelists can use equipped mobility and buffs on a real visible encounter',()=>{const r={visibleEnemiesAt:()=>[{}],planted:false,flags:{}},u={side:'def',moving:null};assert(P.skillCandidate(r,u,{def:{archetype:'dash'}},null));assert(P.skillCandidate(r,u,{def:{archetype:'ult_aimbuff'}},null));r.visibleEnemiesAt=()=>[];assert.equal(P.skillCandidate(r,u,{def:{archetype:'dash'}},null),null);});
test('new reconnaissance does not count hidden opponents merely present in target region',()=>{
 const u={id:'A:0',side:'atk',alive:true,node:'a_main',position:{x:0,y:0}},hidden={id:'B:0',side:'def',alive:true,node:'a_site',position:{x:100,y:0}},r={t:10,units:[u,hidden],map:{region:n=>n.startsWith('a_')?'A':'B',data:{strictSpatial:true},geometry:{visibleFraction:()=>0}},observations:{atk:{}},localObservations:{},geometrySmokes:[]};
 assert.equal(P.recon(r,u,'A'),null);r.observations.atk['B:0']={id:'B:0',node:'a_site',lastSeenTick:9};assert.equal(P.recon(r,u,'A'),1);r.t=14;assert.equal(P.recon(r,u,'A'),null);
});
test('prepared defensive random choices retain plausible angles instead of any open crossing',()=>{
 const map=require('../maps/balance-geometry').prepare(require('../maps/combat-registry').get('split')),u={id:'B:0',side:'def',role:'home',position:map.nodes.a_site},r={map,def:[u],postOcc:{},doors:{},planted:false,sightCount:()=>0};const free=map.postsAt('a_site'),choices=P.postChoices(r,u,free);assert.equal(choices.length,3);assert(choices.every(p=>free.includes(p)));assert.deepEqual(P.postChoices(r,{...u,side:'atk'},free),free);
});
