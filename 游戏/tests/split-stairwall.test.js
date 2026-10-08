const test=require('node:test'),assert=require('node:assert/strict'),S=require('../spatial-match');
test('Split mid cannot shoot B site through the B heaven stairwell wall',()=>{
 const m=S.replayMap({layoutVersion:'split-combat-v6',behaviorVersion:'split-balance-3'}),g=S.combatGeometry('split','split-balance-3'),old=S.combatGeometry('split','split-balance-2');
 const mid=Object.values(m.posts).filter(p=>p.node.startsWith('mid_')),sites=Object.values(m.posts).filter(p=>p.node==='b_site');
 assert(mid.some(p=>sites.some(q=>old.shootTrace(p,q))),'the reported old-version ray is reproducible');
 for(const a of mid)for(const b of sites){assert.equal(g.shootTrace(a,b),null,a.node+' → '+b.node);assert.equal(g.visibleFraction(a,b),0);}
 for(const [a,p]of Object.entries(m.posts).filter(([k,p])=>p.node.startsWith('mid_')))for(const [b,q]of Object.entries(m.posts).filter(([k,p])=>p.node==='b_site'))assert.equal(m.staticVisibility[a][b],0,'compiled guards agree with the physical wall');
 // Checking nearby real positions, not just the exact compiled poses, closes
 // the same wall bypass for a moving player and shoulder samples.
 const b=m.posts['b_site-stance-0'];for(const p of mid)for(const dx of [-2,0,2]){const q={x:p.x+dx,y:p.y};if(g.contains(q)&&g.heightAt(q)===g.heightAt(p))assert.equal(g.shootTrace(q,b),null);}
 const route=g.route(m.nodes.b_tower,m.nodes.b_rafters);assert(route?.length>2);for(let i=1;i<route.length;i++)assert(g.canWalk(route[i-1],route[i]));
 assert(Object.values(m.posts).filter(p=>p.node==='b_rafters').some(p=>sites.some(q=>g.shootTrace(p,q))),'legal B heaven-to-site angles remain open');
});
