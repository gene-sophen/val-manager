// Intent routes are authored per map. They never use an enemy's hidden plan.
const choose=(xs,rng)=>xs[Math.floor(rng()*xs.length)];
const weights=(sites,target)=>Object.fromEntries(sites.map(s=>[s,target?(s===target?1:0):1/sites.length]));
function build(map,side,family,rng){
 const p=map.data.tacticalProfile,sites=Object.keys(p.sites),target=choose(sites,rng),other=choose(sites.filter(s=>s!==target),rng),s=p.sites[target],o=p.sites[other];
 const common={family,side,site:target,siteWeights:weights(sites,side==='atk'?target:null),fakeout:null,carrier:side==='atk'?0:-1,roles:[],homes:[],routes:{},limitIdx:{},regions:sites};
 if(side==='atk'){
  const timing={rush:[6,12,.9],mid:[18,30,.55],lurk:[24,35,.4],fake:[20,32,.65],contact:[24,34,.4]}[family],j=family==='rush'?0:Math.floor(rng()*5);
  Object.assign(common,{pace:{contactTick:timing[0]+j,commitTick:timing[1]+j},utilPosture:timing[2]});
  if(family==='fake')Object.assign(common,{site:other,siteWeights:weights(sites,other),carrier:1,fakeout:{fakeRegion:target,realRegion:other,fakeTick:common.pace.contactTick,hitTick:common.pace.commitTick},roles:['decoy','real','real','real','real'],homes:[s.main[0],o.main[0],o.main[0],o.main[0],o.main[0]],routes:{decoy:s.main.slice(0,-1),real:o.main},limitIdx:{decoy:s.main.length-2,real:0}});
  else if(family==='lurk')Object.assign(common,{roles:['hit','hit','hit','hit','lurk'],homes:[s.main[0],s.main[0],s.main[0],s.main[0],o.main[0]],routes:{hit:s.main,lurk:[...o.main,...o.defense.slice(1),'ct_spawn',...s.defense.slice().reverse()]},limitIdx:{hit:0,lurk:0}});
  else if(family==='mid'||family==='contact')Object.assign(common,{roles:['mid','mid','mid','flank','flank'],homes:[s.alternate[0],s.alternate[0],s.alternate[0],s.main[0],s.main[0]],routes:{mid:s.alternate,flank:s.main},limitIdx:{mid:Math.max(0,s.alternate.indexOf(p.mid)),flank:family==='contact'?1:0}});
  else Object.assign(common,{roles:['hit','hit','hit','hit','hit'],homes:Array(5).fill(s.main[0]),routes:{hit:s.main},limitIdx:{hit:0}});
  // Fracture rush uses two approach groups, not five players on one entrance.
  if(map.data.id==='fracture'&&family==='rush')Object.assign(common,{roles:['hit','hit','hit','rear','rear'],homes:[s.main[0],s.main[0],s.main[0],s.alternate[0],s.alternate[0]],routes:{hit:s.main,rear:s.alternate},limitIdx:{hit:0,rear:0}});
 }else{
  Object.assign(common,{pace:{contactTick:0,commitTick:24},utilPosture:{push:.7,hold:.5,trap:.85,flank:.5,retake:.3,stack:.8}[family],roles:Array(5).fill('home')});
  const anchors=sites.map(key=>map.siteNode(key)),back=sites.map(key=>p.sites[key].defense.at(-1));
  common.homes=(p.holdHomes||[...anchors,...back]).slice(0,5);
  if(family==='trap'||family==='stack')common.homes=[...anchors,s.defense.at(-1),map.siteNode(target)].slice(0,5);
  if(family==='retake')common.homes=[...anchors,...back,'ct_spawn'].slice(0,5);
  if(family==='push'||family==='flank'){common.homes=[p.mid,...anchors,...back].slice(0,5);common.roles[0]='roam';common.routes.roam=family==='push'?[p.mid,...s.alternate.slice().reverse().filter(n=>n!==p.mid),'t_spawn']:[p.mid,...o.main.slice().reverse(),'t_spawn'];common.limitIdx.roam=0;}
  if(['map-balance-v1','map-balance-v2'].includes(map.data.behaviorModel)){
   // Keep authored crossfire pairs. Former push/flank/retake setups replaced
   // both second guards with distant rear centroids, causing repeated 5v1 hits.
   common.homes=(map.data.balanceProfile?.holdHomes||require('./maps/balance-profiles')[map.data.id]?.holdHomes||p.holdHomes).slice();
   const flexible=common.homes.findIndex(n=>!anchors.includes(n)&&map.region(n)==='mid');
   const existingMid=common.homes.indexOf(p.mid),flex=existingMid>=0?existingMid:flexible>=0?flexible:common.homes.findIndex(n=>!anchors.includes(n));
   if(family==='trap'||family==='stack')common.homes[flex]=map.siteNode(target);
   if(family==='retake'){
    const front=common.homes.indexOf(map.siteNode(target));
    common.homes[front]=s.defense[1]||s.defense.at(-1);
   }
   if(family==='push'||family==='flank'){
    common.roles=Array(5).fill('home');common.roles[flex]='roam';
    common.homes[flex]=map.data.id==='fracture'?'ct_spawn':p.mid;
    const i=s.alternate.indexOf(p.mid);
    common.routes.roam=family==='push'&&i>=0?[p.mid,...s.alternate.slice(0,i).reverse(),'t_spawn']:[common.homes[flex],...o.main.slice(0,-1).reverse(),'t_spawn'];
    if(map.data.id==='fracture')common.routes.roam=family==='push'?['ct_spawn','a_link','a_rope','a_hall','t_spawn']:['ct_spawn','b_link','b_generator','b_canteen','b_tunnel','b_tree','t_spawn'];
   }
  }
  while(common.homes.length<5)common.homes.push('ct_spawn');
 }
 return common;
}
function aimAt(intent,map,site){const p=map.data.tacticalProfile.sites[site];if(!p)throw Error('Unknown site');intent.site=site;intent.siteWeights=weights(Object.keys(map.data.sites),site);if(intent.routes.mid)intent.routes.mid=p.alternate;if(intent.routes.flank)intent.routes.flank=p.main;if(intent.routes.hit)intent.routes.hit=p.main;if(intent.routes.rear)intent.routes.rear=p.alternate;}
function target(round,u,intent){if(u.targetSite)return u.targetSite;const sites=Object.keys(round.map.data.sites),kr=round.flags.atkRecon;let values=sites.map(s=>Math.max(0,intent.siteWeights[s]||0));if(kr&&sites.includes(kr.site)&&kr.count===0)values[sites.indexOf(kr.site)]+=.3;let roll=round.rng()*values.reduce((a,b)=>a+b,0);u.targetSite=sites.at(-1);for(let i=0;i<sites.length;i++){roll-=values[i];if(roll<=0){u.targetSite=sites[i];break;}}return u.targetSite;}
module.exports={build,aimAt,target};
