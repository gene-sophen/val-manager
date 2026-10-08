// A navigation area never grants sight. Fixed poses use compiled body visibility;
// movement and dynamic occlusion use the same physical rays without snapping.
class Engagements {
 constructor(data,geometry){
  this.data=data;this.geometry=geometry;this.rounds=new WeakMap();
  this.stats={queries:0,memoHits:0,staticHits:0,rayQueries:0};
 }
 anchored(unit){const p=this.data.positions[unit.post];return p&&!unit.moving&&unit.position&&Math.hypot(p.x-unit.position.x,p.y-unit.position.y)<1e-7&&unit.position.z==null&&unit.position.eyeHeight==null?unit.post:null;}
 window(a,b){
  const inside=(p,w)=>p.x>=w.bounds[0]&&p.x<=w.bounds[2]&&p.y>=w.bounds[1]&&p.y<=w.bounds[3];
  const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const matches=this.data.engagementWindows.filter(w=>inside(a,w)&&inside(b,w));
  const candidates=matches.length?matches:this.data.engagementWindows.filter(w=>inside(midpoint,w));
  return candidates.sort((a,b)=>(a.bounds[2]-a.bounds[0])*(a.bounds[3]-a.bounds[1])-(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1]))[0]?.id||null;
 }
 query(round,a,b){
  this.stats.queries++;
  if(!a.position||!b.position)return {visible:0,window:null,source:'invalid-position'};
  const smokes=(round.geometrySmokes||[]).filter(s=>round.t<s.until),doors=round.doors||{};
  const stateKey=JSON.stringify([doors,smokes.map(s=>[s.x,s.y,s.radius])]);
  let memo=this.rounds.get(round);
  if(!memo||memo.tick!==round.t||memo.stateKey!==stateKey){memo={tick:round.t,stateKey,values:new Map()};this.rounds.set(round,memo);}
  const pa=this.anchored(a),pb=this.anchored(b),coords=p=>[p.x,p.y,p.z??null,p.eyeHeight??null].join(',');
  const key=[coords(a.position),coords(b.position),pa,pb].join('|');
  if(memo.values.has(key)){this.stats.memoHits++;return memo.values.get(key);}
  if(!this.geometry.containsForSight(a.position,{doors:round.doors})||!this.geometry.containsForSight(b.position,{doors:round.doors}))return {visible:0,window:null,source:'invalid-position'};
  let visible,source;
  // Static table is valid only for exact poses, never a whole region or radius.
  const defaults=this.geometry.data.initialDoors||{},staticDoors=[...new Set([...Object.keys(doors),...Object.keys(defaults)])].every(id=>(doors[id]??defaults[id])===defaults[id]);
  if(pa&&pb&&smokes.length===0&&staticDoors){visible=this.data.staticVisibility[pa]?.[pb]??0;source='compiled-pose';this.stats.staticHits++;}
  else {visible=this.geometry.visibleFraction(a.position,b.position,{doors,smokes});source='physical-ray';this.stats.rayQueries++;}
  const result={visible,window:visible>0?this.window(a.position,b.position):null,fromPosition:pa,toPosition:pb,source};
  memo.values.set(key,result);return result;
 }
}
module.exports={Engagements};
