const test=require('node:test'),assert=require('node:assert/strict');
const {GameMap}=require('../gamemap'),{canObserve}=require('../observation');
const data=require('../maps/ascent-combat-v4.json'),geometry=require('../maps/ascent-geometry-v4.json');
const map=new GameMap(data,geometry),actor=(id,side='atk')=>({id,side,alive:true,post:id,node:map.posts[id].node,position:{x:map.posts[id].x,y:map.posts[id].y}});

test('new partitions block direct passage but all macro routes and micro peeks stay physically continuous',()=>{
 for(const [id,p]of Object.entries({...data.nodes,...data.positions}))assert(map.geometry.contains(p),id);
 for(const edge of data.edges)for(let i=1;i<edge.route.length;i++)assert(map.geometry.canWalk(edge.route[i-1],edge.route[i]),edge.a+' -> '+edge.b);
 for(const p of Object.values(data.positions))if(p.peekTo){assert(p.peekRoute);for(let i=1;i<p.peekRoute.length;i++)assert(map.geometry.canWalk(p.peekRoute[i-1],p.peekRoute[i]),p.name);}
 const a=data.positions['b_lobby-entry-hold'],b=data.positions['b_site-lane'];assert(!map.geometry.canObserve(a,b));assert(!map.geometry.canWalk(a,b));assert(map.geometry.route(a,b).length>2);
});
test('low partition blocks walking but standing sight is independent of collision',()=>{
 const a={x:422,y:510},b={x:432,y:510};assert(map.geometry.contains(a));assert(map.geometry.contains(b));assert(!map.geometry.canWalk(a,b));assert(map.geometry.canObserve(a,b));
});
test('a protected position is different from its physical peek, despite belonging to the same area',()=>{
 const target=actor('a_site-front','def'),r={map,t:1},hidden=actor('a_site-generator-back'),peek=actor('a_site-generator-peek');
 assert(!map.canSee('missing-position','missing-position'));
 assert.equal(hidden.node,peek.node);assert(!canObserve(r,hidden,target));assert(canObserve(r,peek,target));
 assert(!map.canSee(hidden.post,target.post));assert(map.canSee(peek.post,target.post));
 const entry=actor('a_lobby-site-mouth');assert.notEqual(entry.node,target.node);assert(canObserve(r,entry,target));
});
test('every ordered fixed-pose visibility equals exact body rays and windows never grant sight',()=>{
 const round={map,t:0};for(const [a,p]of Object.entries(data.positions))for(const [b,q]of Object.entries(data.positions)){const direct=map.geometry.visibleFraction(p,q);assert.equal(map.engagements.query(round,actor(a),actor(b,'def')).visible,direct,a+' / '+b);}
 const a=actor('a_site-generator-back'),b=actor('a_site-front','def');assert(data.engagementWindows.some(w=>w.areas.includes(a.node)&&w.areas.includes(b.node)));assert.equal(map.engagements.query(round,a,b).visible,0);
});
test('same-tick memo invalidates for movement, smokes and changed door state',()=>{
 const r={map,t:1},a=actor('a_site-generator-peek'),b=actor('a_site-front','def'),stats=map.engagements.stats;
 assert.equal(map.engagements.query(r,a,b).source,'compiled-pose');const before=stats.memoHits;map.engagements.query(r,a,b);assert.equal(stats.memoHits,before+1);
 a.position={...data.positions['a_site-generator-back']};assert.equal(map.engagements.query(r,a,b).visible,0);assert.equal(map.engagements.query(r,a,b).source,'physical-ray');
 a.position={x:data.positions[a.post].x,y:data.positions[a.post].y};r.geometrySmokes=[{x:212,y:613,radius:15,until:3}];assert.equal(map.engagements.query(r,a,b).visible,0);
 r.geometrySmokes=[];assert.equal(map.engagements.query(r,a,b).visible,1);r.doors={'future-door':'closed'};assert.equal(map.engagements.query(r,a,b).source,'physical-ray');
});
test('in-transit targets never inherit the reserved destination visibility',()=>{
 const a=actor('a_site-generator-peek'),b=actor('a_site-front','def'),r={map,t:0};b.moving={to:'a_site'};b.position={x:240,y:646};assert.equal(map.engagements.query(r,a,b).source,'physical-ray');assert.equal(map.engagements.query(r,a,b).visible,map.geometry.visibleFraction(a.position,b.position));
 b.position={x:350,y:450};assert(!canObserve(r,a,b));
});
test('peek and return are physical micro moves with atomic occupation, not point teleportation',()=>{
 const brain=require('../brain'),movement=require('../movement'),u=actor('a_site-generator-back');u.name='守点选手';
 const round={...brain,...movement,map,started:true,t:5,occ:{a_site:new Set([u])},postOcc:{[u.post]:u},emit:()=>{}};
 const origin={...u.position},old=u.post,next=data.positions[old].peekTo;
 round.postOcc[next]={id:'teammate'};assert(!round.switchStance(u,next));assert.equal(u.post,old);assert.equal(round.postOcc[old],u);
 delete round.postOcc[next];assert(round.switchStance(u,next));assert.deepEqual(u.position,origin);assert.equal(u.post,null);assert.equal(u.moving.post,next);assert(u.moving.total>0);assert.equal(round.postOcc[next],u);assert(!round.postOcc[old]);
 for(let i=1;i<u.moving.route.length;i++)assert(map.geometry.canWalk(u.moving.route[i-1],u.moving.route[i]));
});
