const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../spatial-match'),O=require('../round-outcome'),catalog=require('../catalog');
const {GameMap}=require('../../引擎/gamemap');
const priority={attack:[0,1,2,3,4],defense:[0,1,2,3,4]};
const team=id=>({id,players:catalog.cards.filter(p=>p.team==='EDG'&&p.tier!=='钻').slice(0,5),team:{羁绊:40,状态:50,熟练:50},coach:{战术:50,临场:50,声望:50},mapKnowledge:{ascent:50}});

test('old spatial preview journals retain their original scores after the behavior upgrade',()=>{
 const m=O.create('paired-spatial:0','ascent','attack'),a=team('A'),b=team('B');
 S.initialize(m,a,b,priority);m.spatial.version=1;m.spatial.initial.away.tactics=S.weights(priority);
 for(let i=0;i<8;i++)S.step(m,a,b,priority);
 const restored=JSON.parse(JSON.stringify(m));
 while(!O.ended(restored.home,restored.away))S.step(restored,a,b,priority);
 const legacy=require('../../docs/validation/2026-10-05-spatial/balance.json').cases.find(c=>c.seed===0&&c.side==='attack');
 assert.equal(restored.home,legacy.home);assert.equal(restored.away,legacy.away);assert.equal(restored.rounds.length,legacy.rounds);
});
test('calibrated Ascent paths are bidirectional and remain inside authored navigation floor',()=>{
 const m=new GameMap(S.mapData,require('../../引擎/maps/ascent-navigation-geometry.json'));
 for(const n of Object.values(m.nodes))assert(m.geometry.contains(n));
 for(const p of Object.values(m.posts))assert(m.geometry.contains(p));
 for(const e of m.data.edges){const r=e.route;for(let i=1;i<r.length;i++)assert(m.geometry.canTraverse(r[i-1],r[i]),e.a+' '+e.b);assert.deepEqual(m.edgeBetween(e.b,e.a).route,r.slice().reverse());}
 assert(!m.geometry.lineOfSight(m.nodes.a_site,m.nodes.b_site),'background must not be transparent');
});
test('same input journal restores real scores/events, and replay never changes cards or match',()=>{
 const home=team('A'),away=team('B'),before=JSON.stringify([home,away]);let m=O.create('spatial-test','ascent');
 for(let i=0;i<4;i++)S.step(m,home,away,priority);
 const copy=JSON.parse(JSON.stringify(m));
 for(let i=0;i<4;i++){assert.deepEqual(S.step(m,home,away,priority),S.step(copy,home,away,priority));}
 assert.equal(JSON.stringify(m),JSON.stringify(copy));assert.equal(JSON.stringify([home,away]),before);
 const state=JSON.stringify(m),record=S.replay(m,2);assert(record.events.some(e=>e.type==='round_start'));assert(record.events.some(e=>e.type==='round_end'));
 const geometry=new GameMap(S.mapData,require('../../引擎/maps/ascent-navigation-geometry.json')).geometry;
 for(let t=0;t<=record.ticks;t++)for(const u of Object.values(S.frame(record,t).units)){assert(Number.isFinite(u.position.x));assert(Number.isFinite(u.position.y));assert(geometry.contains(u.position),'replay leaves the authored floor');}
 assert.equal(JSON.stringify(m),state);
});
test('timeout is queued once, charges only its caller, and changes future execution',()=>{
 const home=team('A'),away=team('B'),m=O.create('spatial-pause','ascent');S.step(m,home,away,priority);
 if(m.spatial.boundary.canAdjust)S.step(m,home,away,priority);
 assert(S.requestTimeout(m));assert(!S.requestTimeout(m));const old=JSON.stringify(m.rounds),changed={attack:[4,3,2,1,0],defense:[4,3,2,1,0]};
 S.step(m,home,away,changed);assert.equal(m.spatial.boundary.regulationTimeoutsLeft.A,1);assert.equal(JSON.stringify(m.rounds.slice(0,-1)),old);
 const command=m.spatial.commands.at(-1);assert(command.timeout);assert.equal(command.weights.atk.contact,.4);
});
test('five attack and five defense intentions produce distinct actionable layouts',()=>{
 const {buildIntent,CAMPAIGN_OFFENSE:a,CAMPAIGN_DEFENSE:d}=require('../../引擎/tactics'),m=new GameMap(S.mapData);
 for(const [side,keys]of [['atk',a],['def',d]]){const signatures=keys.map(k=>{const x=buildIntent(m,side,k,()=>.4);return JSON.stringify([x.roles,x.homes,x.routes,x.pace]);});assert.equal(new Set(signatures).size,5);}
});
test('coach has no tendency without observed opponents and estimates never read the hidden family',()=>{
 const {estimate}=require('../../引擎/coach-observation'),m=new GameMap(S.mapData);
 assert.equal(estimate([{type:'round_meta',atkFamily:'rush'}],'def',m),null);
 const sightings=[1,2,3].map(n=>({type:'sighting',side:'def',targetId:'A:'+n,node:'a_lobby',t:8}));
 assert.equal(estimate(sightings,'def',m),'rush');assert.equal(estimate([...sightings,{type:'round_meta',atkFamily:'fake'}],'def',m),'rush');
});
test('campaign ballistics has bounded firing and visible headshot evidence, with setup before live clock',()=>{
 const m=O.create('shot-budget','ascent'),home=team('A'),away=team('B');let heads=0;
 for(let n=0;n<10&&!O.ended(m.home,m.away);n++){S.step(m,home,away,priority);const e=m.replay.events,shots=e.filter(e=>e.type==='shot'),ids=shots.map(e=>e.actorId+':'+e.t);assert.equal(new Set(ids).size,ids.length,'one unit cannot fire at every visible target in the same second');heads+=e.filter(e=>e.type==='damage'&&e.hitLocation==='head').length;const initial=e.find(e=>e.type==='round_start');assert(initial.units.some(u=>u.side==='def'&&u.node!=='ct_spawn'));}
 assert(heads>0);
});
test('all delivered browser scripts parse and the generated adapter matches direct Node execution',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),dir=path.resolve(__dirname,'../../设计文档/UI原型/complete-prototype-01');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');for(const m of html.matchAll(/<script src="([^"]+)"/g)){const file=path.resolve(dir,m[1].split('?')[0]);new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}
 const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(dir,'spatial-engine.js'),'utf8'),sandbox);
 const a=O.create('bundle-parity','ascent'),b=JSON.parse(JSON.stringify(a)),home=team('A'),away=team('B');
 for(let i=0;i<4;i++)assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.SPATIAL_MATCH.step(b,home,away,priority))),S.step(a,home,away,priority));
 assert.equal(JSON.stringify(a),JSON.stringify(b));
});
