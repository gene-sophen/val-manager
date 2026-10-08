// A deterministic commentator: facts only up to the replay time, no RNG or LLM.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MATCH_COMMENTARY=factory();})(typeof window==='object'?window:globalThis,()=>{
 const attack={rush:'爆弹强攻',mid:'默认控图',fake:'佯攻转点',lurk:'分路渗透',contact:'接触反打'},defense={push:'前压争夺',hold:'分区控图',trap:'诱敌设伏',flank:'侧翼绕后',retake:'稳守反清'};
 function timeline(record,map){
  const out=[],seen=new Map(),kills={},alive={},living=new Set(),defusers=new Set(),units=new Map(),meta=record.events.find(e=>e.type==='round_meta');
  const add=(e,text,kind='scene')=>out.push({id:record.round+':'+out.length,t:Math.max(0,e.t),text,kind});
  if(meta)add({t:0},`${meta.atkTeam} 准备执行${attack[meta.atkFamily]||meta.atkFamily}，${meta.defTeam} 以${defense[meta.defFamily]||meta.defFamily}应对。`,'tactic');
  const once=(key,e,seconds,text,kind='tactic')=>{if((seen.get(key)??-99)+seconds<=e.t){seen.set(key,e.t);add(e,text,kind);}};
  const actor=(id,name)=>{const u=units.get(id);if(u&&[...units.values()].filter(v=>v.name===name).length>1)return (u.side==='atk'?meta?.atkTeam||'进攻方':meta?.defTeam||'防守方')+'的'+name;return name;};
  for(const e of record.events){
   if(e.type==='round_start'){for(const u of e.units){units.set(u.id,u);living.add(u.id);alive[u.side]=(alive[u.side]||0)+1;}continue;}
   if(e.type==='ability'&&e.archetype==='revive'&&e.done){const u=units.get(e.unitId);if(u&&!living.has(u.id)){living.add(u.id);alive[u.side]++;add(e,`${actor(u.id,u.name)} 通过技能重新回到场上。`,'utility');}}
   if(e.type==='kill'){defusers.delete(e.victimId);defusers.delete(e.victim);kills[e.killerId]=(kills[e.killerId]||0)+1;const victim=units.get(e.victimId);if(victim&&living.has(victim.id)){living.delete(victim.id);alive[victim.side]=Math.max(0,alive[victim.side]-1);}const first=Object.values(kills).reduce((s,n)=>s+n,0)===1,n=kills[e.killerId];let text=`${actor(e.killerId,e.killer)} 击杀 ${actor(e.victimId,e.victim)}${first?'，拿到本分首杀':n>=2?'，完成'+n+'杀':''}。`;if(alive.atk===1||alive.def===1)text+=` 场上剩余 ${alive.atk} 名进攻、${alive.def} 名防守。`;add(e,text,'kill');}
   if(e.type==='support_move')once('support:'+e.site,e,8,`防守方正在向 ${e.site} 点补防，防线开始调整。`);
   if(e.type==='retake_route')once('retake-route:'+e.site,e,20,`${actor(e.unitId,e.unit)} 从侧翼加入 ${e.site} 点回防，队友从正面配合。`);
   if(e.type==='fallback')once('fallback:'+e.site,e,8,e.local?`${e.unit} 退入掩体，等待支援。`:`${e.site||'包'} 点防守人数不足，向后收缩等待支援。`);
   if(e.type==='fake_pulled')once('fake_pulled',e,10,'佯攻牵动了防线，防守开始偏转。');
   if(e.type==='fake_read')once('fake_read',e,10,'防守方识破佯攻，保留原有站位。');
   if(e.type==='door'&&map.doorDefinitions?.find(d=>d.id===e.doorId)?.kind!=='proximity')add(e,`${e.unit} ${e.state==='destroyed'?'击碎':e.state==='closed'?'关闭':'打开'}${e.name}。`,'tactic');
   if(e.type==='plant')add(e,`${e.unit} 在 ${e.site} 点完成下包，接下来是守包与回防的较量。`,'objective');
   if(e.type==='site_cleared'){const plant=record.events.find(p=>p.type==='plant'&&p.t<=e.t),checkpoint=record.events.filter(p=>p.type==='defuse_checkpoint'&&p.t<=e.t).at(-1),remaining=plant?plant.t+(plant.spikeTicks||45)-e.t:Infinity,seconds=(map.roundRules?.defuseTicks||7)-(checkpoint?.seconds||0);add(e,remaining<=seconds?`攻方已被清空，但爆能器只剩约 ${Math.max(0,remaining).toFixed(1)} 秒，来不及完成拆包。`:'攻方已被清空，防守开始抢时间接近爆能器并拆包。','objective');}
   if(e.type==='defuse_start'){if(!defusers.size)once('defuse_start',e,5,`${e.unit} ${e.seconds&&e.seconds<(map.roundRules?.defuseTicks||7)?'接着完成剩余拆包':'开始拆包'}，进攻方需要及时打断。`,'objective');defusers.add(e.unitId||e.unit);}
   if(e.type==='defuse_checkpoint')once('defuse_checkpoint',e,100,'拆包已过半，队友可以接着完成。','objective');
   if(e.type==='defuse_abort'){const unit=e.unitId||[...units.values()].find(u=>u.side==='def'&&u.name===e.unit)?.id||e.unit;defusers.delete(unit);defusers.delete(e.unit);if(!defusers.size)once('defuse_abort',e,5,'防守方中断拆包，先处理当前威胁。','objective');}
   if(e.type==='defuse')add(e,`${e.unit||'防守方'} 完成拆包，这一分由防守方拿下。`,'result');
   if(e.type==='star_moment'){const effect={'event-lock':'对方临时爆发受到压制。','second-chance':'本分射击更加稳定。','duel-chain':'连续击杀将增强火力。',rally:'全队获得追赶增益。','giant-killer':'面对强敌，火力短期提升。'}[e.kind]||'';add(e,`${actor(e.unitId,e.unit)} 触发「${e.name}」，${effect}`,'star');}
   if(e.type==='round_end'&&!(e.reason==='defuse'&&out.at(-1)?.kind==='result'))add(e,e.reason==='explosion'?(alive.atk===0&&alive.def>0?'拆包时间耗尽，爆能器引爆。':'爆能器引爆，进攻方成功守住这一分。'):e.reason==='timeout'?'时间耗尽，防守方守住这一分。':e.reason==='defuse'?'拆包结束，本分完成。':`${e.winner==='atk'?'进攻方':'防守方'}通过交火拿下这一分。`,'result');
  }
  return out.sort((a,b)=>a.t-b.t);
 }
 function at(lines,time){return lines.filter(e=>e.t<=time);}
 return {timeline,at};
});
