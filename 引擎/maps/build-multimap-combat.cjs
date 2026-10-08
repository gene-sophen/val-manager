const fs=require('node:fs'),path=require('node:path'),{GeometryV2,inside}=require('../geometry-v2');
const profiles=require('./combat-profiles'),authored=require('./combat-profiles/stances');
const polygon=p=>p.map(([x,y])=>({x,y}));
const round=n=>+n.toFixed(3),len=route=>route.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
const normalized=id=>id==='attacker-side-bridge'?'t_bridge':id==='attacker-side-spawn'?'t_spawn':id==='defender-side-spawn'?'ct_spawn':id.replaceAll('-','_');
function nearest(g,p,accept=()=>true,limit=100){if(g.contains(p)&&accept(p))return {x:p.x,y:p.y};for(let r=2;r<=limit;r+=2)for(let i=0;i<48;i++){const q={x:round(p.x+Math.cos(i*Math.PI/24)*r),y:round(p.y+Math.sin(i*Math.PI/24)*r)};if(g.contains(q)&&accept(q))return q;}throw Error('No legal reviewed coordinate within '+limit+'px: '+JSON.stringify(p));}
function compile(id){
 const spec=profiles[id];if(!spec)throw Error('Unknown map '+id);
 const layout=require('./layouts/'+id+'-v2.json'),corrections=[];
 const geometry={schemaVersion:2,width:960,height:960,gridStep:6,layoutVersion:id+'-combat-v6',floorContours:layout.footprintContours,
  openAirContours:(spec.openAir||[]).map(i=>layout.footprintContours[i]),navigationLinks:[],obstacles:spec.covers.map(i=>({id:'cover-'+i,name:'审核掩体 '+i,kind:'solid-cover',height:3,points:layout.surfaceMarkContours[i].points,evidence:'reviewed source surface contour '+i})),
  levels:spec.levels.map(i=>({id:'raised-'+i,points:layout.surfaceMarkContours[i].points,height:3,evidence:'game height abstraction; source platform contour '+i})),sourceHash:layout.reference.sha256,dynamicDoors:true,initialDoors:{}};
 let g=new GeometryV2(geometry);
 const nodes=Object.fromEntries(layout.landmarks.map(p=>{const key=normalized(p.id),seed=layout.visualSiteAnchors?.[p.region]&&key===p.region.toLowerCase()+'_site'?layout.visualSiteAnchors[p.region]:p;
  const siteKey=Object.keys(spec.sites).find(s=>key===s.toLowerCase()+'_site'),zone=siteKey?layout.plantZoneContours.find(c=>inside(layout.visualSiteAnchors[siteKey],polygon(c.points))):null;
  const fit=nearest(g,seed,q=>!zone||inside(q,polygon(zone.points)));if(Math.hypot(fit.x-seed.x,fit.y-seed.y)>.1)corrections.push({id:key,from:{x:seed.x,y:seed.y},to:fit,reason:'source callout is outside floor / reviewed cover'});
  return [key,{name:p.name,region:p.region==='atk'||p.region==='def'?'spawn':p.region,cover:.25,advantage:siteKey?'def':'neutral',capacity:8,...fit}];}));
 if(!nodes.t_spawn||!nodes.ct_spawn)throw Error(id+' missing spawns');
 const sites=Object.fromEntries(Object.keys(spec.sites).map(s=>[s,s.toLowerCase()+'_site'])),pairs=new Map();
 function connect(a,b){if(!nodes[a]||!nodes[b])throw Error(id+' unknown link '+a+' '+b);const key=[a,b].sort().join(':');pairs.set(key,{a,b,exposure:.45});}
 for(const p of Object.values(spec.sites))for(const route of [p.main,p.alternate,p.defense])for(let i=1;i<route.length;i++)connect(route[i-1],route[i]);
 for(const s of spec.links){const [a,b]=s.split(' ');connect(a,b);}
 // Mechanism planes are attached to their reviewed connector, not an arbitrary
 // region-wide visibility flag. Cross-sections retain the native SVG coordinates.
 const doorDefinitions=[];
 for(const d of spec.mechanisms||[]){
  connect(d.a,d.b);const route=g.route(nodes[d.a],nodes[d.b]);if(!route)throw Error(id+' mechanism disconnected '+d.id);
  let remaining=len(route)*d.at,point,dx,dy;
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.hypot(b.x-a.x,b.y-a.y);if(remaining<=n||i===route.length-1){dx=(b.x-a.x)/n;dy=(b.y-a.y)/n;point={x:a.x+dx*remaining,y:a.y+dy*remaining};break;}remaining-=n;}
  const nx=-dy,ny=dx,extent=sign=>{let v=1;while(v<65&&g.contains({x:point.x+nx*v*sign,y:point.y+ny*v*sign}))v++;return v;},left=extent(-1),right=extent(1);
  const points=[[-left,-1.5],[right,-1.5],[right,1.5],[-left,1.5]].map(([n,t])=>[round(point.x+nx*n+dx*t),round(point.y+ny*n+dy*t)]);
  const controls=[-1,1].map(sign=>nearest(g,{x:point.x+dx*sign*22,y:point.y+dy*sign*22},q=>!inside(q,polygon(points)),40));
  const definition={...d,points,control:controls[0],controls,operationSeconds:1,locationEvidence:'authored cross-section on saved connector; simplified game mechanism'};
  geometry.obstacles.push({id:d.id,name:d.name,kind:d.kind,height:8,points,door:true});geometry.initialDoors[d.id]=['rotating','breakable'].includes(d.kind)?'closed':'open';doorDefinitions.push(definition);
 }
 g=new GeometryV2(geometry);const allOpen={doors:Object.fromEntries(doorDefinitions.map(d=>[d.id,'open']))};
 const avoidDoors=q=>!doorDefinitions.some(d=>inside(q,polygon(d.points)));
 for(const [key,n]of Object.entries(nodes)){const fit=nearest(g,n,avoidDoors,100);if(Math.hypot(fit.x-n.x,fit.y-n.y)>.1){corrections.push({id:key,from:{x:n.x,y:n.y},to:fit,reason:'kept outside mechanism sweep'});Object.assign(n,fit);}}
 const data={id,name:layout.name,layoutVersion:geometry.layoutVersion,spatialVersion:6,engagementModel:'layered-v6',strictSpatial:true,fireModel:'timed-v3',combatProfile:'campaign-ballistics',tickSeconds:.25,spatialFire:'shared-los',defenseSupport:'contact-casualty',informationPolicy:'delayed-reports',externalEffectsVersion:'card-effects-1',roundRules:{maxTicks:100,plantTicks:4,spikeTicks:45,defuseTicks:7},navigationSpeed:spec.speed||{run:32,walk:20},view:{width:960,height:960},viewBounds:'40 40 880 880',visualAsset:'地图风格/'+id+'-combat-v6.svg',sites,spawns:{atk:'t_spawn',def:'ct_spawn'},staging:Object.fromEntries(Object.entries(spec.sites).map(([s,p])=>[s,p.defense.at(-1)])),nodes,edges:[],positions:{},deployment:{atk:{},def:{}},tacticalProfile:spec,plantZones:layout.plantZoneContours,dynamicDoors:true,doorDefinitions,trapSpots:{},source:{...layout.reference,sourceTransform:layout.coordinates.sourceTransform.matrix,coordinateCorrections:corrections,patchCaution:spec.patchCaution||'Saved source snapshot; competitive patch not verified'},features:spec.features};
 // Macro graph selects an approach. Physical paths and firing poses are separate.
 for(const e of pairs.values()){
  const tr=spec.traversals?.find(t=>[e.a,e.b].includes(t[0])&&[e.a,e.b].includes(t[1]));
  const route=tr?.[2]==='zipline'?[{x:nodes[e.a].x,y:nodes[e.a].y},{x:nodes[e.b].x,y:nodes[e.b].y}]:g.route(nodes[e.a],nodes[e.b],allOpen);
  if(!route)throw Error(id+' disconnected connector '+e.a+' '+e.b);
  if(tr?.[2]==='zipline')geometry.navigationLinks.push({id:'zipline',a:e.a,b:e.b,points:route});
  data.edges.push({...e,route,ticks:tr?.[2]==='zipline'?tr[3]:Math.ceil(len(route)/32)+(tr?.[3]||0),...(tr?{traversal:tr[2],traverseSeconds:tr[3]}:{})});
 }

 const used=new Set(data.edges.flatMap(e=>[e.a,e.b]));
 for(const [area,n]of Object.entries(nodes)){
  if(!used.has(area))continue;
  const isSite=Object.values(sites).includes(area),count=isSite||area==='t_spawn'||area==='t_bridge'?6:3;
  for(let i=0;i<count;i++){const angle=i*Math.PI*2/count,siteKey=Object.keys(sites).find(s=>sites[s]===area),stance=siteKey&&authored[id][siteKey][i],desired=stance?{x:stance[0],y:stance[1]}:{x:n.x+Math.cos(angle)*12,y:n.y+Math.sin(angle)*12};
   const same=Object.values(data.positions).filter(p=>p.node===area),q=nearest(g,desired,p=>avoidDoors(p)&&!same.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<5),stance?24:50);
   if(stance&&Math.hypot(q.x-desired.x,q.y-desired.y)>.1)corrections.push({id:area+'-stance-'+i,from:desired,to:q,reason:'authored site pose fits native boundary / cover'});
   const nearby=geometry.obstacles.some(o=>o.kind==='solid-cover'&&Math.min(...o.points.map(([x,y])=>Math.hypot(x-q.x,y-q.y)))<30);
   const key=area+'-stance-'+i;data.positions[key]={node:area,area,...q,name:n.name+' · '+(isSite?['入口反架','侧口探头','箱侧保护','点内后角','回防角','侧翼架枪']:['左侧架枪','侧边探头','后侧保护'])[i],role:i===1?'peek':'hold',cover:nearby?.45:.15,selectionRadius:2,layer:'position',escape:{x:n.x,y:n.y}};
  }
  const a=data.positions[area+'-stance-0'],b=data.positions[area+'-stance-1'];const peek=g.route(a,b);if(peek&&len(peek)<80){a.peekTo=area+'-stance-1';a.peekRoute=peek;b.returnTo=area+'-stance-0';}
 }
 for(const [s,p]of Object.entries(spec.sites)){data.trapSpots[sites[s]]=p.main.at(-2);for(const n of [...p.main,...p.alternate])data.deployment.atk[n]=id==='fracture'&&p.alternate.includes(n)?'t_bridge':'t_spawn';}
 data.engagementWindows=data.edges.filter(e=>Object.values(sites).includes(e.a)||Object.values(sites).includes(e.b)||e.a===spec.mid||e.b===spec.mid).map((e,i)=>({id:'window-'+i,name:nodes[e.a].name+' ↔ '+nodes[e.b].name,areas:[e.a,e.b],bounds:[Math.min(nodes[e.a].x,nodes[e.b].x)-30,Math.min(nodes[e.a].y,nodes[e.b].y)-30,Math.max(nodes[e.a].x,nodes[e.b].x)+30,Math.max(nodes[e.a].y,nodes[e.b].y)+30],layer:'engagement-window'}));
 data.posts=data.positions;data.staticVisibility={};data.sightlines=[];
 const entries=Object.entries(data.positions);for(let i=0;i<entries.length;i++){const [a,p]=entries[i];data.staticVisibility[a]={};for(const [b,q]of entries)data.staticVisibility[a][b]=g.visibleFraction(p,q);for(let j=0;j<i;j++){const [b,q]=entries[j],v=Math.max(data.staticVisibility[a][b],data.staticVisibility[b][a]);if(v>0)data.sightlines.push([a,b,v]);}}
 data.firePoints=entries.filter(([,p])=>data.engagementWindows.some(w=>w.areas.includes(p.area))).map(([id,p])=>({id:'fire-'+id,position:id,windows:data.engagementWindows.filter(w=>w.areas.includes(p.area)).map(w=>w.id),layer:'fire-point'}));
 data.layerCounts={areas:used.size,positions:entries.length,firePoints:data.firePoints.length,windows:data.engagementWindows.length,obstacles:geometry.obstacles.length};
 data.mechanismStatus={height:'ray height and traversal delay abstraction; no stacked floor physics',penetration:'disabled',void:'safe routes only; no jumping/falling'};
 for(const [suffix,value]of [['combat',data],['geometry',geometry]])fs.writeFileSync(path.join(__dirname,id+'-'+suffix+'-v6.json'),JSON.stringify(value,null,2)+'\n');
 const base=fs.readFileSync(path.join(__dirname,'../../素材库/地图风格/'+id+'-v2.svg'),'utf8'),overlay=geometry.obstacles.map(o=>`<path data-collision-id="${o.id}" d="M${o.points.map(p=>p.join(' ')).join('L')}Z" fill="${o.door?'none':'#8ca3ab'}" stroke="#78939d" stroke-width=".8"><title>${o.name}</title></path>`).join('');
 fs.writeFileSync(path.join(__dirname,'../../素材库/地图风格/'+id+'-combat-v6.svg'),base.replace(id+'-visual-v2',data.layoutVersion).replace(/<desc>.*?<\/desc>/,'<desc>源图轮廓、审核掩体与独立站位。简化机制，缓存地图补丁未核实。</desc>').replace('<g id="map-labels"',`<g id="combat-partitions">${overlay}</g><g id="map-labels"`));
 console.log(id,JSON.stringify(data.layerCounts),'coordinate corrections',corrections.length);return data;
}
if(require.main===module)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(profiles))compile(id);
module.exports={compile};


