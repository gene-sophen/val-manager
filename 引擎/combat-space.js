// Versioned physical body sampling: limbs cannot borrow a neighbouring floor
// height or extend through an intervening wall. Existing geometry is untouched.
const {Engagements}=require('./engagements');
const {GeometryV2}=require('./geometry-v2');
// West face of the B heaven stairwell, traced from split-v2 structure contour
// 14. The passage below y=565.678 remains open to B rafters. This is a physical
// wall, not a ban on area-name pairs; all intervening positions obey it.
const splitWalls=[{id:'b-heaven-stairwell-west',points:[[663.5,501.199],[665,501.199],[665,565.678],[663.5,565.678]],height:10,blocksMovement:true,blocksSight:true}];
function prepare(map){
 const walls=map.data.id==='split'?splitWalls:[],base=walls.length?new GeometryV2({...map.geometry.data,obstacles:[...map.geometry.data.obstacles,...walls]}):map.geometry,g=Object.create(base),eye=p=>({...p,z:p.z??base.heightAt(p),eyeHeight:p.eyeHeight??1.6});
 const body=(center,offset,state)=>Math.hypot(center.x-offset.x,center.y-offset.y)<1e-7||base.canWalk(center,offset,null,state);
 g.canObserve=(a,b,state)=>base.canObserve(eye(a),eye(b),state);
 g.canShoot=g.canObserve;
 g.shootTrace=(a,b,state)=>{
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*2.5,ny=dx/len*2.5,origin=eye(a),target=eye(b);
  for(const s of [0,-1,1]){const aim={...target,x:b.x+nx*s,y:b.y+ny*s};if(body(b,aim,state)&&base.canShoot(origin,aim,state))return {x:aim.x,y:aim.y,z:aim.z,sourceZ:origin.z,bodyOffset:s};}return null;
 };
 g.visibleFraction=(a,b,state)=>{
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*2.5,ny=dx/len*2.5,origin=eye(a),target=eye(b);
  return [-1,0,1].filter(s=>{const p={...target,x:b.x+nx*s,y:b.y+ny*s};return body(b,p,state)&&base.canObserve(origin,p,state);}).length/3;
 };
 // Recompile exact-position tables with the corrected body/wall model. Pose
 // selection, firing and support evaluation must agree on the same visibility.
 const staticVisibility={},sightlines=[],entries=Object.entries(map.posts||map.data.positions||{});
 for(const [a,p]of entries){staticVisibility[a]={};for(const [b,q]of entries)staticVisibility[a][b]=g.visibleFraction(p,q,{doors:base.data.initialDoors});}
 for(let i=0;i<entries.length;i++)for(let j=0;j<i;j++){const a=entries[i][0],b=entries[j][0],v=Math.max(staticVisibility[a][b],staticVisibility[b][a]);if(v>0)sightlines.push([a,b,v]);}
 const data={...map.data,combatSpaceVersion:'connected-body-1',physicalBarriers:walls,staticVisibility,sightlines},copy=Object.create(map);copy.data=data;copy.geometry=g;
 copy.sight={};for(const [a,b,v]of sightlines)copy.sight[copy.postKey(a,b)]=v;
 // Only exact stationary poses and unchanged doors use the new table. Moving
 // bodies and smoke/door changes retain physical rays and per-tick memoization.
 copy.engagements=new Engagements(data,g);
 return copy;
}
module.exports={prepare};
