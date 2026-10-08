// Serializable boundary adapter around the existing action engine.
const { matchGen } = require('../引擎/match');
const { GameMap } = require('../引擎/gamemap');
const { snapshotAt } = require('../引擎/snapshot');
const agents = require('./agent-selection');
const mapData = require('../引擎/maps/ascent-navigation.json');
const geometry = require('../引擎/maps/ascent-navigation-geometry.json');
const mapDataV3=require('../引擎/maps/ascent-combat-v3.json');
const geometryV3=require('../引擎/maps/ascent-geometry-v3.json');
const mapDataV4=require('../引擎/maps/ascent-combat-v4.json');
const geometryV4=require('../引擎/maps/ascent-geometry-v4.json');
const mapDataV5=require('../引擎/maps/ascent-combat-v5.json');
const geometryV5=require('../引擎/maps/ascent-geometry-v5.json');
const external=require('../引擎/external-effects');
const registry=require('../引擎/maps/combat-registry');
const keys = { attack:['rush','mid','fake','lurk','contact'], defense:['push','hold','trap','flank','retake'] };
const names = { attack:['爆弹强攻','默认控图','佯攻转点','分路渗透','接触反打'], defense:['前压争夺','分区控图','诱敌设伏','侧翼绕后','稳守反清'] };
const clone = x => JSON.parse(JSON.stringify(x));
const cache = new WeakMap();
const map = new GameMap(mapData, geometry);
const mapV3=new GameMap(mapDataV3,geometryV3);
const mapV4=new GameMap(mapDataV4,geometryV4);
const mapV5=new GameMap(mapDataV5,geometryV5);
const versionData=(v,id='ascent')=>v===6?registry.get(id).data:v===5?mapDataV5:v===4?mapDataV4:v===3?mapDataV3:mapData;
// Old independent previews keep their original deterministic input journal.
const legacyData=clone(mapData);delete legacyData.defenseSupport;delete legacyData.spatialFire;delete legacyData.navigationSpeed;delete legacyData.roundRules;
const legacyMap=new GameMap(legacyData,geometry);
function random(seed) { let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return require('../引擎/rng').mulberry32(h>>>0); }
function weights(priority) {
 const out={};for(const [side,dest] of [['attack','atk'],['defense','def']]) {
  const order=priority[side];if(!Array.isArray(order)||order.length!==5||new Set(order).size!==5||order.some(i=>!Number.isInteger(i)||i<0||i>4))throw Error('战术顺序必须包含五类');
  out[dest]=Object.fromEntries(order.map((k,i)=>[keys[side][k],[.4,.26,.17,.11,.06][i]]));
 }return out;
}
function teamState(t,mapId) {return {bond:t.team?.羁绊??40,form:t.team?.状态??50,mastery:t.team?.熟练??50,map:t.mapKnowledge?.[mapId]??50};}
function pack(t, priority, selected, full = false, effects = false, mapId='ascent') {
 if(t.players?.length!==5)throw Error('空间推演需要完整的五人数据');
 if(new Set(t.players.map(p=>String(p.playerId||p.name).normalize('NFKC').trim().toLowerCase())).size!==5)throw Error('同一选手不能重复上场');
const cardKey=p=>p.cardId||p.name+'-'+p.tier+(p.tier==='钻'?'-'+p.cut:'');
const players=t.players.map(p=>full?({...clone(p),cardId:cardKey(p),agents:[...(p.agents||[])]}):({name:p.name,cardId:cardKey(p),cut:p.cut,AIM:p.AIM,SYN:p.SYN,SEN:p.SEN,agents:[...(p.agents||[])],tier:p.tier}));
 const allowed=require('../引擎/agents').allAgents();
 const picks=selected ? players.map(p=>selected[p.cardId]||selected[p.name+'-'+p.tier+(p.tier==='钻'?'-'+p.cut:'')]||selected[p.name+'-'+p.tier]) : agents.recommend(players,allowed,mapId).agents;
 if(new Set(picks).size!==5||picks.some(a=>!allowed.includes(a)))throw Error('特工必须有效且不重复');
 const state=teamState(t,mapId);
 const coach=effects?{tactics:t.coach?.战术??t.coach?.tactics??50,clutch:t.coach?.临场??t.coach?.clutch??50,prestige:t.coach?.声望??t.coach?.prestige??50}:{tactics:t.coach?.战术??50,clutch:t.coach?.临场??50,prestige:t.coach?.声望??50};
 if(effects){external.state(state);for(const p of players){external.base(p,state,coach);p.cardEffect=external.cardEffect(p);}for(const value of Object.values(coach))if(!Number.isFinite(value)||value<0||value>100)throw Error('教练三维必须为 0–100');}
 return {name:t.id,players,executionState:state,agentAssignments:Object.fromEntries(players.map((p,i)=>[p.cardId,picks[i]])),tactics:weights(priority),coach,...(effects?{effectsVersion:external.registry.version}:{ }),...(t.tacticalProfile?{tacticalProfile:require('./team-style').snapshot(t.tacticalProfile)}:{})};
}
function available(m,home,away) {return (m.mapId==='ascent'||registry.ids.includes(m.mapId))&&home.players?.length===5&&away.players?.length===5;}
function initialize(m,home,away,priority,selected,options={}) {
 if(!available(m,home,away))throw Error('该地图或阵容尚未接入空间模型');
 if(m.rounds.length)throw Error('不能将已开始的简化地图切换为精细推演');
 const version=options.version??(m.mapId==='ascent'?2:6);if(![2,3,4,5,6].includes(version))throw Error('未知空间模型版本');
 if(version===6&&!registry.ids.includes(m.mapId)||version!==6&&m.mapId!=='ascent')throw Error('地图与模型版本不匹配');
 if(options.behaviorVersion&&!balanceVersion(options.behaviorVersion,m.mapId)||['ascent-balance-3','ascent-balance-4','ascent-balance-5'].includes(options.behaviorVersion)&&(m.mapId!=='ascent'||version!==5))throw Error('行为版本与地图不匹配');
 m.spatial={version,initial:{...(version===6?{mapId:m.mapId}:{}),...(version>=5?{behaviorVersion:options.behaviorVersion||(m.mapId==='ascent'?'ascent-balance-4':balancedMaps.includes(m.mapId)?m.mapId+'-balance-1':'objective-2')}:{}),home:pack(home,priority,selected,version>=3,version>=5,m.mapId),away:pack(away,away.tacticalProfile?require('./team-style').priorities(away.tacticalProfile):{attack:[1,0,4,2,3],defense:[1,4,2,0,3]},null,version>=3,version>=5,m.mapId),seed:m.seed,side:m.initialSide,...(version>=3?{layoutVersion:versionData(version,m.mapId).layoutVersion,ruleVersion:'spatial-'+version}:{}),...(version>=5?{effectsVersion:external.registry.version}:{})},commands:[],boundary:null};
}
const balancedMaps=require('./content/map-balance-status.json').approvedMaps; // Independent preview defaults, not a campaign release flag.
function campaignPolicy(){
 const status=require('./content/map-balance-status.json');if(status.releaseGate!==true)return null;
 const ids=['ascent',...registry.ids];
 if(!status.campaignReleaseId||!status.candidateEvidence||ids.some(id=>!(status.campaignApprovedMaps||status.approvedMaps).includes(id)||!balanceVersion(status.candidateVersions?.[id],id)))throw Error('正式空间引擎发布配置未完整验收');
 return clone({releaseId:status.campaignReleaseId,versions:Object.fromEntries(ids.map(id=>[id,status.candidateVersions[id]]))});
}
const balanceVersion=(v,id)=>v==='objective-2'||['ascent-balance-3','ascent-balance-4','ascent-balance-5'].includes(v)&&id==='ascent'||registry.ids.includes(id)&&[id+'-balance-1',id+'-balance-2',id+'-balance-3'].includes(v);
const behaviorMaps=new WeakMap();
function behaviorMap(map,version){
 if(version==null)return map;if(!balanceVersion(version,map.data.id))throw Error('行为版本不匹配，不能改写旧局');
 if(!behaviorMaps.has(map))behaviorMaps.set(map,new Map());const revisions=behaviorMaps.get(map);
 if(!revisions.has(version)){
  const modern=version==='ascent-balance-5'||version.endsWith('-balance-3')&&map.data.id!=='ascent';
  const multi=/-(?:balance)-(?:1|2|3)$/.test(version)&&map.data.id!=='ascent';
  const physical=multi?require('../引擎/maps/balance-geometry').prepare(map):map;
  const copy=Object.create(physical);copy.data={...physical.data,...(multi&&/-balance-[23]$/.test(version)?{balanceProfile:require('../引擎/maps/balance-profiles-v2')[map.data.id]}:{}),objectiveModel:'defuse-v2',...(['ascent-balance-3','ascent-balance-4','ascent-balance-5'].includes(version)?{behaviorModel:version==='ascent-balance-3'?'ascent-balance-v1':'ascent-balance-v2'}:multi?{behaviorModel:version.endsWith('-balance-1')?'map-balance-v1':'map-balance-v2'}:{}),...(modern?{autonomyModel:'agents-1'}:{})};
  revisions.set(version,modern?require('../引擎/combat-space').prepare(copy):copy);
 }return revisions.get(version);
}

