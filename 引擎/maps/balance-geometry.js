// New journal geometry/poses. Legacy v6 collision, poses and rays stay frozen.
const {GameMap}=require('../gamemap');
const profiles=require('./balance-profiles'),{routePoint}=require('../geometry');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function prepare(base){
 const id=base.data.id;
 const geometry={...base.geometry.data,physicsRevision:id+'-guard-poses-1',...(id==='fracture'?{openAirContours:[]}:{})};
 const positions=Object.fromEntries(Object.entries(base.posts).map(([k,p])=>[k,{...p}]));
 const data={...base.data,physicsRevision:geometry.physicsRevision,balanceProfile:profiles[id],positions,posts:positions,staticVisibility:{},sightlines:[],poseCorrections:[]};
 const map=new GameMap(data,geometry),samples=new Map(),reserved=new Map();
 for(const [node,watch]of Object.entries(profiles[id].guards)){
  const entries=new Set(watch),site=Object.keys(data.sites).find(s=>data.sites[s]===node);
  if(site){entries.add(data.tacticalProfile.sites[site].main.at(-2));entries.add(data.tacticalProfile.sites[site].alternate.at(-2));}
  const targets=[];
  for(const entrance of entries){const e=data.edges.find(e=>[e.a,e.b].includes(entrance)&&[e.a,e.b].includes(node));
   if(e){const route=e.a===entrance?e.route:e.route.slice().reverse(),len=route.slice(1).reduce((s,p,i)=>s+distance(route[i],p),0);for(const back of [25,50,85])targets.push(routePoint(route,Math.max(0,1-back/Math.max(1,len))));}
   else for(const k of base.postsAt(entrance))targets.push(base.posts[k]);
  }
  samples.set(node,targets);
 }
 for(const [key,p]of Object.entries(positions)){
  const targets=samples.get(p.node);if(!targets?.length)continue;
  const score=q=>Math.max(0,...targets.map(t=>map.geometry.visibleFraction(q,t)*2-map.geometry.visibleFraction(t,q)*1.7));
  const original={x:p.x,y:p.y},taken=reserved.get(p.node)||[],choices=[];
  for(let dx=-9;dx<=9;dx+=3)for(let dy=-9;dy<=9;dy+=3){if(Math.hypot(dx,dy)>9)continue;
   const q={x:p.x+dx,y:p.y+dy};if(!map.geometry.canWalk(original,q)||taken.some(t=>distance(t,q)<5))continue;
   choices.push({q,score:score(q)-distance(q,original)*.003});
  }
  const best=choices.sort((a,b)=>b.score-a.score||distance(a.q,original)-distance(b.q,original)||a.q.x-b.q.x||a.q.y-b.q.y)[0];
  if(best&&best.score>score(original)+.05){Object.assign(p,best.q);data.poseCorrections.push({id:key,from:original,to:best.q,reason:'local cover/entrance body visibility; at most 9px, no wall crossing'});}
  taken.push({x:p.x,y:p.y});reserved.set(p.node,taken);
 }
 const entries=Object.entries(positions);
 for(let i=0;i<entries.length;i++){
  const [a,p]=entries[i];data.staticVisibility[a]={};
  for(const [b,q]of entries)data.staticVisibility[a][b]=map.geometry.visibleFraction(p,q);
  for(let j=0;j<i;j++){const [b]=entries[j],v=Math.max(data.staticVisibility[a][b],data.staticVisibility[b][a]);if(v>0)data.sightlines.push([a,b,v]);}
 }
 map.sight={};for(const [a,b,v]of data.sightlines)map.sight[map.postKey(a,b)]=v;
 return map;
}
module.exports={prepare};
