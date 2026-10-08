// Exact polygon boundaries, independent movement/sight and continuous routing.
// Static geometry is immutable; door state and smoke belong to a round.
const {intersects,distance,lineIntersectsCircle}=require('./geometry');
const EPS=1e-7;
const point=(p)=>Array.isArray(p)?{x:p[0],y:p[1]}:p;
const bounds=points=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))});
const insideBounds=(p,b)=>p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;
function inside(p,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
class Heap{
 constructor(){this.a=[];}push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].cost<=v.cost)break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;if(a[j].cost>=last.cost)break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}
class GeometryV2{
 constructor(data){
  if(data.schemaVersion!==2||!data.floorContours?.length)throw Error('缺少版本化多边形地图');
  this.data=data;this.step=data.gridStep||6;this.width=data.width||960;this.height=data.height||960;
  this.polygons=data.floorContours.map(c=>{const points=(c.points||c).map(point);return {points,bounds:bounds(points)};});
  this.obstacles=(data.obstacles||[]).map(o=>({...o,points:o.points.map(point)}));
  this.obstacles.forEach(o=>o.bounds=bounds(o.points));this.waypoints=[];this.walls=[];this.cells=new Map();this.rowEdges=new Map();
  for(const poly of this.polygons)for(let i=0;i<poly.points.length;i++){
   const a=poly.points[i],b=poly.points[(i+1)%poly.points.length],edge={a,b};this.walls.push([a,b]);
   for(let y=Math.floor(Math.min(a.y,b.y)/32);y<=Math.floor(Math.max(a.y,b.y)/32);y++)(this.rowEdges.get(y)||this.rowEdges.set(y,[]).get(y)).push(edge);
   for(let y=Math.floor(Math.min(a.y,b.y)/32);y<=Math.floor(Math.max(a.y,b.y)/32);y++)for(let x=Math.floor(Math.min(a.x,b.x)/32);x<=Math.floor(Math.max(a.x,b.x)/32);x++)(this.cells.get(x+':'+y)||this.cells.set(x+':'+y,[]).get(x+':'+y)).push(edge);
  }
  this.airRows=(data.openAirContours||[]).map(c=>{const rows=new Map(),ps=(c.points||c).map(point);for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];for(let y=Math.floor(Math.min(a.y,b.y)/32);y<=Math.floor(Math.max(a.y,b.y)/32);y++)(rows.get(y)||rows.set(y,[]).get(y)).push({a,b});}return rows;});
  this.cache=new Map();this.floorCache=new Map();this.sightCache=new Map();this.grid=null;
 }
 inFloor(p){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  let hit=false;for(const {a,b} of this.rowEdges.get(Math.floor(p.y/32))||[])if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;return hit;
 }
 active(o,state){const value=state?.doors?.[o.id]??this.data.initialDoors?.[o.id];return !o.door||!(value===true||value==='open'||value==='destroyed');}
 contains(p,state){return this.inFloor(p)&&!this.obstacles.some(o=>this.active(o,state)&&o.blocksMovement!==false&&insideBounds(p,o.bounds)&&inside(p,o.points));}
 inSight(p){if(this.inFloor(p))return true;return this.airRows.some(rows=>{let hit=false;for(const {a,b}of rows.get(Math.floor(p.y/32))||[])if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;return hit;});}
 containsForSight(p,state){return this.inSight(p)&&!this.obstacles.some(o=>this.active(o,state)&&o.blocksSight!==false&&insideBounds(p,o.bounds)&&inside(p,o.points));}
 sightSegment(a,b){
  if(!this.data.openAirContours?.length||this.floorSegment(a,b))return this.floorSegment(a,b);
  const key=[a.x,a.y,b.x,b.y].join(':');if(this.sightCache.has(key))return this.sightCache.get(key);
  const cuts=[0,1],rx=b.x-a.x,ry=b.y-a.y,seen=new Set();
  for(let y=Math.floor(Math.min(a.y,b.y)/32);y<=Math.floor(Math.max(a.y,b.y)/32);y++){
   const lo=Math.abs(ry)<EPS?0:Math.max(0,Math.min((y*32-a.y)/ry,((y+1)*32-a.y)/ry)),hi=Math.abs(ry)<EPS?1:Math.min(1,Math.max((y*32-a.y)/ry,((y+1)*32-a.y)/ry));
   const xa=a.x+rx*lo,xb=a.x+rx*hi;
   for(let x=Math.floor(Math.min(xa,xb)/32);x<=Math.floor(Math.max(xa,xb)/32);x++)for(const edge of this.cells.get(x+':'+y)||[]){
    if(seen.has(edge))continue;seen.add(edge);const {a:c,b:d}=edge,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<EPS)continue;
    const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
   }
  }
  cuts.sort((a,b)=>a-b);let legal=true;for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(!this.inSight({x:a.x+rx*t,y:a.y+ry*t})){legal=false;break;}}
  if(this.sightCache.size>10000)this.sightCache.clear();this.sightCache.set(key,legal);return legal;
 }
 onNavigationLink(p,kind){return (this.data.navigationLinks||[]).filter(l=>l.id===kind).some(l=>l.points.slice(1).some((b,i)=>{const a=l.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<2;}));}
 heightAt(p){let h=0;for(const z of this.data.levels||[])if(inside(p,z.points.map(point)))h=Math.max(h,z.height);return h;}
 floorSegment(a,b){
  const key=[a.x,a.y,b.x,b.y].join(':');if(this.floorCache.has(key))return this.floorCache.get(key);
  let legal=this.inFloor(a)&&this.inFloor(b);
  if(legal){const seen=new Set(),dy=b.y-a.y;outer:for(let y=Math.floor((Math.min(a.y,b.y)-EPS)/32);y<=Math.floor((Math.max(a.y,b.y)+EPS)/32);y++){
   const lo=Math.abs(dy)<EPS?0:Math.max(0,Math.min((y*32-a.y)/dy,((y+1)*32-a.y)/dy)),hi=Math.abs(dy)<EPS?1:Math.min(1,Math.max((y*32-a.y)/dy,((y+1)*32-a.y)/dy));
   const xa=a.x+(b.x-a.x)*lo,xb=a.x+(b.x-a.x)*hi;
   for(let x=Math.floor((Math.min(xa,xb)-EPS)/32);x<=Math.floor((Math.max(xa,xb)+EPS)/32);x++)for(const edge of this.cells.get(x+':'+y)||[]){if(seen.has(edge))continue;seen.add(edge);if(intersects(a,b,edge.a,edge.b)){legal=false;break outer;}}
  }}
  if(this.floorCache.size>40000)this.floorCache.clear();this.floorCache.set(key,legal);return legal;
 }
 crosses(a,b,o){if(Math.max(a.x,b.x)<o.bounds.left||Math.min(a.x,b.x)>o.bounds.right||Math.max(a.y,b.y)<o.bounds.top||Math.min(a.y,b.y)>o.bounds.bottom)return false;return inside(a,o.points)||inside(b,o.points)||o.points.some((p,i)=>intersects(a,b,p,o.points[(i+1)%o.points.length]));}
 canWalk(a,b,actor,state){return this.contains(a,state)&&this.contains(b,state)&&this.floorSegment(a,b)&&!this.obstacles.some(o=>this.active(o,state)&&o.blocksMovement!==false&&this.crosses(a,b,o));}
 canTraverse(a,b){return this.canWalk(a,b);}
 canObserve(a,b,state){
  if(!this.inSight(a)||!this.inSight(b)||!this.sightSegment(a,b))return false;
  const za=(a.z??this.heightAt(a))+(a.eyeHeight??1.6),zb=(b.z??this.heightAt(b))+(b.eyeHeight??1.6);
  for(const o of this.obstacles){if(!this.active(o,state)||o.blocksSight===false||!this.crosses(a,b,o))continue;
   const z=this.heightAt(o.points[0])+(o.height??10);let blocked=false;
   // Only intersection positions determine whether the ray passes above cover.
   for(let i=0;i<o.points.length;i++){const c=o.points[i],d=o.points[(i+1)%o.points.length];if(!intersects(a,b,c,d))continue;const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;const t=Math.abs(den)<EPS?.5:((c.x-a.x)*sy-(c.y-a.y)*sx)/den;if(za+(zb-za)*t<=z+EPS)blocked=true;}
   if(blocked||inside(a,o.points)||inside(b,o.points))return false;
  }
  return !(state?.smokes||[]).some(s=>lineIntersectsCircle(a,b,s,s.radius));
 }
 canShoot(a,b,state){return this.canObserve(a,b,state);}
 shootTrace(a,b,state){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*2.5,ny=dx/len*2.5;
  for(const s of [0,-1,1]){const aim={...b,x:b.x+nx*s,y:b.y+ny*s};if(this.canShoot(a,aim,state))return {x:aim.x,y:aim.y,bodyOffset:s};}
  return null;
 }
 lineOfSight(a,b,smoke=[]){return this.canObserve(a,b)&&!smoke.some(w=>intersects(a,b,{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}));}
 visibleFraction(a,b,state){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*2.5,ny=dx/len*2.5;return [-1,0,1].filter(s=>this.canObserve(a,{...b,x:b.x+nx*s,y:b.y+ny*s},state)).length/3;}
 prepareGrid(){
  if(this.grid)return;const cols=Math.ceil(this.width/this.step),rows=Math.ceil(this.height/this.step),open=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)open[y*cols+x]=this.contains({x:(x+.5)*this.step,y:(y+.5)*this.step});
  this.grid={cols,rows,open};
 }
 route(start,end,state){
  if(this.data.dynamicDoors){
   const closed=this.obstacles.filter(o=>o.door&&this.active(o,state)).map(o=>o.id).sort(),key=closed.join('|');
   this.doorRoutes??=new Map();if(!this.doorRoutes.has(key))this.doorRoutes.set(key,new GeometryV2({...this.data,dynamicDoors:false,obstacles:this.data.obstacles.filter(o=>!o.door||closed.includes(o.id)).map(o=>({...o,door:false}))}));
   return this.doorRoutes.get(key).route(start,end);
  }
  if(!this.contains(start)||!this.contains(end))return null;if(this.canWalk(start,end))return [{...start},{...end}];
  const key=[start.x,start.y,end.x,end.y].join(':');if(this.cache.has(key))return this.cache.get(key).map(p=>({...p}));this.prepareGrid();
  const {cols,rows,open}=this.grid,xy=id=>({x:(id%cols+.5)*this.step,y:(Math.floor(id/cols)+.5)*this.step});
  const nearest=p=>{const cx=Math.floor(p.x/this.step),cy=Math.floor(p.y/this.step);for(let r=0;r<5;r++){let best=-1,d=Infinity;for(let y=Math.max(0,cy-r);y<=Math.min(rows-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(cols-1,cx+r);x++){const id=y*cols+x,q=xy(id),v=distance(p,q);if(open[id]&&v<d&&this.canWalk(p,q)){best=id;d=v;}}if(best>=0)return best;}return -1;};
  const first=nearest(start),last=nearest(end);if(first<0||last<0)return null;
  const best=new Float64Array(open.length);best.fill(Infinity);const prev=new Int32Array(open.length);prev.fill(-1);const heap=new Heap();best[first]=0;heap.push({id:first,cost:distance(xy(first),xy(last)),g:0});
  while(heap.a.length){const next=heap.pop(),id=next.id;if(next.g!==best[id])continue;if(id===last)break;const x=id%cols,y=Math.floor(id/cols),p=xy(id);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!(dx||dy)||x+dx<0||x+dx>=cols||y+dy<0||y+dy>=rows)continue;const n=(y+dy)*cols+x+dx;if(!open[n])continue;const q=xy(n),g=next.g+distance(p,q);if(g>=best[n]||!this.canWalk(p,q))continue;best[n]=g;prev[n]=id;heap.push({id:n,g,cost:g+distance(q,xy(last))});}
  }
  if(!Number.isFinite(best[last]))return null;const raw=[{...end}];for(let id=last;id>=0;id=prev[id]){raw.unshift(xy(id));if(id===first)break;}raw.unshift({...start});
  const result=[raw[0]];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!this.canWalk(raw[i],raw[j]))j--;result.push(raw[j]);i=j;}
  if(this.cache.size>2000)this.cache.clear();this.cache.set(key,result);return result.map(p=>({...p}));
 }
}
module.exports={GeometryV2,inside};
