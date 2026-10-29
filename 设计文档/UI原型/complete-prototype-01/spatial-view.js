(() => {
 const F=FLOW_UI,R=PROTOTYPE_RULES,S=SPATIAL_MATCH,prior=F.match;
 let playback=null;
 let voiceEnabled=false,readingTimer=null;
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
 const setHTML=(el,html)=>{if(el&&el.__vmHTML!==html){el.__vmHTML=html;el.innerHTML=html;}};
 const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
 const syncFocus=()=>{const el=playback?.element,dialog=el?.querySelector('.spatial-focus');if(!dialog?.open)return;setText(dialog.querySelector('.spatial-focus-score'),(playback.score?.textContent||'').trim());setText(dialog.querySelector('.spatial-focus-time'),el.querySelector('.spatial-time').textContent);setText(dialog.querySelector('[data-action="speed"]'),playback.speed+'×');setHTML(dialog.querySelector('.spatial-focus-summary'),el.querySelector('.spatial-legend').innerHTML);setText(dialog.querySelector('.spatial-focus-caption'),el.querySelector('.spatial-caption').textContent);};
 const moveMap=expanded=>{const el=playback?.element,map=el?.querySelector('.spatial-map'),dialog=el?.querySelector('.spatial-focus');if(!map)return;if(expanded){dialog.querySelector('.spatial-focus-map').append(map);if(!dialog.open)dialog.showModal();}else{el.querySelector('.spatial-map-stage').append(map);if(dialog.open)dialog.close();}syncFocus();};
 const playLabel=()=>{if(!playback?.element)return;playback.element.querySelectorAll('[data-spatial-play]').forEach(b=>{const label=playback.readingPaused?'▶ 阅读后继续':playback.playing?'Ⅱ 暂停回放':playback.tick>=playback.record.ticks?'↻ 重播本分':'▶ 回放本分';b.setAttribute('aria-pressed',String(playback.playing));b.setAttribute('aria-label',label);setText(b,label);});};
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
  const {record,element}=playback;tick=Math.max(0,Math.min(record.ticks,tick));playback.tick=tick;const done=tick>=record.ticks;
  const frame=S.frame(record,tick),map=S.replayMap(record),objective=SPECTATOR_EFFECTS.objective(record.events,tick,map);
  const effects=record.events.filter(e=>e.t<=tick);
  const shots=SPECTATOR_EFFECTS.shots(record.events,tick);
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
  const spike=objective.position&&['planted','defusing','exploded'].includes(objective.state)?`<path class="objective-spike ${objective.state}" d="M${objective.position.x},${objective.position.y-10} l10,10 -10,10 -10,-10z" fill="#e9bd50" stroke="white" stroke-width="2"><title>爆能器 · ${esc(objective.site||'')}</title></path>`:'';
  setHTML(element.querySelector('.spatial-effects'),barriers+doors+skillMarkup+spike);
  setHTML(element.querySelector('.spatial-gunfire'),shots.map(e=>`<g class="shot-beam" opacity="${e.opacity}"><title>${esc(e.actor)} · ${e.hit?'命中':'射击'} · ${esc(e.target)}</title><line x1="${e.start.x}" y1="${e.start.y}" x2="${e.end.x}" y2="${e.end.y}" stroke="${teamColor(e.actorId)}" stroke-width="5" stroke-opacity=".3" stroke-linecap="round"/><line x1="${e.start.x}" y1="${e.start.y}" x2="${e.end.x}" y2="${e.end.y}" stroke="${teamColor(e.actorId)}" stroke-width="1.8" stroke-linecap="round"/><circle cx="${e.x}" cy="${e.y}" r="${2+3*e.opacity}" fill="#fff4b7"/>${e.hit&&tick-e.t>.055?`<circle cx="${e.targetX}" cy="${e.targetY}" r="3" fill="#fff4b7"/>`:''}</g>`).join(''));
  const arranged=playback.layout.arrange(Object.values(frame.units),playback.bounds,tick);
  setHTML(element.querySelector('.spatial-positions'),arranged.filter(u=>u.offset).map(u=>`<circle cx="${u.position.x}" cy="${u.position.y}" r="1.5" fill="${teamColor(u.id)}"/>`).join(''));
  const unitMarkup=arranged.sort((a,b)=>Number(a.alive)-Number(b.alive)).map(u=>`<g data-unit-id="${esc(u.id)}" data-world-x="${u.position.x}" data-world-y="${u.position.y}" transform="translate(${u.display.x} ${u.display.y})" class="${u.id.startsWith('A:')?'own':'rival'} ${u.alive?'':'dead'} ${shots.some(e=>e.actorId===u.id)?'firing':''}"><title>${u.id.startsWith('A:')?esc(playback.ownTeam):esc(playback.awayTeam)} · ${esc(u.name)} · ${esc(u.agent||'')} · ${Math.ceil(u.hp)} HP</title>${effects.some(e=>e.unitId===u.id&&e.type==='star_moment'&&tick-e.t<3)?'<circle class="star-ring" r="17"/>':''}<circle class="portrait-shell" r="14"/><circle class="portrait-ring" r="12"/><image x="-10" y="-10" width="20" height="20" opacity=".88" href="${portrait(u.agent)}" clip-path="url(#hero-portrait-clip)"/>${u.alive?`<rect class="health-track" x="-11" y="16" width="22" height="3" rx="2"/><rect class="health-fill" x="-11" y="16" width="${22*u.hp/100}" height="3" rx="2"/>`:'<path class="death-cross" d="M-9 -9L9 9M9 -9L-9 9"/>'}</g>`).join('');
  syncPortraits(element.querySelector('.spatial-units'),unitMarkup);
  const own=Object.values(frame.units).filter(u=>u.id.startsWith('A:')),away=Object.values(frame.units).filter(u=>!u.id.startsWith('A:'));
  setHTML(element.querySelector('.spatial-legend'),`<span class="own"><i></i><b>${esc(playback.ownTeam)}</b> ${own[0]?.side==='atk'?'进攻':'防守'} · ${own.filter(u=>u.alive).length}人</span><span class="rival"><i></i><b>${esc(playback.awayTeam)}</b> ${away[0]?.side==='atk'?'进攻':'防守'} · ${away.filter(u=>u.alive).length}人</span>`);
  const roster=units=>units.map(u=>`<span class="roster-unit ${u.alive?'':'dead'}"><img src="${portrait(u.agent)}" alt="${esc(u.agent)}" width="24" height="24"><span><b>${esc(u.name)}</b><small>${u.alive?Math.ceil(u.hp)+' HP':'阵亡'}</small></span></span>`).join('');
  setHTML(element.querySelector('.spatial-roster-own'),roster(own));setHTML(element.querySelector('.spatial-roster-away'),roster(away));
  const objectiveText=objective.label+(objective.remaining>0&&objective.state!=='defusing'?' · '+Math.ceil(objective.remaining)+'秒':'')+(objective.state==='defusing'?' · '+Math.round(objective.progress*100)+'%':'');
  setText(element.querySelector('.spatial-objective'),objectiveText);element.querySelector('.spatial-objective-progress').style.width=(objective.progress*100)+'%';element.querySelector('.spatial-objective-wrap').dataset.state=objective.state;
  if(!playback.scrubbing)element.querySelector('[data-spatial-time]').value=tick;
  setText(element.querySelector('.spatial-time'),Math.floor(tick)+' / '+record.ticks+' 秒');
  setText(element.querySelector('.spatial-score-context'),done?'本分结束':'本分前');
  const lines=MATCH_COMMENTARY.at(playback.commentary,tick),latest=lines.at(-1),speechLine=latest;
  const exchange=shots.at(-1),returnFire=exchange&&shots.some(e=>e.actorId===exchange.targetId&&e.targetId===exchange.actorId);
  setText(element.querySelector('.spatial-caption'),exchange?`${returnFire?'交火':'射击'}：${exchange.actor}（${exchange.actorId?.startsWith('A:')?'我':'敌'}）${returnFire?'↔':'→'}${exchange.target}（${exchange.targetId?.startsWith('A:')?'我':'敌'}）`:latest?.text||caption(record,tick));
  const feed=element.querySelector('.commentary-feed');if(feed?.closest('details')?.open)setHTML(feed,lines.slice(-5).reverse().map(e=>`<li data-commentary-id="${e.id}" data-commentary-time="${e.t}" class="${e.kind}"><time>${Math.floor(e.t)}s</time><span>${esc(e.text)}</span></li>`).join(''));
  if(tick<playback.voiceTick)stopVoice();
  if(voiceEnabled&&playback.playing&&!speechSynthesis.speaking&&speechLine&&speechLine.id!==playback.spoken&&tick-speechLine.t<2){
    playback.spoken=speechLine.id;const sentence=new SpeechSynthesisUtterance(speechLine.text);sentence.lang='zh-CN';sentence.rate=1.15;sentence.onerror=()=>{const status=element.querySelector('.voice-status');if(status)status.textContent='语音暂不可用，可继续阅读解说。';};speechSynthesis.speak(sentence);
  }
  playback.voiceTick=tick;
  if(playback.score){const html=done?playback.scoreHTML:`${playback.previousHome}<i>:</i>${playback.previousAway}`;if(playback.score.innerHTML!==html)playback.score.innerHTML=html;}
  if(playback.report){const html=done?playback.reportHTML:`<span>第 ${record.round} 分 · 正在回放</span>`;if(playback.report.innerHTML!==html)playback.report.innerHTML=html;}
  if(playback.log)playback.log.hidden=!done;
  if(done){playback.markWatched();playback.finishDock?.();if(!playback.resultShown){playback.resultShown=true;document.dispatchEvent(new Event('vm-replay-state'));}}else playback.resultShown=false;
  const details=element.querySelector('.spatial-roster')?.closest('details');if(details?.open)setHTML(element.querySelector('.spatial-roster'),Object.values(frame.units).map((u,i)=>`<span class="${u.alive?'':'dead'}"><img src="${portrait(u.agent)}" alt="${esc(u.agent)}" width="18" height="18"><b>${u.id.startsWith('A:')?'我':'敌'}${i%5+1}</b> ${esc(u.name)} <small>${u.alive?Math.ceil(u.hp)+' HP':'已阵亡'}</small></span>`).join(''));
  playLabel();syncFocus();
 }
 function play(){const p=playback;if(!p?.element?.isConnected)return;clearTimeout(readingTimer);p.readingPaused=false;if(p.playing){p.clock.pause();stopVoice();document.dispatchEvent(new Event('vm-replay-pause'));}else p.clock.play();}
 function pauseForReading(){const p=playback;if(!p?.element?.isConnected||document.hidden)return;clearTimeout(readingTimer);if(p.playing&&!p.scrubbing){p.clock.pause();p.readingPaused=true;stopVoice();playLabel();}readingTimer=setTimeout(()=>{if(!p.readingPaused)return;p.readingPaused=false;if(!document.hidden&&!p.scrubbing&&p.element?.isConnected)p.clock.play();playLabel();},320);}
 F.match=s=>{
  stopVoice();
  const view=prior(s),m=s.liveMaps?.[s.map],presentation=ROUND_PRESENTATION.mode(s);if(s.simulation!=='live'||!m?.spatial||!m.rounds.length){playback?.clock?.pause();playback=null;return view;}if(!presentation.replay){playback?.clock?.pause();playback=null;view.body=view.body.replace('class="round-report','data-round-mode="summary" class="round-report');if(presentation.key&&!s.fastForward)view.body=view.body.replace('<div class="match-team-state"','<button class="quiet-button full watch-round" data-action="watch-round">观看本分 · '+presentation.key+'</button><div class="match-team-state"');return view;}
  if(m.replay?.round!==m.rounds.length){playback?.clock?.pause();playback=null;view.body=view.body.replace('<div class="match-team-state"','<section class="replay-recovery" role="status"><p>'+ (R.replayRecoveryStatus?.(s)?.failed?'历史回放未完成，可重试或直接看战报。':'正在准备历史回放；比分与返回操作可正常使用。')+'</p><button class="quiet-button" data-action="cancel-replay">停止回放，查看战报</button></section><div class="match-team-state"');queueMicrotask(()=>document.dispatchEvent(new CustomEvent('vm-replay-needed',{detail:{token:ROUND_PRESENTATION.token(s)}})));return view;}
  const record=m.replay,current=F.matchMap(s),v3=m.spatial.version>=3,extent=m.spatial.version===6?'x="40" y="40" width="880" height="880"':v3?'x="60" y="52" width="840" height="840"':'width="960" height="960"';
  const asset=m.spatial.version===6?S.replayMap(record).visualAsset:m.spatial.version===5?'地图风格/ascent-doors-v5.svg':m.spatial.version===4?'地图风格/ascent-layered-v4.svg':v3?'地图风格/ascent-v2.svg':'地图风格/ascent.svg';
  const markerLabels={kill:'击杀',plant:'下包',defuse_checkpoint:'拆包过半',defuse:'拆包',star_moment:'明星时刻',round_end:'回合结束'},markers=record.events.filter(e=>markerLabels[e.type]).map(e=>`<button class="replay-marker ${e.type}" data-spatial-seek="${e.t}" style="left:${record.ticks?e.t/record.ticks*100:0}%" aria-label="${markerLabels[e.type]}，跳到 ${Math.floor(e.t)} 秒" title="${markerLabels[e.type]} · ${Math.floor(e.t)}秒"></button>`).join('');
  const widget=`<div class="spatial-replay" data-behavior="${esc(m.spatial.initial.behaviorVersion||'legacy')}"><div class="spatial-header"><div><b>${esc(presentation.key||"历史回放")} · 第 ${record.round} 分</b><span class="spatial-score-context">本分前</span></div><button data-action="speed" aria-label="当前 ${s.speed} 倍速，点击切换">${s.speed}×</button></div><div class="spatial-objective-wrap" data-state="idle"><span class="spatial-objective">未下包</span><i aria-hidden="true"><b class="spatial-objective-progress"></b></i></div><div class="spatial-legend"></div><div class="spatial-roster-strip"><div class="spatial-roster-own"></div><div class="spatial-roster-away"></div></div><div class="spatial-map-stage"><svg class="spatial-map" viewBox="${m.spatial.version===6?'40 40 880 880':v3?'60 52 840 840':'95 175 790 710'}" role="img" aria-label="${esc(current.name)}实际行动回放"><defs><clipPath id="hero-portrait-clip"><circle r="10"/></clipPath></defs><image href="${F.asset(asset)}" ${extent}/><g class="spatial-effects"></g><g class="spatial-positions"></g><g class="spatial-gunfire"></g><g class="spatial-units"></g></svg></div><div class="spatial-map-note"><button data-spatial-expand>放大观战 ↗</button></div><div class="spatial-tools" aria-label="观看控制"><button data-spatial-play>▶ 回放本分</button><span class="spatial-time"></span></div><div class="replay-timeline"><div class="replay-markers">${markers}</div><input type="range" data-spatial-time min="0" max="${record.ticks}" step=".25" value="0" aria-label="回放时间轴，可拖动定位"></div><p class="spatial-caption" aria-live="off"></p><details class="plain-details replay-log"><summary>完整事件与语音</summary><div class="commentary-header"><b>事件记录</b><button data-commentary-voice aria-pressed="${voiceEnabled}" ${voiceAvailable?'':'disabled'}>${voiceEnabled?'关闭语音':'开启语音'}</button></div><ol class="commentary-feed" aria-label="已发生关键局势"></ol><small class="voice-status">${voiceAvailable?'':'语音不可用'}</small></details><details class="plain-details"><summary>详细队员数据</summary><div class="spatial-roster"></div></details><dialog class="spatial-focus" aria-label="放大观战沙盘"><header><div><b>${esc(current.name)}</b><p class="spatial-focus-score"></p></div><button data-spatial-collapse aria-label="收起沙盘">×</button></header><div class="spatial-focus-tools"><button data-action="speed" aria-label="当前 ${s.speed} 倍速，点击切换">${s.speed}×</button><span class="spatial-focus-time"></span></div><div class="spatial-focus-summary spatial-legend"></div><div class="spatial-focus-map"></div><footer><button data-spatial-play>▶ 回放本分</button><p class="spatial-focus-caption"></p></footer></dialog></div>`;
  view.body=view.body.replace('<div class="match-team-state"',widget+'<div class="match-team-state"').replace('class="round-report','data-round-mode="replay" class="round-report');
  view.body=view.body.replace(`我方回合表现：${m.rounds.at(-1).reason}。`,`${m.rounds.at(-1).reason}。`);
  const token=ROUND_PRESENTATION.token(s),watched=s.watchedReplay===token;
  const finishDock=()=>{const b=document.querySelector('#subpage-dock button');if(!b||b.dataset.action!=='next-round')return;if(R.mapOver(s)){b.textContent='查看本图结算 →';delete b.dataset.action;b.dataset.go='campaign/map-result';}else if(s.coachWindow){b.textContent='调整战术 →';b.dataset.action='adjust-window';}else b.textContent='下一分 · 直接看比分 →';};
  const previous=playback?.token===token?playback:null,previousTick=previous?.tick,previousPlaying=previous?.playing,expanded=previous?.element?.querySelector('.spatial-focus')?.open;playback?.clock?.pause();
  const latest=m.rounds.at(-1),p={finishDock,token,record,bounds:m.spatial.version===6?{x:40,y:40,width:880,height:880}:v3?{x:60,y:52,width:840,height:840}:{x:95,y:175,width:790,height:710},ownTeam:s.club,awayTeam:F.opponent(s),commentary:MATCH_COMMENTARY.timeline(record,S.replayMap(record)),voiceTick:previousTick||0,spoken:previous?.spoken||null,tick:0,element:null,playing:false,speed:[.5,1,2,4].includes(s.speed)?s.speed:2,previousHome:latest.home-(latest.win?1:0),previousAway:latest.away-(latest.win?0:1),markWatched:()=>{s.watchedReplay=token;}};playback=p;
  queueMicrotask(()=>{
   if(playback!==p)return;
   p.element=document.querySelector('.spatial-replay');p.score=document.querySelector('.live-score b');p.report=document.querySelector('.round-report');p.log=document.querySelector('.round-log li');p.scoreHTML=p.score?.innerHTML;p.reportHTML=p.report?.innerHTML;
   p.element.querySelector('.spatial-focus').addEventListener('close',()=>{if(playback===p)moveMap(false);});
   const key=!watched&&presentation.replay;
   p.clock=REPLAY_CLOCK.create({duration:record.ticks,speed:p.speed,onTick:tick=>{if(!p.element?.isConnected){p.clock.pause();return;}if(tick<record.ticks&&p.lastDraw!=null&&tick>=p.lastDraw&&tick-p.lastDraw<.1*p.speed)return;p.lastDraw=tick;try{draw(tick);}catch(error){p.renderFailed=true;p.clock.pause();p.tick=record.ticks;if(p.score)p.score.innerHTML=p.scoreHTML;if(p.report)p.report.innerHTML=p.reportHTML;if(p.log)p.log.hidden=false;p.markWatched();p.finishDock();p.element.querySelector('.spatial-caption').textContent='回放暂不可用，可继续查看比分。';document.dispatchEvent(new Event('vm-replay-pause'));console.error(error);}},onState:state=>{p.playing=state.playing;playLabel();document.dispatchEvent(new Event('vm-replay-state'));}});
   p.clock.seek(previousTick??(key&&!s.reducedMotion?0:record.ticks));if(p.element&&!p.renderFailed&&!s.reducedMotion&&(previous?previousPlaying||s.playing&&key:key))p.clock.play();if(p.expanded&&p.element)moveMap(true);
  });
  p.expanded=expanded;
  p.layout=previous?.layout||SPECTATOR_LAYOUT.create();
  return view;
 };
 R.replayDuration=s=>{const info=ROUND_PRESENTATION.mode(s),m=s.liveMaps?.[s.map],r=m?.rounds.at(-1);if(!info.replay||s.reducedMotion||s.coachWindow||s.watchedReplay===info.token)return 0;const duration=playback?.token===info.token?playback.record.ticks:r?.ticks;if(!Number.isFinite(duration))return 0;return Math.max(0,duration-(playback?.token===info.token?playback.tick:0))*1000/([.5,1,2,4].includes(s.speed)?s.speed:2)+300;};
 R.replayPending=s=>!s.fastForward&&s.watchedReplay!==ROUND_PRESENTATION.token(s)&&playback?.element?.isConnected&&playback.token===ROUND_PRESENTATION.token(s)&&playback.tick<playback.record.ticks;
 R.setReplaySpeed=value=>{if(!playback)return;playback.speed=value;playback.clock?.setSpeed(value);syncFocus();};
 R.continueReplay=s=>{if(playback?.token!==ROUND_PRESENTATION.token(s))return;if(s.watchedReplay===playback.token||s.reducedMotion)playback.clock?.seek(playback.record.ticks);else playback.clock?.play();};
 R.playbackState=()=>playback?.element?.isConnected?{playing:playback.playing,tick:playback.tick,duration:playback.record.ticks,reviewing:playback.tick<playback.record.ticks}:null;
 R.skipReplay=s=>{stopVoice();if(playback?.token===ROUND_PRESENTATION.token(s)){playback.clock?.seek(playback.record.ticks);playback.markWatched();}};
 document.addEventListener('click',e=>{if(e.target.closest('[data-go],[data-action],[data-preview],[data-scene]'))stopVoice();if(e.target.closest('[data-go],[data-preview],[data-scene]')){playback?.clock?.pause();playback=null;}if(e.target.closest('[data-spatial-play]'))play();if(e.target.closest('[data-spatial-expand]'))moveMap(true);if(e.target.closest('[data-spatial-collapse]'))moveMap(false);const marker=e.target.closest('[data-spatial-seek]');if(marker&&playback){const resume=playback.playing;stopVoice();playback.clock.seek(Number(marker.dataset.spatialSeek));if(resume&&!window.VM_BOOT?.scroll?.active)playback.clock.play();playLabel();}const button=e.target.closest('[data-commentary-voice]');if(button&&voiceAvailable){voiceEnabled=!voiceEnabled;button.setAttribute('aria-pressed',String(voiceEnabled));button.textContent=voiceEnabled?'关闭语音':'开启语音';stopVoice();}});
 document.addEventListener('pointerdown',e=>{if(e.target.matches('[data-spatial-time]')&&playback){playback.scrubbing=true;playback.resumeAfterScrub=playback.playing;playback.clock.pause();}},{passive:true});
 document.addEventListener('input',e=>{if(e.target.matches('[data-spatial-time]')&&playback){stopVoice();playback.clock.seek(Number(e.target.value));playLabel();}});
 document.addEventListener('change',e=>{if(e.target.matches('[data-spatial-time]')&&playback){playback.scrubbing=false;if(playback.resumeAfterScrub&&!document.hidden&&!window.VM_BOOT?.scroll?.active)playback.clock.play();playback.resumeAfterScrub=false;playLabel();}});
 document.addEventListener('toggle',e=>{if(e.target.matches('.spatial-replay details')&&e.target.open&&playback)draw(playback.tick);},true);
 document.addEventListener('scroll',pauseForReading,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback){clearTimeout(readingTimer);playback.readingPaused=false;playback.resumeAfterScrub=false;stopVoice();playback.clock?.pause();document.dispatchEvent(new Event('vm-replay-pause'));}});
})();
