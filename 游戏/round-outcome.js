/* Coarse round simulation for season play. No invented spatial replay: geometry
   remains the separate tactical engine's responsibility. Shared by live/quick. */
(function(root,factory){const api=factory(typeof module==='object'?require('./team-style'):root.TEAM_STYLE,typeof module==='object'?require('./map-baseline'):root.MAP_BASELINE,typeof module==='object'?require('./stage-feedback'):root.STAGE_FEEDBACK);if(typeof module==='object')module.exports=api;else root.ROUND_OUTCOME=api;})(typeof window==='object'?window:this,function(H,M,J){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function random(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}let n=h>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const ended=(a,b)=>Math.max(a,b)>=13&&Math.abs(a-b)>=2;
 function strength(t){const ps=t.players||[];const base=ps.length?ps.reduce((n,p)=>n+.42*p.AIM+.3*p.SYN+.28*p.SEN,0)/ps.length:(t.neutralPrior??65);return base+(J?.strength(t)||0)+.025*((t.team?.羁绊??40)-40)+.02*((t.team?.熟练??50)-50)+.025*((t.coach?.战术??50)-50);}
 function expected(home,away,mapId,agentFit=0){const advantage=strength(home)-strength(away)+agentFit+.03*((home.mapKnowledge?.[mapId]??50)-(away.mapKnowledge?.[mapId]??50))+.03*((home.team?.状态??50)-(away.team?.状态??50));return clamp(1/(1+Math.exp(-advantage/12)),.08,.92);}
 function create(seed,mapId,side='attack',options={}){return {seed:String(seed),mapId,initialSide:side,home:0,away:0,rounds:[],economy:[800,800],losses:[0,0],opponentPriorities:{attack:[1,0,4,2,3],defense:[1,4,2,0,3]},...(options.model?{model:options.model}:{})};}
 function attack(m){const n=m.rounds.length;return n<12?m.initialSide==='attack':n<24?m.initialSide!=='attack':(n-24)%2===0?m.initialSide==='attack':m.initialSide!=='attack';}
 const names={attack:['爆弹强攻','默认控图','佯攻转点','分路渗透','接触反打'],defense:['前压争夺','分区控图','诱敌设伏','侧翼绕后','稳守反清']};
 function tactic(order,rng,eco){const weights=order.map((_,i)=>[.4,.26,.17,.11,.06][i]);if(eco<2400){weights[order.indexOf(4)>=0?order.indexOf(4):4]+=.2;}let r=rng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<order.length;i++){r-=weights[i];if(r<=0)return order[i];}return order[4];}
 function legacyStep(m,home,away,priorities,agentFit=0){if(ended(m.home,m.away))throw Error('地图已结束');const n=m.rounds.length,rng=random(m.seed+':'+n),atk=attack(m);if(n===12||n>=24){m.economy=n===12?[800,800]:[5000,5000];m.losses=[0,0];}const side=atk?'attack':'defense',other=atk?'defense':'attack',own=tactic(priorities[side],rng,m.economy[0]),opp=tactic(m.opponentPriorities[other],rng,m.economy[1]);const delta=(own-opp+5)%5;const matchup=delta===1?2.3:delta===2?1.1:delta===3?-1.1:delta===4?-2.3:0;const money=(m.economy[0]>=3900?2:m.economy[0]>=2400?0:-2)-(m.economy[1]>=3900?2:m.economy[1]>=2400?0:-2);const advantage=strength(home)-strength(away)+matchup*(1+.006*((home.coach?.临场??50)-(away.coach?.临场??50)))+money+agentFit+.03*((home.mapKnowledge?.[m.mapId]??50)-(away.mapKnowledge?.[m.mapId]??50))+.03*((home.team?.状态??50)-(away.team?.状态??50))+(atk?-.5:.5);const probability=clamp(1/(1+Math.exp(-advantage/12)),.08,.92),win=rng()<probability;
 const reasons=atk?(win?['突破交火获胜，后续补枪守住优势','控图取得信息，转点完成下包','下包后残局处理成功，守住时间优势']:['进点遭到反清，人数劣势无法追回','转点时被截击，关键交火失利','下包后守包失利，对方完成拆包']):(win?['防守交火占优，协同守住点位','前压获取信息，及时转防堵住进点','回防交火获胜，在时限内完成拆包']:['防线被突破，后续补枪未能挽回','未能及时转防，关键区域失守','回防交火失利，拆包时间不足']);const reason=reasons[Math.floor(rng()*reasons.length)];win?m.home++:m.away++;for(let i=0;i<2;i++){const won=i===0?win:!win;m.losses[i]=won?0:Math.min(4,m.losses[i]+1);const spend=m.economy[i]>=3900?3900:m.economy[i]>=2400?2400:m.economy[i]>1000?1000:0;m.economy[i]=clamp(m.economy[i]-spend+(won?3000:[0,1900,2400,2900,2900][m.losses[i]]),0,9000);}const round={number:n+1,win,home:m.home,away:m.away,side,ownTactic:names[side][own],opponentTactic:names[other][opp],reason,economy:money,probability};m.rounds.push(round);return round;}
 function legacyAdapt(m){const seen=m.rounds.slice(-5);if(!seen.length)return;const side=seen.at(-1).side==='attack'?'defense':'attack',counts=[0,0,0,0,0];for(const r of seen){const i=names[r.side].indexOf(r.ownTactic);if(i>=0)counts[i]++;}const most=counts.indexOf(Math.max(...counts)),counter=(most+1)%5;m.opponentPriorities[side]=[counter,...m.opponentPriorities[side].filter(i=>i!==counter)];}
 function legacySimulate(seed,home,away,mapId,priorities={attack:[0,1,2,3,4],defense:[0,1,2,3,4]}){const m=create(seed,mapId);while(!ended(m.home,m.away)){if(m.rounds.length===12||m.rounds.length===8)adapt(m);step(m,home,away,priorities);}return m;}
 function series(seed,home,away,bestOf,maps){const target=(bestOf+1)/2,results=[];let a=0,b=0;for(let i=0;i<bestOf&&a<target&&b<target;i++){const predictions={expected:expected(home,away,maps[i]),standards:{home:expected({...home,mapKnowledge:{}},away,maps[i]),away:expected(home,{...away,mapKnowledge:{}},maps[i])}},coachSnapshots={home:home.coach?.声望??50,away:away.coach?.声望??50},m=simulate(seed+':map:'+i,home,away,maps[i]);const win=m.home>m.away;win?a++:b++;results.push({mapId:maps[i],home:m.home,away:m.away,win,rounds:m.rounds,predictions,coachSnapshots,...(m.model?{tacticUsage:{home:H.usage(m.rounds,true),away:H.usage(m.rounds,false)}}:{})});}return {scoreA:a,scoreB:b,maps:results,winner:a>b?home.id:away.id,loser:a>b?away.id:home.id,bestOf};}
 function freezeInputs(m,home,away){
  if(m.model!==H.version)throw Error('未知比赛输入版本');
  if(m.styleInputs){for(const t of [m.styleInputs.home,m.styleInputs.away])H.validate(t.tacticalProfile);return m.styleInputs;}
  if(m.rounds.length)throw Error('已开始的比赛缺少冻结输入，不能重新生成');
  const snapshot=t=>({...JSON.parse(JSON.stringify(t)),tacticalProfile:H.snapshot(t.tacticalProfile)});
  const input={home:snapshot(home),away:snapshot(away),attackRate:M.attackRate(m.mapId),baselineVersion:M.data?.version||'neutral'};
  m.styleInputs=input;m.opponentPriorities=away.tacticPriorities?JSON.parse(JSON.stringify(away.tacticPriorities)):H.priorities(away.tacticalProfile);
  return input;
 }
 function step(m,home,away,priorities,agentFit=0){
  if(!m.model)return legacyStep(m,home,away,priorities,agentFit);
  if(ended(m.home,m.away))throw Error('地图已结束');
  const input=freezeInputs(m,home,away),a={...input.home,team:home.team},b={...input.away,team:away.team},n=m.rounds.length,rng=random(m.seed+':'+n),atk=attack(m);
  if(n===12||n>=24){m.economy=n===12?[800,800]:[5000,5000];m.losses=[0,0];}
  const side=atk?'attack':'defense',other=atk?'defense':'attack',own=tactic(priorities[side],rng,m.economy[0]),opp=tactic(m.opponentPriorities[other],rng,m.economy[1]);
  const match=H.matchup(side,own,opp)*clamp(1+.006*((a.coach?.临场??50)-(b.coach?.临场??50)),.65,1.35),skill=H.proficiency(a.tacticalProfile,side,own)-H.proficiency(b.tacticalProfile,other,opp);
  const money=(m.economy[0]>=3900?2:m.economy[0]>=2400?0:-2)-(m.economy[1]>=3900?2:m.economy[1]>=2400?0:-2),mapBonus=.03*((a.mapKnowledge?.[m.mapId]??50)-(b.mapKnowledge?.[m.mapId]??50)),stateBonus=.03*((a.team?.状态??50)-(b.team?.状态??50)),intercept=12*Math.log(input.attackRate/(1-input.attackRate))*(atk?1:-1);
  const probability=clamp(1/(1+Math.exp(-(strength(a)-strength(b)+match+skill+money+mapBonus+stateBonus+agentFit+intercept)/12)),.08,.92),win=rng()<probability;
  const reasons=atk?(win?['突破交火获胜，后续补枪守住优势','控图取得信息，转点完成下包','下包后残局处理成功，守住时间优势']:['进点遭到反清，人数劣势无法追回','转点时被截击，关键交火失利','下包后守包失利，对方完成拆包']):(win?['防守交火占优，协同守住点位','前压获取信息，及时转防堵住进点','回防交火获胜，在时限内完成拆包']:['防线被突破，后续补枪未能挽回','未能及时转防，关键区域失守','回防交火失利，拆包时间不足']);
  const reason=reasons[Math.floor(rng()*reasons.length)];win?m.home++:m.away++;
  for(let i=0;i<2;i++){const won=i===0?win:!win;m.losses[i]=won?0:Math.min(4,m.losses[i]+1);const spend=m.economy[i]>=3900?3900:m.economy[i]>=2400?2400:m.economy[i]>1000?1000:0;m.economy[i]=clamp(m.economy[i]-spend+(won?3000:[0,1900,2400,2900,2900][m.losses[i]]),0,9000);}
  const round={number:n+1,win,home:m.home,away:m.away,side,ownTactic:names[side][own],opponentTactic:names[other][opp],reason,economy:money,probability,model:H.version};m.rounds.push(round);return round;
 }
 function adapt(m){
  if(!m.model)return legacyAdapt(m);if(m.model!==H.version)throw Error('未知比赛输入版本');if(!m.styleInputs)return;
  const p=m.styleInputs.away.tacticalProfile,quality=.5+(m.styleInputs.away.coach?.战术??50)*.005;
  for(const side of ['attack','defense'])m.opponentPriorities[side]=H.order(p,side,H.observations(m.rounds,side),quality);
 }
 function simulate(seed,home,away,mapId,priorities){
  if(!home.tacticalProfile&&!away.tacticalProfile)return legacySimulate(seed,home,away,mapId,priorities);
  let priority=priorities||home.tacticPriorities||H.priorities(home.tacticalProfile);const m=create(seed,mapId,'attack',{model:H.version});
  while(!ended(m.home,m.away)){
   if(m.rounds.length===12||m.rounds.length===8){adapt(m);const mirrored=m.rounds.map(r=>({...r,side:r.side==='attack'?'defense':'attack',ownTactic:r.opponentTactic}));priority=Object.fromEntries(['attack','defense'].map(side=>[side,H.order(m.styleInputs.home.tacticalProfile,side,H.observations(mirrored,side),.5+(home.coach?.战术??50)*.005)]));}
   step(m,home,away,priority);
  }return m;
 }
 function reverseRound(r){return {...r,home:r.away,away:r.home,win:!r.win,side:r.side==='attack'?'defense':'attack',ownTactic:r.opponentTactic,opponentTactic:r.ownTactic,...(Number.isFinite(r.probability)?{probability:1-r.probability}:{}),...(Number.isFinite(r.economy)?{economy:-r.economy}:{})};}
 return {random,ended,strength,expected,create,attack,step,adapt,simulate,series,names,reverseRound};
});
