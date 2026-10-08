const fs=require('node:fs'),path=require('node:path');
const {GeometryV2}=require('../geometry-v2');
const layout=require('./layouts/ascent-v2.json'),old=require('./ascent-navigation.json');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const geometry={schemaVersion:2,width:960,height:960,gridStep:6,layoutVersion:'ascent-combat-v3',floorContours:layout.footprintContours,obstacles:[
 {id:'a-generator',points:rect(215,620,14,37),height:3},
 {id:'a-dice-1',points:rect(156,636,11,11),height:2},
 {id:'a-dice-2',points:rect(166,643,12,11),height:2},
 {id:'b-back-box',points:rect(727,623,13,12),height:2.5},
 {id:'b-default-box',points:rect(746,655,13,21),height:2.5}
],levels:[{id:'a-rafters',points:rect(124,684,202,35),height:3}],mechanismStatus:{doors:'visual-only',height:'rafters-sight-only',penetration:'not-supported'}};
const g=new GeometryV2(geometry),data=structuredClone(old);
data.layoutVersion=geometry.layoutVersion;data.spatialVersion=3;data.strictSpatial=true;data.fireModel='timed-v3';data.informationPolicy='delayed-reports';data.tickSeconds=.25;
data.navigationStatus='polygon-routes';data.navigationSpeed={run:32,walk:20};data.visualAsset='地图风格/ascent-v2.svg';data.roundRules={maxTicks:100,plantTicks:4,spikeTicks:45,defuseTicks:7};
data.notes='真实轮廓与已核对掩体上的连续路径/视线样板；门尚未进入回合，高度目前仅 A 二楼视线。';
function closest(p,limit=30){if(g.contains(p))return p;for(let r=2;r<=limit;r+=2)for(let i=0;i<32;i++){const q={x:p.x+Math.cos(i*Math.PI/16)*r,y:p.y+Math.sin(i*Math.PI/16)*r};if(g.contains(q))return q;}throw Error('不可落位 '+JSON.stringify(p));}
data.calibration=[];for(const [id,n]of Object.entries(data.nodes)){const q=closest(n);if(q.x!==n.x||q.y!==n.y)data.calibration.push({id,from:[n.x,n.y],to:[q.x,q.y]});Object.assign(n,q);}
for(const edge of data.edges){const route=g.route(data.nodes[edge.a],data.nodes[edge.b]);if(!route)throw Error('不连通 '+edge.a+' -> '+edge.b);edge.route=route;edge.ticks=Math.ceil(route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.y-route[i].y),0)/32);}
const positions={
 a_site:[[148,619],[193,638],[203,665],[141,665],[234,667]],a_heaven:[[148,701],[218,701],[274,701]],a_short:[[317,567],[348,567],[322,589]],
 a_main:[[281,366],[302,440],[269,431]],a_lobby:[[286,484],[270,499],[164,490]],
 b_site:[[706,645],[720,672],[774,679],[782,704],[747,716]],b_back:[[818,695],[841,714]],market:[[542,646],[563,675],[515,657]],
 mid:[[475,491],[513,519],[455,522]],mid_top:[[416,332],[446,341]],mid_bottom:[[488,567],[519,575]],
 b_main:[[674,427],[719,448]],b_lobby:[[671,560],[629,575]],ct_a:[[267,760],[300,777]],ct_b:[[615,767],[641,778]],
 ct_spawn:[[434,813],[464,841]],t_spawn:[[550,232],[595,218],[504,247]]
};
data.posts={};for(const [node,spots]of Object.entries(positions))spots.forEach(([x,y],i)=>{const q=closest({x,y});data.posts[node+'_v3_'+i]={node,...q,name:data.nodes[node].name+' · '+(i+1),cover:0,role:node.endsWith('site')?'anchor':'angle'};});
data.sightlines=[];const posts=Object.entries(data.posts);for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++)if(g.canObserve(posts[i][1],posts[j][1]))data.sightlines.push([posts[i][0],posts[j][0],1]);
// Cover is a measurable nearby escape opportunity, never a damage multiplier.
for(const [id,p]of posts){const nearby=g.obstacles.filter(o=>Math.min(...o.points.map(v=>Math.hypot(v.x-p.x,v.y-p.y)))<35);p.cover=nearby.length?0.45:0.15;p.escape=data.nodes[p.node];}
fs.writeFileSync(path.join(__dirname,'ascent-combat-v3.json'),JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'ascent-geometry-v3.json'),JSON.stringify(geometry,null,2)+'\n');
console.log('Ascent v3:',Object.keys(data.posts).length,'positions,',data.edges.length,'physical routes,',data.sightlines.length,'sightlines; calibration:',data.calibration.length);
