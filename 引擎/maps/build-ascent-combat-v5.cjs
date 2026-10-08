const fs=require('node:fs'),path=require('node:path'),{GeometryV2}=require('../geometry-v2');
const data=structuredClone(require('./ascent-combat-v4.json')),geometry=structuredClone(require('./ascent-geometry-v4.json')),layout=require('./layouts/ascent-v2.json');
const wall=layout.surfaceMarkContours.find(c=>Math.abs(c.area-212.462)<.01);
if(!wall)throw Error('B 点长条内墙源轮廓缺失');
geometry.layoutVersion='ascent-doors-v5';geometry.dynamicDoors=true;geometry.initialDoors={'b-market-door':'open'};
geometry.obstacles.push({id:'b-lane-inner-wall',name:'B 点长条内隔墙',kind:'solid-wall',points:wall.points,height:8,evidence:'saved minimap U-shaped lane partition, area 212.462; no passage across the long wall'},
 {id:'b-market-door',name:'市场机械门',kind:'door',door:true,height:8,points:[[564.535,656.307],[575.624,656.307],[575.624,673.367],[564.535,673.367]],health:500,control:{x:542,y:663},operationSeconds:1,evidence:'market wall opening; controls and duration are game abstraction'});
geometry.mechanismStatus.doors='B market: local control/open/close and physical routing; A door pending';
Object.assign(data,{spatialVersion:5,layoutVersion:geometry.layoutVersion,engagementModel:'layered-v5',externalEffectsVersion:'card-effects-1',visualAsset:'地图风格/ascent-doors-v5.svg',dynamicDoors:true,doorDefinitions:geometry.obstacles.filter(o=>o.door),notes:'B 内墙/市场门、真实身体射线与外部数值/当前 CN 卡特性；旧 v4 保留。'});
data.plantZones=layout.plantZoneContours;
for(const [id,node,name,x,y]of [['market-gate-outside','market','门外通道',590,663],['b_site-lane-door','b_site','长条门侧',688,664]])data.positions[id]={node,area:node,name,x,y,role:'hold',cover:.4,selectionRadius:2,layer:'position',escape:{x:data.nodes[node].x,y:data.nodes[node].y}};
data.posts=data.positions;
for(const id of ['market-gate-outside','b_site-lane-door'])data.firePoints.push({id:'fire-'+id,position:id,windows:data.engagementWindows.filter(w=>w.areas.includes(data.positions[id].area)).map(w=>w.id),visiblePositions:[],layer:'fire-point'});
const g=new GeometryV2(geometry),positions=Object.entries(data.positions);
for(const [id,p]of positions)if(!g.contains(p))throw Error('新增隔墙侵占站位 '+id);
for(const [id,p]of positions){data.staticVisibility[id]={};for(const [to,q]of positions)data.staticVisibility[id][to]=g.visibleFraction(p,q);}
for(const f of data.firePoints)f.visiblePositions=Object.keys(data.staticVisibility[f.position]).filter(to=>to!==f.position&&data.staticVisibility[f.position][to]>0);
data.sightlines=[];for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const [a]=positions[i],[b]=positions[j],v=Math.max(data.staticVisibility[a][b],data.staticVisibility[b][a]);if(v>0)data.sightlines.push([a,b,v]);}
for(const e of data.edges){e.route=g.route(data.nodes[e.a],data.nodes[e.b]);if(!e.route)throw Error('B 内墙造成断路 '+e.a+' '+e.b);e.ticks=Math.ceil(e.route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-e.route[i].x,p.y-e.route[i].y),0)/32);}
data.layerCounts.obstacles=geometry.obstacles.length;
data.layerCounts.positions=positions.length;data.layerCounts.firePoints=data.firePoints.length;
for(const [file,value]of [['ascent-combat-v5.json',data],['ascent-geometry-v5.json',geometry]])fs.writeFileSync(path.join(__dirname,file),JSON.stringify(value,null,2)+'\n');
const base=fs.readFileSync(path.join(__dirname,'../../素材库/地图风格/ascent-layered-v4.svg'),'utf8'),shape=wall.points.map(p=>p.join(' ')).join('L');
fs.writeFileSync(path.join(__dirname,'../../素材库/地图风格/ascent-doors-v5.svg'),base.replaceAll('ascent-layered-v4',geometry.layoutVersion).replace('分层战斗样板','墙门与交火样板').replace('</svg>',`<path data-collision-id="b-lane-inner-wall" d="M${shape}Z" fill="#8ca3ab" stroke="#78939d" stroke-width=".8"/><path d="M570 656V673" fill="none" stroke="#af9b73" stroke-width="2" stroke-dasharray="3 3"/></svg>`));
console.log('Ascent v5:',data.layerCounts,'B inner partition + dynamic market door');
