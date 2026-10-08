// Region routes, authored positions and engagement windows are separate layers.
// Source contours are evidence; only reviewed semantic shapes become collision.
const fs=require('node:fs'),path=require('node:path');
const {GeometryV2}=require('../geometry-v2');
const layout=require('./layouts/ascent-v2.json'),base=require('./ascent-combat-v3.json');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const mark=(x,y)=>layout.surfaceMarkContours.find(c=>Math.abs(Math.min(...c.points.map(p=>p[0]))-x)<.02&&y>=Math.min(...c.points.map(p=>p[1]))-.02&&y<=Math.max(...c.points.map(p=>p[1]))+.02)?.points;
const source=(x,y)=>[57+.853*y,43+.853*(1024-x)];
function sourceWall(id,name,a,b,height){const p=source(...a),q=source(...b),dx=q[0]-p[0],dy=q[1]-p[1],n=Math.hypot(dx,dy),nx=-dy/n*.85,ny=dx/n*.85;return {id,name,kind:'low-divider',points:[[p[0]+nx,p[1]+ny],[q[0]+nx,q[1]+ny],[q[0]-nx,q[1]-ny],[p[0]-nx,p[1]-ny]],height,sourceSegment:[a,b],evidence:'saved minimap internal partition; height is game abstraction'};}
const obstacles=[
 {id:'a-generator',name:'A 发电机',kind:'solid-cover',points:mark(217.364,620.481),height:3},
 {id:'a-dice-west',name:'A 双箱西侧',kind:'solid-cover',points:mark(157.654,635.835),height:2},
 {id:'a-dice-east',name:'A 双箱东侧',kind:'solid-cover',points:mark(168.743,639.247),height:2},
 {id:'b-entry-divider',name:'B 大与包点隔墙',kind:'solid-wall',points:mark(692.485,619.628),height:8},
 {id:'b-default-core',name:'B 默认箱',kind:'solid-cover',points:mark(743.665,661.425),height:2.5},
 {id:'b-default-north',name:'B 默认箱北沿',kind:'solid-cover',points:mark(744.518,657.16),height:2.5},
 {id:'b-default-south',name:'B 默认箱南沿',kind:'solid-cover',points:mark(747.077,670.808),height:2.5},
 {id:'market-wall-north',name:'市场通道北隔墙',kind:'solid-wall',points:rect(564.535,616.216,11.089,40.091),height:8},
 {id:'market-wall-south',name:'市场通道南隔墙',kind:'solid-wall',points:rect(564.535,673.367,11.089,12.795),height:8},
 sourceWall('mid-divider-west','中路猫道低分隔西段',[448,434],[518,434],1.1),
 sourceWall('mid-divider-west-cap','中路猫道低分隔西端',[518,434],[518,472],1.1),
 sourceWall('mid-divider-east','中路猫道低分隔东段',[555,434],[655,434],1.1),
 sourceWall('mid-divider-east-cap','中路猫道低分隔东端',[555,434],[555,472],1.1)
];
for(const o of obstacles){if(!o.points)throw Error('未找到源轮廓 '+o.id);o.evidence??='saved ascent minimap polygon/partition, canonical transform retained';}
const geometry={schemaVersion:2,width:960,height:960,gridStep:6,layoutVersion:'ascent-layered-v4',floorContours:layout.footprintContours,obstacles,levels:base.layoutVersion?[{id:'a-rafters',points:rect(124,684,202,35),height:3}]:[],mechanismStatus:{doors:'open-gap-only; dynamic operation pending',height:'low-divider-and-rafters-ray; multilevel navigation pending',penetration:'not-supported'},sourceHash:layout.reference.sha256};
const g=new GeometryV2(geometry),data=structuredClone(base);
Object.assign(data,{layoutVersion:geometry.layoutVersion,spatialVersion:4,engagementModel:'layered-v4',navigationStatus:'region-routes-with-authored-positions',visualAsset:'地图风格/ascent-layered-v4.svg',notes:'区域仅决定宏观路线；站位与交火窗口独立。定点可见性由内墙/身体射线编译，移动和动态遮挡实时核验。高度值为游戏抽象，非实测。'});
const specs={
 a_site:[['front','入口反架',184,610],['dice-west','双箱西侧',145,644],['dice-back','双箱后侧',176,662],['generator-west','发电机西侧',204,638],['generator-back','发电机后',240,646],['generator-peek','发电机侧探头',240,617],['back-corner','点内后角',141,666]],
 a_heaven:[['west','二楼西侧',148,701],['center','二楼中央',230,701],['window','二楼窗口',274,701]],
 a_short:[['tree-west','树房西侧',305,566],['tree-east','树房东侧',348,567],['door','树房门口',322,589]],
 a_main:[['lobby-corner','大厅转角',281,366],['approach','大厅前沿',302,440]],
 a_lobby:[['mouth','A 大前沿',286,484],['wall-side','A 大贴墙',270,499],['wine','酒窖入口',164,490],['site-mouth','进点转角',180,570]],
 b_site:[['stairs','台阶出点',706,645],['default-west','默认箱西侧',733,669],['default-east','默认箱东侧',773,670],['lane','包点前沿',780,646],['back','后场转角',782,704],['ct-angle','警家反架',720,716]],
 b_back:[['boat-mouth','船屋出口',818,695],['boat-cover','船屋内侧',841,714]],
 market:[['door-hold','市场门架枪',542,663],['wall-side','市场贴墙',551,681],['mid-mouth','市场中路口',501,657]],
 mid:[['courtyard-west','庭院西侧',475,491],['courtyard-east','庭院东侧',513,519],['catwalk-mouth','猫道出口',455,522],['bottom-angle','中路底反架',490,545]],
 mid_top:[['box-side','中路顶箱侧',416,332],['courtyard-angle','中路顶前沿',446,341]],
 mid_bottom:[['pizza','披萨侧入口',468,571],['market-mouth','市场入口',519,575]],
 b_main:[['lobby-west','B 厅西侧',674,427],['lobby-east','B 厅东侧',710,448]],
 b_lobby:[['mouth','B 大出口',671,560],['side','B 大贴墙',629,575],['entry-hold','隔墙外沿',678,587]],
 ct_a:[['garden','花园连接',267,760],['window-route','窗口连接',300,777]],
 ct_b:[['market-route','市场回防路',615,767],['site-route','B 点回防路',641,778]],
 ct_spawn:[['west','警家西侧',424,813],['east','警家东侧',474,841]],
 t_spawn:[['mid-route','中路集合位',550,232],['b-route','B 路集合位',595,218],['a-route','A 路集合位',504,247]]
};
data.positions={};
for(const [area,spots]of Object.entries(specs))for(const [name,label,x,y]of spots){const id=area+'-'+name,p={node:area,area,x,y,name:label,role:name.includes('peek')?'peek':'hold',cover:0,selectionRadius:2,layer:'position'};if(!g.contains(p))throw Error('站位落在墙外/掩体内，必须人工改坐标：'+id);data.positions[id]=p;}
data.positions['a_site-generator-back'].peekTo='a_site-generator-peek';
data.positions['a_site-generator-peek'].returnTo='a_site-generator-back';
data.positions['a_site-generator-back'].peekRoute=g.route(data.positions['a_site-generator-back'],data.positions['a_site-generator-peek']);
if(!data.positions['a_site-generator-back'].peekRoute)throw Error('保护位到探头位不连通');
data.positions['market-wall-side'].peekTo='market-door-hold';
data.positions['market-door-hold'].returnTo='market-wall-side';
data.positions['market-wall-side'].peekRoute=g.route(data.positions['market-wall-side'],data.positions['market-door-hold']);
if(!data.positions['market-wall-side'].peekRoute)throw Error('市场保护位到探头位不连通');
// Windows are spaces in which an encounter can be described, not visibility edges.
data.engagementWindows=[
 ['a-main-entry','A 大进点',[125,470,310,683],['a_lobby','a_site']],
 ['a-tree-entry','树房进点',[250,530,376,641],['a_short','a_site']],
 ['a-rafters','A 二楼反架',[124,603,327,722],['a_heaven','a_site']],
 ['mid-top','中路顶对庭院',[365,300,540,535],['mid_top','mid']],
 ['mid-catwalk','猫道出角',[370,390,465,570],['mid_top','mid','a_short']],
 ['mid-bottom','中路底反架',[435,480,540,636],['mid','mid_bottom']],
 ['market-entry','市场连接',[465,590,640,704],['mid_bottom','market','b_site']],
 ['b-main-entry','B 大与台阶',[625,525,820,725],['b_lobby','b_site']],
 ['b-default','B 箱侧交火',[704,638,799,738],['b_site']],
 ['b-boat','船屋出角',[740,662,851,746],['b_site','b_back']],
 ['a-retake','A 花园回防',[250,640,383,798],['ct_a','a_short','a_heaven']],
 ['b-retake','B 警家回防',[600,704,804,796],['ct_b','b_site']]
].map(([id,name,bounds,areas])=>({id,name,bounds,areas,layer:'engagement-window'}));
data.staticVisibility={};
const positions=Object.entries(data.positions);
for(const [id,p]of positions){data.staticVisibility[id]={};for(const [to,q]of positions){const v=g.visibleFraction(p,q);data.staticVisibility[id][to]=v;}}
data.firePoints=positions.filter(([id,p])=>data.engagementWindows.some(w=>w.areas.includes(p.area))).map(([id,p])=>({id:'fire-'+id,position:id,windows:data.engagementWindows.filter(w=>w.areas.includes(p.area)).map(w=>w.id),visiblePositions:Object.keys(data.staticVisibility[id]).filter(to=>to!==id&&data.staticVisibility[id][to]>0),layer:'fire-point'}));
// Compatibility facade for the existing occupation/movement code; no new route nodes.
data.posts=data.positions;data.sightlines=[];
for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const [a]=positions[i],[b]=positions[j],v=Math.max(data.staticVisibility[a][b],data.staticVisibility[b][a]);if(v>0)data.sightlines.push([a,b,v]);}
for(const [id,p]of positions){p.cover=g.obstacles.some(o=>o.kind==='solid-cover'&&Math.min(...o.points.map(v=>Math.hypot(v[0]-p.x,v[1]-p.y)))<24)?.45:.15;p.escape={x:data.nodes[p.node].x,y:data.nodes[p.node].y};}
for(const [id,n]of Object.entries(data.nodes))if(!g.contains(n))throw Error('区域中心需审核 '+id);
for(const edge of data.edges){const route=g.route(data.nodes[edge.a],data.nodes[edge.b]);if(!route)throw Error('隔墙使通道断开 '+edge.a+' -> '+edge.b);edge.route=route;edge.ticks=Math.ceil(route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0)/32);}
data.layerCounts={areas:Object.keys(data.nodes).length,positions:positions.length,firePoints:data.firePoints.length,windows:data.engagementWindows.length,obstacles:obstacles.length};
fs.writeFileSync(path.join(__dirname,'ascent-combat-v4.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'ascent-geometry-v4.json'),JSON.stringify(geometry,null,2)+'\n');
// The new collision overlay shares exactly the engine's shapes; v2/v3 art stays frozen.
const baseSvg=fs.readFileSync(path.join(__dirname,'../../素材库/地图风格/ascent-v2.svg'),'utf8');
const overlay=obstacles.map(o=>`<path data-collision-id="${o.id}" d="M${o.points.map(p=>p.join(' ')).join('L')}Z" fill="${o.kind==='low-divider'?'#c6d5ce':'#8ca3ab'}" stroke="#78939d" stroke-width=".8"><title>${o.name}</title></path>`).join('');
fs.writeFileSync(path.join(__dirname,'../../素材库/地图风格/ascent-layered-v4.svg'),baseSvg.replace('ascent-visual-v2','ascent-layered-v4').replace(/<title>.*?<\/title>/,'<title>亚海悬城 Ascent · 分层战斗样板</title>').replace(/<desc>.*?<\/desc>/,'<desc>保留源图轮廓，实体分隔叠加与 v4 引擎使用同一数据。门操作、多层导航和攻防平衡尚未完成。</desc>').replace('</svg>',`<g id="verified-partitions">${overlay}</g></svg>`));
console.log('Ascent layered v4:',data.layerCounts);
