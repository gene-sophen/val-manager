// Authored against 素材库/地图官方/ascent-plan.webp (960 × 960).
// Region corridors, not a pixel-accurate collision mesh or elevation model.
const fs = require('node:fs'), path = require('node:path');
const old = require('./ascent.json'), data = structuredClone(old);
const points = { t_spawn:[552,237], a_main:[282,370], a_lobby:[288,492], a_site:[180,643],
 a_heaven:[180,700], a_short:[332,570], mid_top:[423,337], mid:[518,493], mid_bottom:[490,568],
 market:[542,655], b_main:[684,404], b_lobby:[673,565], b_site:[745,681], b_back:[829,700],
 ct_spawn:[442,813], ct_a:[270,770], ct_b:[620,771] };
const names = { t_spawn:'进攻出生点', a_main:'A大厅', a_lobby:'A大', a_heaven:'A二楼', a_short:'A连接', mid_top:'中路顶', mid_bottom:'中路底', ct_spawn:'防守出生点' };
const bends = [
 [[340,237],[340,325],[282,325]], [], [[145,492],[145,570],[180,570]], [],
 [[240,570],[240,643]], [[480,237],[480,290],[423,290]],
 [[423,440],[460,440],[460,493]], [[365,493],[365,570]], [], [[490,655]],
 [[628,237],[628,404]], [[724,404],[724,480],[700,480],[700,565]],
 [[673,610],[745,610]], [[829,681]], [[595,655],[595,620],[745,620]],
 [[380,813],[380,770]], [[442,771]], [[270,700],[180,700]], [[270,700]],
 [[620,710],[745,710]], [[620,655]], [[442,695],[490,695]], [[490,620],[620,620]]
];
const pt = p => ({x:p[0],y:p[1]});
for(const [id,p] of Object.entries(points)) Object.assign(data.nodes[id], pt(p), {name:names[id]||data.nodes[id].name});
data.view={width:960,height:960};
data.navigationStatus='region-corridors';
data.combatProfile='campaign-ballistics';
data.defenseSupport='contact-casualty';
data.spatialFire='shared-los';
// Pixel scale for the 960px layout. Shared by both sides, not a defensive buff.
data.navigationSpeed={run:36,walk:24};
// Remove legacy calibration that intentionally shortened defensive retakes.
data.roundRules={spikeTicks:45,defuseTicks:7};
data.deployment={atk:{},def:{mid:'mid_bottom',a_lobby:'a_site',b_lobby:'b_site'}};
data.source='素材库/地图官方/ascent-plan.webp';
data.notes='按官方图校准的区域导航；墙体细节、高低差、门与箱体未完整复刻。';
data.edges.forEach((e,i)=>{e.route=[pt(points[e.a]),...bends[i].map(pt),pt(points[e.b])];});
for(const [id,p] of Object.entries(data.posts)) {
 const prior=old.nodes[p.node],current=data.nodes[p.node];
 p.x=current.x+(p.x-prior.x)*.28;p.y=current.y+(p.y-prior.y)*.28;
 p.name=current.name+'站位';
}
// Rooms are areas, not narrow centerline corridors. In particular Market must
// have an actual line into B; a route-only floor incorrectly blinds its anchor.
const walkable=[
 {x:125,y:604,width:123,height:79}, {x:125,y:685,width:201,height:34},
 {x:240,y:546,width:129,height:55}, {x:341,y:650,width:40,height:140},
 {x:590,y:596,width:210,height:139}, {x:590,y:534,width:110,height:65},
 {x:510,y:614,width:80,height:70}, {x:430,y:477,width:110,height:110},
 {x:470,y:566,width:67,height:70}
];
for(const n of Object.values(data.nodes)) walkable.push({x:n.x-16,y:n.y-16,width:32,height:32});
for(const e of data.edges)for(let i=1;i<e.route.length;i++) {
 const a=e.route[i-1],b=e.route[i];
 walkable.push({x:Math.min(a.x,b.x)-12,y:Math.min(a.y,b.y)-12,width:Math.abs(a.x-b.x)+24,height:Math.abs(a.y-b.y)+24});
}
const geometry={strictFloorSight:true,walkable,walls:[],waypoints:[]};
fs.writeFileSync(path.join(__dirname,'ascent-navigation.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'ascent-navigation-geometry.json'),JSON.stringify(geometry,null,2)+'\n');
