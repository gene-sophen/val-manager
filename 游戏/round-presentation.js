// Presentation decisions consume committed round facts only; no RNG or simulation mutations.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ROUND_PRESENTATION=factory();})(typeof window==='object'?window:globalThis,()=>{
 const token=s=>s.year+':'+s.matchToken+':'+s.map+':'+(s.liveMaps?.[s.map]?.rounds.at(-1)?.number||s.round||0);
 function keyRound(m){const r=m?.rounds?.at(-1);if(!r)return null;
  if(Math.max(r.home,r.away)>=13&&Math.abs(r.home-r.away)>=2)return '决胜回合';
  if(r.number>=25)return '加时';
  if(r.number===1||r.number===13)return '手枪局';
  const prev=m.rounds.at(-2)||{home:0,away:0};if(Math.max(r.home,r.away)===12&&Math.max(prev.home,prev.away)<12)return '首次赛点';
  const events=m.replay?.events||[],alive={atk:0,def:0},units=new Map(),clutches=new Set(),kills={};
  for(const e of events){if(e.type==='round_start')for(const u of e.units){units.set(u.id,{...u});if(u.alive!==false)alive[u.side]++;}if(e.type==='kill'){kills[e.killerId]=(kills[e.killerId]||0)+1;const u=units.get(e.victimId);if(u&&u.alive!==false){u.alive=false;alive[u.side]--;}}for(const side of ['atk','def'])if(alive[side]===1&&alive[side==='atk'?'def':'atk']>=2)clutches.add(side);}
  const end=events.find(e=>e.type==='round_end');if(clutches.has(end?.winner))return '残局逆转';
  if(Object.values(kills).some(n=>n>=4))return '四杀时刻';
  return null;
 }
 function mode(s){const m=s.liveMaps?.[s.map],key=keyRound(m);return {key,token:token(s),replay:!!m?.spatial&&!!m.rounds.length&&!!key&&!s.fastForward&&s.skippedReplay!==token(s)};}
 function brief(m){const r=m?.rounds.at(-1);if(!r)return {headline:'准备开赛',facts:[]};const events=m.replay?.events||[],end=events.find(e=>e.type==='round_end'),plant=events.find(e=>e.type==='plant');
  const reason=end?.reason,headline=reason==='defuse'?'回防拆包':reason==='explosion'?'守包成功':reason==='timeout'?'守住时间':r.win?'赢下回合':'丢掉回合';
  const facts=[];if(plant)facts.push(plant.unit+' 在 '+plant.site+' 点下包');
  if(reason==='defuse')facts.push((events.find(e=>e.type==='defuse')?.unit||'防守方')+' 完成拆包');else if(reason==='timeout')facts.push('进攻未能在时限内完成下包');else if(reason==='explosion')facts.push('爆能器引爆');else facts.push(events.length?'通过交火拿下本分':r.reason);
  return {headline,facts:facts.slice(-2)};
 }
 function advance(s,R,cards){if(s.coachWindow||s.adjusting||R.mapOver(s))return false;s.playing=false;s.fastForward=false;R.skipReplay?.(s);s.skippedReplay=s.year+':'+s.matchToken+':'+s.map+':'+((s.liveMaps?.[s.map]?.rounds.length||s.round)+1);if(s.simulation==='live')R.stepRound(s);else{const win=R.rounds(s)[s.map][s.round];s.round++;R.roundGrowth(s,win,cards);R.settleMap(s,cards);}return true;}
 function skipCurrent(s,R){const info=mode(s);if(!info.replay||s.watchedReplay===info.token)return false;s.playing=false;R.skipReplay?.(s);s.skippedReplay=info.token;return true;}
 return {token,keyRound,mode,brief,advance,skipCurrent};
});
