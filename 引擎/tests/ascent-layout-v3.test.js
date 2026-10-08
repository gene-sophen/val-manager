const test=require('node:test'),assert=require('node:assert/strict');
const {GameMap}=require('../gamemap');
const map=new GameMap(require('../maps/ascent-combat-v3.json'),require('../maps/ascent-geometry-v3.json'));
test('all authored Ascent positions and every edge actually remain on the new footprint',()=>{for(const [id,p]of Object.entries({...map.nodes,...map.posts}))assert(map.geometry.contains(p),id);for(const e of map.data.edges)for(let i=1;i<e.route.length;i++)assert(map.geometry.canWalk(e.route[i-1],e.route[i]),e.a+' '+e.b);});
test('generator blocks ground-level shooting and cannot be walked through',()=>{const a={x:207,y:637},b={x:238,y:637};assert(map.geometry.contains(a));assert(map.geometry.contains(b));assert(!map.geometry.canShoot(a,b));assert(!map.geometry.canWalk(a,b));});
test('a post behind an unrelated wall cannot shoot just because both belong to A',()=>{const posts=map.postsAt('a_site'),lobby=map.postsAt('a_main');assert(posts.some(a=>lobby.some(b=>!map.canSee(a,b))));});
test('market has a real view into B while A and B cannot fire through the intervening buildings',()=>{assert(map.postsAt('market').some(a=>map.postsAt('b_site').some(b=>map.canSee(a,b))));assert(!map.geometry.canObserve(map.nodes.a_site,map.nodes.b_site));});