function session(m) {
 if(![1,2,3,4,5,6].includes(m.spatial.version))throw Error('未知空间模型版本，不能改写旧局');
 const initial=clone(m.spatial.initial),s={events:[],boundary:null,g:null};
 for(const team of [initial.home,initial.away])if(team.tacticalProfile)require('./team-style').validate(team.tacticalProfile);
 if(m.spatial.version===6&&initial.mapId!==m.mapId)throw Error('存档地图 ID 不匹配');
 if(m.spatial.version>=3&&initial.layoutVersion!==versionData(m.spatial.version,m.mapId).layoutVersion)throw Error('地图版本不匹配，不能改写旧局');
 if(m.spatial.version>=3&&initial.ruleVersion!=='spatial-'+m.spatial.version)throw Error('规则版本不匹配，不能改写旧局');
 if(m.spatial.version>=5&&initial.effectsVersion!==external.registry.version)throw Error('特性版本不匹配，不能改写旧局');
 if(initial.behaviorVersion!=null&&!balanceVersion(initial.behaviorVersion,m.mapId))throw Error('行为版本不匹配，不能改写旧局');
 if(['ascent-balance-3','ascent-balance-4','ascent-balance-5'].includes(initial.behaviorVersion)&&(m.mapId!=='ascent'||m.spatial.version!==5))throw Error('行为版本与地图不匹配');
 if(cache.has(m))return cache.get(m);
 s.g=matchGen({teamA:initial.home,teamB:initial.away,map:behaviorMap(m.spatial.version===6?registry.get(m.mapId):m.spatial.version===1?legacyMap:m.spatial.version===5?mapV5:m.spatial.version===4?mapV4:m.spatial.version===3?mapV3:map,initial.behaviorVersion),rng:random(initial.seed),logger:e=>s.events.push(e),playerCoach:'A',matchCfg:{initialAttacker:initial.side==='attack'?'A':'B',observationPolicy:'public-events'}});
 for(let i=0;i<m.rounds.length;i++) {s.events=[];const next=s.g.next(i?m.spatial.commands[i-1]:undefined);if(next.done)throw Error('回放提前结束');s.boundary=next.value;const prior=m.rounds[i];if(prior.home!==s.boundary.scoreA||prior.away!==s.boundary.scoreB)throw Error('存档推演结果不一致');}
 cache.set(m,s);return s;
}
function step(m,home,away,priority,selected) {
 if(!m.spatial)initialize(m,home,away,priority,selected);
 if(m.spatial.boundary?.matchOver)throw Error('地图已结束');
 const s=session(m),command={teamState:teamState(home,m.mapId)};
 if(m.spatial.pendingTimeout)command.timeout=true;
 if(s.boundary?.canAdjust||command.timeout)command.weights=weights(priority);
 s.events=[];
 const next=s.g.next(m.rounds.length?command:undefined);
 if(next.done)throw Error('地图已结束');
 if(m.rounds.length)m.spatial.commands.push(clone(command));
 delete m.spatial.pendingTimeout;
 s.boundary=next.value;
 m.spatial.boundary=clone(s.boundary);
 const number=m.rounds.length+1,events=s.events.filter(e=>e.round===number),meta=events.find(e=>e.type==='round_meta'),end=events.find(e=>e.type==='round_end'),atk=meta.atkTeam===home.id;
 m.home=s.boundary.scoreA;m.away=s.boundary.scoreB;
 m.economy=[s.boundary.economy.A/5,s.boundary.economy.B/5];
 const win=s.boundary.result.winner===(atk?'atk':'def'),side=atk?'attack':'defense',other=atk?'defense':'attack';
 const round={number,win,home:m.home,away:m.away,side,ownTactic:names[side][keys[side].indexOf(atk?meta.atkFamily:meta.defFamily)],opponentTactic:names[other][keys[other].indexOf(atk?meta.defFamily:meta.atkFamily)],reason:end.summary,ticks:end.t,engine:m.spatial.version===6?'spatial-'+m.mapId+'-v6':m.spatial.version>=3?'spatial-ascent-v'+m.spatial.version:'spatial-ascent-v1'};
 m.rounds.push(round);
 // Only the current round's events are saved; input journal reconstructs history.
 m.replay={round:number,ticks:end.t,events:clone(events),...((m.mapId==='ascent'?m.spatial.initial.behaviorVersion==='ascent-balance-5':/-balance-[123]$/.test(m.spatial.initial.behaviorVersion||''))?{behaviorVersion:m.spatial.initial.behaviorVersion}:{}),...(m.spatial.version>=3?{layoutVersion:versionData(m.spatial.version,m.mapId).layoutVersion}:{})};
 return round;
}
function requestTimeout(m) {
 const b=m.spatial?.boundary;
 if(!b?.canRequestTimeout||m.spatial.pendingTimeout)return false;
 m.spatial.pendingTimeout=true;return true;
}
function replay(m,number=m.rounds.length) {
 if(!m.spatial||!Number.isInteger(number)||number<1||number>m.rounds.length)throw Error('无效回合');
 if(m.replay?.round===number)return clone(m.replay);
 const copy=clone(m);copy.rounds=copy.rounds.slice(0,number);const s=session(copy),events=s.events.filter(e=>e.round===number),end=events.find(e=>e.type==='round_end');return {round:number,ticks:end.t,events:clone(events),...((m.mapId==='ascent'?m.spatial.initial.behaviorVersion==='ascent-balance-5':/-balance-[123]$/.test(m.spatial.initial.behaviorVersion||''))?{behaviorVersion:m.spatial.initial.behaviorVersion}:{}),...(m.spatial.version>=3?{layoutVersion:versionData(m.spatial.version,m.mapId).layoutVersion}:{})};
}
function replayMap(record){const multi=registry.byLayout(record.layoutVersion);if(multi)return record.behaviorVersion?behaviorMap(registry.get(multi.id),record.behaviorVersion).data:multi;if(record.layoutVersion?.endsWith('-combat-v6'))throw Error('未知地图布局，不能用 Ascent 替代');if(record.layoutVersion===mapDataV5.layoutVersion)return record.behaviorVersion?behaviorMap(mapV5,record.behaviorVersion).data:mapDataV5;if(record.layoutVersion===mapDataV4.layoutVersion)return mapDataV4;if(record.layoutVersion===mapDataV3.layoutVersion)return mapDataV3;return mapData;}
function frame(record,tick) {return snapshotAt(record.events,Math.max(0,Math.min(record.ticks,tick)),replayMap(record));}
function inspectVisibility(version,from,to,doors={},mapId='ascent',behaviorVersion){const selected=version===6?behaviorMap(registry.get(mapId),behaviorVersion):version===5?behaviorMap(mapV5,behaviorVersion):version===4?mapV4:mapV3,a=selected.posts[from],b=selected.posts[to];if(!a||!b)throw Error('未知站位');return {visible:selected.geometry.visibleFraction(a,b,{doors}),trace:selected.geometry.shootTrace(a,b,{doors})};}
function simulate(seed,home,away,priority,options={}){const m=require('./round-outcome').create(seed,options.mapId||'ascent',options.side||'attack');initialize(m,home,away,priority,options.selected,{version:options.version??(m.mapId==='ascent'?3:6),behaviorVersion:options.behaviorVersion});if(options.awayPriority)m.spatial.initial.away.tactics=weights(options.awayPriority);while(!m.spatial.boundary?.matchOver){step(m,home,away,priority);options.onRound?.(m.replay,m);}return m;}
const inputContract=Object.freeze({version:'spatial-inputs-1',players:['AIM','SYN','SEN','tier','cut','agents'],team:['羁绊','状态','熟练'],coach:['战术','临场','声望'],map:'mapKnowledge[mapId]',tactics:['attack','defense'],profile:'team-style-1',effects:external.registry.version,range:[0,100],prestige:'growth-only; no direct shot bonus',freeze:'players, coach, heroes, profiles frozen per map; team/map state updated at round boundary'});
module.exports={campaignPolicy,inputContract,validateInputs:(team,priority,selected,mapId='ascent')=>pack(team,priority,selected,true,true,mapId),combatGeometry:(id,behaviorVersion)=>behaviorMap(id==='ascent'?mapV5:registry.get(id),behaviorVersion).geometry,mapIds:registry.ids,combatMap:id=>registry.get(id).data,available,initialize,step,requestTimeout,replay,frame,weights,mapData,mapDataV3,mapDataV4,mapDataV5,replayMap,inspectVisibility,simulate};
