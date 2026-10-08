const test=require('node:test'),assert=require('node:assert/strict');
const {GeometryV2}=require('../geometry-v2');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const data={schemaVersion:2,width:120,height:100,floorContours:[rect(0,0,120,100)],obstacles:[{id:'box',points:rect(45,25,20,50),height:3}]};
test('solid cover blocks a ray and an accurate routed move avoids it',()=>{const g=new GeometryV2(data),a={x:20,y:50},b={x:90,y:50};assert(!g.canShoot(a,b));assert(!g.canWalk(a,b));const route=g.route(a,b);assert(route?.length>2);for(let i=1;i<route.length;i++)assert(g.canWalk(route[i-1],route[i]));});
test('smoke blocks observation but never removes a movement route',()=>{const g=new GeometryV2(data),a={x:10,y:10},b={x:90,y:10},state={smokes:[{x:50,y:10,radius:8}]};assert(g.canWalk(a,b,null,state));assert(!g.canObserve(a,b,state));assert(g.canObserve(a,b));});
test('height permits a view above low cover; walking still cannot cross it',()=>{const g=new GeometryV2({...data,obstacles:[{...data.obstacles[0],height:1}]});assert(g.canObserve({x:20,y:50},{x:90,y:50}));assert(!g.canWalk({x:20,y:50},{x:90,y:50}));});
test('dynamic door state affects both movement and visibility',()=>{const g=new GeometryV2({...data,obstacles:[{...data.obstacles[0],door:true}]});const a={x:20,y:50},b={x:90,y:50};assert(!g.canWalk(a,b));assert(g.canWalk(a,b,null,{doors:{box:'open'}}));assert(g.canObserve(a,b,{doors:{box:'open'}}));});
test('a narrow hole cannot be skipped by sparse ray sampling',()=>{const g=new GeometryV2({schemaVersion:2,floorContours:[rect(0,0,120,100),rect(50.1,40,.2,20)]});assert(!g.floorSegment({x:40,y:50},{x:80,y:50}));assert(!g.contains({x:50.2,y:50}));});
