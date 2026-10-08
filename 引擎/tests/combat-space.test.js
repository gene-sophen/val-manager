const test=require('node:test'),assert=require('node:assert/strict'),{GeometryV2}=require('../geometry-v2'),C=require('../combat-space');
const floor={schemaVersion:2,floorContours:[{points:[[0,0],[100,0],[100,100],[0,100]]}]},wrap=geometry=>C.prepare({geometry,data:{positions:{},engagementWindows:[]}}).geometry;
test('body samples cannot borrow the eye height of the neighbouring elevated floor',()=>{
 const g=new GeometryV2({...floor,levels:[{height:4,points:[[80,50],[100,50],[100,100],[80,100]]}],obstacles:[{id:'wall',height:2,points:[[40,0],[60,0],[60,100],[40,100]]}]}),a={x:10,y:49},b={x:90,y:49};assert(g.shootTrace(a,b));assert.equal(wrap(g).shootTrace(a,b),null);assert.equal(wrap(g).visibleFraction(a,b),0);
});
test('a shoulder sample detached from the body by a wall cannot create a valid shot',()=>{
 const g=new GeometryV2({...floor,obstacles:[{id:'sight-wall',points:[[70,0],[80,0],[80,50],[70,50]]},{id:'body-wall',points:[[85,50],[95,50],[95,51],[85,51]]}]}),a={x:10,y:49},b={x:90,y:49};assert(g.shootTrace(a,b));assert.equal(wrap(g).shootTrace(a,b),null);
});
test('a genuine open angle remains shootable and closed/open doors use current state',()=>{
 const g=new GeometryV2({...floor,initialDoors:{door:'closed'},obstacles:[{id:'door',door:true,points:[[40,0],[45,0],[45,100],[40,100]]}]}),n=wrap(g),a={x:10,y:30},b={x:90,y:30};assert.equal(n.shootTrace(a,b),null);assert(n.shootTrace(a,b,{doors:{door:'open'}}));assert(g.canWalk(b,{x:b.x,y:b.y+2.5}));
});
