(() => {
 const F=FLOW_UI,R=PROTOTYPE_RULES,S=SPATIAL_MATCH,prior=F.match;
 let playback=null;
 let voiceEnabled=false;
 const voiceAvailable=typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined';
 const stopVoice=()=>{if(voiceAvailable)speechSynthesis.cancel();};
 const portrait=agent=>F.asset('英雄头像/'+(agent==='K/O'?'KO.png':['幻棱','壹决'].includes(agent)?agent+'.jpg':agent+'.png'));
 const esc=F.esc;
 const teamColor=id=>id?.startsWith('A:')?'#258ab9':'#d45169';
 const syncPortraits=(target,markup)=>{
  const draft=document.createElementNS('http://www.w3.org/2000/svg','svg');draft.innerHTML=markup;
  const attributes=(a,b)=>{for(const attr of [...a.attributes])if(!b.hasAttribute(attr.name))a.removeAttribute(attr.name);for(const attr of b.attributes)if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);};
  const living=new Set();for(const next of draft.children){const id=next.dataset.unitId;living.add(id);let old=[...target.children].find(g=>g.dataset.unitId===id);if(!old){target.append(next.cloneNode(true));continue;}attributes(old,next);
   const keys=new Set();for(const child of next.children){const key=child.tagName+':'+(child.getAttribute('class')||'');keys.add(key);const current=[...old.children].find(c=>c.tagName+':'+(c.getAttribute('class')||'')===key);if(current){attributes(current,child);if(child.tagName==='title'&&current.textContent!==child.textContent)current.textContent=child.textContent;}else old.append(child.cloneNode(true));}
   for(const child of [...old.children])if(!keys.has(child.tagName+':'+(child.getAttribute('class')||'')))child.remove();
  }for(const old of [...target.children])if(!living.has(old.dataset.unitId))old.remove();
 };
 const syncFocus=()=>{const el=playback?.element,dialog=el?.querySelector('.spatial-focus');if(!dialog?.open)return;const source=el.querySelector('.spatial-map'),holder=dialog.querySelector('.spatial-focus-map');if(!holder.children.length)holder.innerHTML=source.outerHTML.replaceAll('hero-portrait-clip','hero-portrait-clip-focus').replaceAll('shot-arrow','shot-arrow-focus');else{const map=holder.querySelector('.spatial-map');for(const cls of ['spatial-effects','spatial-positions','spatial-gunfire'])map.querySelector('.'+cls).innerHTML=source.querySelector('.'+cls).innerHTML.replaceAll('shot-arrow','shot-arrow-focus');syncPortraits(map.querySelector('.spatial-units'),source.querySelector('.spatial-units').innerHTML.replaceAll('hero-portrait-clip','hero-portrait-clip-focus'));}dialog.querySelector('.spatial-focus-summary').innerHTML=el.querySelector('.spatial-legend').innerHTML;dialog.querySelector('.spatial-focus-caption').textContent=el.querySelector('.spatial-caption').textContent;};
 const playLabel=()=>{if(!playback?.element)return;playback.element.querySelectorAll('[data-spatial-play]').forEach(b=>{b.setAttribute('aria-pressed',String(playback.playing));b.textContent=playback.playing?'Ⅱ 暂停回放':playback.tick>=playback.record.ticks?'↻ 重播本分':'▶ 回放本分';});};
 const caption=(record,tick)=>{
  const seen=record.events.filter(e=>e.t>=0&&e.t<=tick),event=seen.filter(e=>['kill','plant','defuse','round_end','support_call','support_move','fallback'].includes(e.type)).at(-1);
  if(!event)return '双方正在按战术自主执行';
  if(event.type==='kill')return event.killer+' 击败 '+event.victim;
  if(event.type==='support_call')return event.unit+' 收到 '+event.site+' 点'+(event.reason==='casualty'?'减员补防':'接触支援')+'呼叫';
  if(event.type==='support_move')return event.unit+' 正在补防 '+event.site+' 点';
  if(event.type==='fallback')return event.unit+' 在 '+event.site+' 点人数劣势，后撤等待支援';
  if(event.type==='plant')return event.unit+' 在 '+event.site+' 点完成下包';
  if(event.type==='defuse')return (event.unit||'防守方')+' 完成拆包';
  return '本分结束 · '+(event.reason==='explosion'?'爆能器引爆':event.reason==='defuse'?'拆包成功':event.reason==='timeout'?'进攻超时':'交火决出胜负');
 };
 function draw(tick){
  if(!playback?.element?.isConnected)return;
  const {record,element}=playback;tick=Math.max(0,Math.min(record.ticks,tick));playback.tick=tick;
  const frame=S.frame(record,tick);
  const effects=record.events.filter(e=>e.t<=tick);
  const smokes=effects.filter(e=>e.type==='smoke'&&e.until>tick&&Number.isFinite(e.x));
  const shots=SPECTATOR_EFFECTS.shots(record.events,tick);
  const planted=effects.find(e=>e.type==='plant');
  const map=S.replayMap(record),plant=planted&&(Number.isFinite(planted.x)?{x:planted.x,y:planted.y}:map.nodes[planted.node]);
  playback.castPositions??=new Map();
  const skills=SPECTATOR_EFFECTS.abilities(record.events,tick,map,e=>{
   if(!playback.castPositions.has(e)){const f=S.frame(record,e.t),u=Object.values(f.units).find(u=>e.unitId?u.id===e.unitId:u.name===(e.unit||e.by)&&(!e.side||u.side===e.side));playback.castPositions.set(e,e.preset?map.nodes[e.node]:u?.position);}
   return playback.castPositions.get(e);
  });
  const skillMarkup=skills.map(e=>{
   const color=e.side==='atk'?'#aa8d61':'#628b9b',p=e.progress;
   if(e.visual==='smoke')return `<circle class="skill-smoke" cx="${e.x}" cy="${e.y}" r="${e.radius*(.65+.35*p)}" fill="#94a5b8" fill-opacity=".34" stroke="#8297ad" stroke-width="1.5"><title>烟雾</title></circle>`;
   if(e.visual==='zone')return `<g class="skill-zone">${e.activeAt>tick&&e.source?`<circle class="skill-projectile" cx="${e.source.x+(e.x-e.source.x)*p}" cy="${e.source.y+(e.y-e.source.y)*p}" r="4" fill="#dd9365" stroke="white" stroke-width="1.5"/>`:''}<circle cx="${e.x}" cy="${e.y}" r="${e.radius}" fill="#da9975" fill-opacity="${e.activeAt>tick?'.08':'.25'}" stroke="#c67c5b" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${e.x}" cy="${e.y}" r="${e.radius*(.4+.6*p)}" fill="none" stroke="#e7af78" stroke-opacity=".7"/><title>${e.burst?'范围爆破':'区域伤害'} · ${esc(e.unit)}</title></g>`;
   if(e.visual==='flash')return `<g class="skill-flash" opacity="${1-p}"><circle cx="${e.x}" cy="${e.y}" r="${14+22*p}" fill="#fff6c1" fill-opacity=".2" stroke="#e9cf80" stroke-width="2"/><path d="M${e.x-8} ${e.y}h16M${e.x} ${e.y-8}v16" stroke="#fff" stroke-width="2"/><title>致盲 · ${esc(e.unit)}</title></g>`;
   const label={flash:'闪光',smoke:'烟雾',molly:'区域技能',ult_molly:'区域技能',recon:'侦察',ult_recon:'侦察',trap:'警戒',turret:'炮台',heal:'治疗',revive:'复活',ult_revive:'复活',wall:'屏障',ult_wall:'幕墙',stun:'震荡',ult_stun:'震荡',dash:'位移',ult_dash:'位移',aimbuff:'强化',ult_aimbuff:'强化',decoy:'诱饵'}[e.archetype]||'技能';
   return `<g class="skill-cast" opacity="${Math.max(0,1-p)}"><circle cx="${e.x}" cy="${e.y}" r="${12+18*p}" fill="none" stroke="${color}" stroke-width="1.8" ${e.archetype.includes('recon')?'stroke-dasharray="3 5"':''}/><text x="${e.x}" y="${e.y-19}" text-anchor="middle" font-size="10" fill="${color}" stroke="#fff" stroke-width="2" paint-order="stroke">${label}${e.fumble?'·失误':''}</text><title>${esc(e.unit)} · ${esc(e.skill)}</title></g>`;
  }).join('');
  const doors=map.doorDefinitions?.map(d=>{const closed=frame.doors?.[d.id]==='closed';return `<polygon points="${d.points.map(p=>p.join(',')).join(' ')}" fill="${closed?'#9c9585':'#dce7df'}" fill-opacity="${closed?'.95':'.25'}" stroke="#827e70" stroke-width="1.5" ${closed?'':'stroke-dasharray="3 3"'}><title>${esc(d.name)} · ${closed?'关闭':'开启'}</title></polygon>`;}).join('')||'';
  const barriers=(map.physicalBarriers||[]).map(w=>`<polygon class="physical-wall" points="${w.points.map(p=>p.join(',')).join(' ')}" fill="#828c86" stroke="#f0eee3" stroke-width="1.5"><title>B 高塔楼梯侧墙</title></polygon>`).join('');
  element.querySelector('.spatial-effects').innerHTML=barriers+doors+skillMarkup+(plant?`<path d="M${plant.x},${plant.y-10} l10,10 -10,10 -10,-10z" fill="#e9bd50" stroke="white" stroke-width="2"><title>爆能器 · ${esc(planted.site)} 点</title></path>`:'');
  element.querySelector('.spatial-gunfire').innerHTML=shots.map(e=>`<g class="shot-beam" opacity="${e.opacity}"><title>${esc(e.actor)} · ${e.hit?'命中':'射击'} · ${esc(e.target)}</title><line x1="${e.start.x}" y1="${e.start.y}" x2="${e.end.x}" y2="${e.end.y}" stroke="${teamColor(e.actorId)}" stroke-width="5" stroke-opacity=".3" stroke-linecap="round"/><line x1="${e.start.x}" y1="${e.start.y}" x2="${e.end.x}" y2="${e.end.y}" stroke="${teamColor(e.actorId)}" stroke-width="1.8" stroke-linecap="round"/><circle cx="${e.x}" cy="${e.y}" r="${2+3*e.opacity}" fill="#fff4b7"/>${e.hit&&tick-e.t>.055?`<circle cx="${e.targetX}" cy="${e.targetY}" r="3" fill="#fff4b7"/>`:''}</g>`).join('');
  const arranged=playback.layout.arrange(Object.values(frame.units),playback.bounds,tick);
  element.querySelector('.spatial-positions').innerHTML=arranged.filter(u=>u.offset).map(u=>`<circle cx="${u.position.x}" cy="${u.position.y}" r="1.5" fill="${teamColor(u.id)}"/>`).join('');
  const unitMarkup=arranged.sort((a,b)=>Number(a.alive)-Number(b.alive)).map(u=>`<g data-unit-id="${esc(u.id)}" data-world-x="${u.position.x}" data-world-y="${u.position.y}" transform="translate(${u.display.x} ${u.display.y})" class="${u.id.startsWith('A:')?'own':'rival'} ${u.alive?'':'dead'} ${shots.some(e=>e.actorId===u.id)?'firing':''}"><title>${u.id.startsWith('A:')?esc(playback.ownTeam):esc(playback.awayTeam)} · ${esc(u.name)} · ${esc(u.agent||'')} · ${Math.ceil(u.hp)} HP</title>${effects.some(e=>e.unitId===u.id&&e.type==='star_moment'&&tick-e.t<3)?'<circle class="star-ring" r="17"/>':''}<circle class="portrait-shell" r="14"/><circle class="portrait-ring" r="12"/><image x="-10" y="-10" width="20" height="20" opacity=".88" href="${portrait(u.agent)}" clip-path="url(#hero-portrait-clip)"/>${u.alive?`<rect class="health-track" x="-11" y="16" width="22" height="3" rx="2"/><rect class="health-fill" x="-11" y="16" width="${22*u.hp/100}" height="3" rx="2"/>`:'<path class="death-cross" d="M-9 -9L9 9M9 -9L-9 9"/>'}</g>`).join('');
  syncPortraits(element.querySelector('.spatial-units'),unitMarkup);
  const own=Object.values(frame.units).filter(u=>u.id.startsWith('A:')),away=Object.values(frame.units).filter(u=>!u.id.startsWith('A:'));
  element.querySelector('.spatial-legend').innerHTML=`<span class="own"><i></i><b>${esc(playback.ownTeam)}</b> ${own[0]?.side==='atk'?'进攻':'防守'} · ${own.filter(u=>u.alive).length}人</span><span class="rival"><i></i><b>${esc(playback.awayTeam)}</b> ${away[0]?.side==='atk'?'进攻':'防守'} · ${away.filter(u=>u.alive).length}人</span>`;
  element.querySelector('[data-spatial-time]').value=tick;
  element.querySelector('.spatial-time').textContent=Math.floor(tick)+' / '+record.ticks+' 秒';
  element.querySelector('.spatial-header span').textContent=playback.speed+'× · '+(playback.speed===1?'原速':playback.speed<1?'慢放':'倍速');
  const lines=MATCH_COMMENTARY.at(playback.commentary,tick),latest=lines.at(-1),speechLine=latest;
  const exchange=shots.at(-1),returnFire=exchange&&shots.some(e=>e.actorId===exchange.targetId&&e.targetId===exchange.actorId);
  element.querySelector('.spatial-caption').textContent=exchange?`${returnFire?'交火':'射击'}：${exchange.actor}（${exchange.actorId?.startsWith('A:')?'我':'敌'}）${returnFire?'↔':'→'}${exchange.target}（${exchange.targetId?.startsWith('A:')?'我':'敌'}）`:latest?.text||caption(record,tick);
  element.querySelector('.commentary-feed').innerHTML=lines.slice(-3).map(e=>`<li data-commentary-id="${e.id}" data-commentary-time="${e.t}" class="${e.kind}"><time>${Math.floor(e.t)}s</time><span>${esc(e.text)}</span></li>`).join('');
  if(tick<playback.voiceTick)stopVoice();
  if(voiceEnabled&&playback.playing&&!speechSynthesis.speaking&&speechLine&&speechLine.id!==playback.spoken&&tick-speechLine.t<2){
    playback.spoken=speechLine.id;const sentence=new SpeechSynthesisUtterance(speechLine.text);sentence.lang='zh-CN';sentence.rate=1.15;sentence.onerror=()=>{const status=element.querySelector('.voice-status');if(status)status.textContent='语音暂不可用，可继续阅读解说。';};speechSynthesis.speak(sentence);
  }
  playback.voiceTick=tick;
  const done=tick>=record.ticks;
  if(playback.score){playback.score.innerHTML=done?playback.scoreHTML:`${playback.previousHome}<i>:</i>${playback.previousAway}`;}
  if(playback.report){playback.report.innerHTML=done?playback.reportHTML:`<span>第 ${record.round} 分 · 2D 推演中</span><h3>正在回放</h3><p>跳过回放可先查看本分结果。</p>`;}
  if(playback.log)playback.log.hidden=!done;
  if(done){playback.markWatched();playback.finishDock?.();}
  element.querySelector('.spatial-roster').innerHTML=Object.values(frame.units).map((u,i)=>{const profile=record.events.find(e=>e.type==='execution_profile'&&e.unitId===u.id);return `<span class="${u.alive?'':'dead'}"><img src="${portrait(u.agent)}" alt="${esc(u.agent)}" width="18" height="18"><b>${u.id.startsWith('A:')?'我':'敌'}${i%5+1}</b> ${esc(u.name)} <small>${u.alive?Math.ceil(u.hp)+' HP':'已阵亡'}</small></span>`;}).join('');
  playLabel();syncFocus();
 }
 function play(){const p=playback;if(!p?.element?.isConnected)return;if(p.playing){p.clock.pause();stopVoice();document.dispatchEvent(new Event('vm-replay-pause'));}else p.clock.play();}
 F.match=s=>{
  stopVoice();
  const view=prior(s),m=s.liveMaps?.[s.map],presentation=ROUND_PRESENTATION.mode(s);if(s.simulation!=='live'||!m?.spatial||!m.rounds.length){playback?.clock?.pause();playback=null;return view;}if(!presentation.replay){playback?.clock?.pause();playback=null;view.body=view.body.replace('class="round-report','data-round-mode="summary" class="round-report');if(presentation.key&&!s.fastForward)view.body=view.body.replace('<div class="match-team-state"','<button class="quiet-button full watch-round" data-action="watch-round">观看本分 · '+presentation.key+'</button><div class="match-team-state"');return view;}
  const record=S.replay(m),current=F.matchMap(s),v3=m.spatial.version>=3,extent=m.spatial.version===6?'x="40" y="40" width="880" height="880"':v3?'x="60" y="52" width="840" height="840"':'width="960" height="960"';
  const asset=m.spatial.version===6?S.replayMap(record).visualAsset:m.spatial.version===5?'地图风格/ascent-doors-v5.svg':m.spatial.version===4?'地图风格/ascent-layered-v4.svg':v3?'地图风格/ascent-v2.svg':'地图风格/ascent.svg';
  const widget=`<div class="spatial-replay" data-behavior="${esc(m.spatial.initial.behaviorVersion||'legacy')}"><div class="spatial-header"><b>${esc(presentation.key)} · 第 ${record.round} 分</b><button data-action="speed">${s.speed}×</button><span hidden></span></div><div class="spatial-legend"></div><svg class="spatial-map" viewBox="${m.spatial.version===6?'40 40 880 880':v3?'60 52 840 840':'95 175 790 710'}" role="img" aria-label="${esc(current.name)}实际行动回放"><defs><clipPath id="hero-portrait-clip"><circle r="10"/></clipPath></defs><image href="${F.asset(asset)}" ${extent}/><g class="spatial-effects"></g><g class="spatial-positions"></g><g class="spatial-gunfire"></g><g class="spatial-units"></g></svg><div class="spatial-map-note"><button data-spatial-expand>放大沙盘 ↗</button></div><div class="spatial-tools"><button data-spatial-play>▶ 回放本分</button><span class="spatial-time"></span></div><input type="range" data-spatial-time min="0" max="${record.ticks}" step=".25" value="0" aria-label="回放时间轴"><p class="spatial-caption" aria-live="off"></p><div class="commentary-header"><b>关键局势</b><button data-commentary-voice aria-pressed="${voiceEnabled}" ${voiceAvailable?'':'disabled'}>${voiceEnabled?'关闭语音':'开启语音'}</button></div><ol class="commentary-feed" aria-label="已发生关键局势"></ol><small class="voice-status">${voiceAvailable?'':'语音不可用'}</small><details class="plain-details"><summary>本分队员 · 生命与存活</summary><div class="spatial-roster"></div></details><dialog class="spatial-focus" aria-label="放大观战沙盘"><header><b>${esc(current.name)} · 观战沙盘</b><button data-spatial-collapse aria-label="收起沙盘">×</button></header><div class="spatial-focus-summary spatial-legend"></div><div class="spatial-focus-map"></div><footer><button data-spatial-play>▶ 回放本分</button><p class="spatial-focus-caption"></p></footer></dialog></div>`;
  view.body=view.body.replace('<div class="match-team-state"',widget+'<div class="match-team-state"').replace('class="round-report','data-round-mode="replay" class="round-report');
  view.body=view.body.replace(`我方回合表现：${m.rounds.at(-1).reason}。`,`${m.rounds.at(-1).reason}。`);
  const token=ROUND_PRESENTATION.token(s),watched=s.watchedReplay===token;
  const finishDock=()=>{const b=document.querySelector('#subpage-dock button');if(!b||b.dataset.action!=='next-round')return;if(R.mapOver(s)){b.textContent='查看本图结算 →';delete b.dataset.action;b.dataset.go='campaign/map-result';}else if(s.coachWindow){b.textContent='调整战术 →';b.dataset.action='adjust-window';}else b.textContent='下一分 · 直接看比分 →';};
  const previous=playback?.token===token?playback:null,previousTick=previous?.tick,previousPlaying=previous?.playing;playback?.clock?.pause();
  const latest=m.rounds.at(-1),p={finishDock,token,record,bounds:m.spatial.version===6?{x:40,y:40,width:880,height:880}:v3?{x:60,y:52,width:840,height:840}:{x:95,y:175,width:790,height:710},ownTeam:s.club,awayTeam:F.opponent(s),commentary:MATCH_COMMENTARY.timeline(record,S.replayMap(record)),voiceTick:previousTick||0,spoken:previous?.spoken||null,tick:0,element:null,playing:false,speed:[.5,1,2,4].includes(s.speed)?s.speed:2,previousHome:latest.home-(latest.win?1:0),previousAway:latest.away-(latest.win?0:1),markWatched:()=>{s.watchedReplay=token;}};playback=p;
  queueMicrotask(()=>{if(playback!==p)return;p.element=document.querySelector('.spatial-replay');p.score=document.querySelector('.live-score b');p.report=document.querySelector('.round-report');p.log=document.querySelector('.round-log li');p.scoreHTML=p.score?.innerHTML;p.reportHTML=p.report?.innerHTML;const r=m.rounds.at(-1),key=!watched&&presentation.replay;p.clock=REPLAY_CLOCK.create({duration:record.ticks,speed:p.speed,onTick:tick=>{if(!p.element?.isConnected){p.clock.pause();return;}if(tick<record.ticks&&p.lastDraw!=null&&tick>=p.lastDraw&&tick-p.lastDraw<.05*p.speed)return;p.lastDraw=tick;try{draw(tick);}catch(error){p.renderFailed=true;p.clock.pause();p.tick=record.ticks;if(p.score)p.score.innerHTML=p.scoreHTML;if(p.report)p.report.innerHTML=p.reportHTML;if(p.log)p.log.hidden=false;p.markWatched();p.finishDock();p.element.querySelector('.spatial-caption').textContent='回放暂不可用，可继续查看比分。';document.dispatchEvent(new Event('vm-replay-pause'));console.error(error);}},onState:state=>{p.playing=state.playing;playLabel();}});p.clock.seek(previousTick??(key&&!s.reducedMotion?0:record.ticks));if(p.element&&!p.renderFailed&&!s.reducedMotion&&(previous?previousPlaying||s.playing&&key:key))p.clock.play();});
  p.layout=previous?.layout||SPECTATOR_LAYOUT.create();
  return view;
 };
 R.replayDuration=s=>{const info=ROUND_PRESENTATION.mode(s),m=s.liveMaps?.[s.map],r=m?.rounds.at(-1);if(!info.replay||s.reducedMotion||s.coachWindow||s.watchedReplay===info.token)return 0;return Math.max(0,r.ticks-(playback?.token===info.token?playback.tick:0))*1000/([.5,1,2,4].includes(s.speed)?s.speed:2)+300;};
 R.replayPending=s=>!s.fastForward&&playback?.element?.isConnected&&playback.token===ROUND_PRESENTATION.token(s)&&playback.tick<playback.record.ticks;
 R.skipReplay=s=>{stopVoice();if(playback?.token===ROUND_PRESENTATION.token(s)){playback.clock?.seek(playback.record.ticks);playback.markWatched();}};
 document.addEventListener('click',e=>{if(e.target.closest('[data-go],[data-action],[data-preview],[data-scene]'))stopVoice();if(e.target.closest('[data-go],[data-preview],[data-scene]')){playback?.clock?.pause();playback=null;}if(e.target.closest('[data-spatial-play]'))play();if(e.target.closest('[data-spatial-expand]')){playback.element.querySelector('.spatial-focus').showModal();syncFocus();playLabel();}if(e.target.closest('[data-spatial-collapse]'))playback.element.querySelector('.spatial-focus').close();const button=e.target.closest('[data-commentary-voice]');if(button&&voiceAvailable){voiceEnabled=!voiceEnabled;button.setAttribute('aria-pressed',String(voiceEnabled));button.textContent=voiceEnabled?'关闭语音':'开启语音';stopVoice();}});
 document.addEventListener('input',e=>{if(e.target.matches('[data-spatial-time]')&&playback){stopVoice();playback.clock.seek(Number(e.target.value));playLabel();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback){stopVoice();playback.clock?.pause();}});
})();
