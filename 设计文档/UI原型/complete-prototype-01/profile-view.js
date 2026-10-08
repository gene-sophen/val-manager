// Fixed presentation states. Values do not read or modify a gameplay save.
(() => {
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const asset=s=>'../../../素材库/'+encodeURI(s);
 const key=p=>DEMO.key(p);
 const regions={CN:'中国',AMER:'美洲',EMEA:'欧洲中东非',PAC:'太平洋'};
 const cup='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6"/></svg>';
 function player(p,versions){
  return `<div class="profile-page" data-profile-key="${esc(key(p))}">
   <section class="profile-hero" data-tier="${p.tier}"><div class="profile-image"><img src="${asset(p.photo||'选手半身像/'+p.name+'.png')}" alt="${esc(p.name)}"><span class="profile-quality">${p.tier}卡</span></div><div class="profile-identity"><span class="profile-region">${esc(regions[p.region]||p.region)} · ${esc(p.team)}</span><h3>${esc(p.name)}</h3>${p.event?`<p class="profile-event">${esc(p.event)}</p>`:''}<div class="profile-rating"><b>${p.rating}</b><span>总评</span></div></div></section>
   ${versions.length>1?`<div class="profile-versions" role="group" aria-label="卡片版本">${versions.map(v=>`<button data-version="${esc(key(v))}" aria-pressed="${key(v)===key(p)}">${v.tier==='钻'?v.cut+' · 钻卡':v.tier+'卡'}</button>`).join('')}</div>`:''}
   <div class="profile-stats" aria-label="卡面能力">${[['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,field])=>`<div><b>${p[field]}</b><span>${label}</span></div>`).join('')}</div>
   <section class="profile-section"><h4>擅长特工</h4><div class="profile-agents">${p.agents.map((a,i)=>`<div ${i===0&&p.tier!=='铜'?'class="signature-agent"':''}><img src="${asset(p.agentAssets?.[a]||'英雄头像/'+a+'.png')}" alt=""><span>${esc(a)}${i===0&&p.tier!=='铜'?'<b class="signature-label">★ 招牌</b>':''}</span></div>`).join('')}</div></section>
   ${p.trait||p.moment?`<section class="profile-features">${p.moment?`<div class="profile-feature moment"><span>明星时刻</span><strong>${esc(p.moment)}</strong>${cup}</div>`:''}${p.trait?`<div class="profile-feature"><span>通用特性</span><strong>${esc(p.trait)}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v6c0 4-7 9-7 9S5 16 5 12V6Z M9 11l2 2 4-4"/></svg></div>`:''}</section>`:''}
   <details class="profile-records"><summary>共事与荣誉 <span aria-hidden="true">⌄</span></summary><div><section><h4>熟识 <small>各版本共享</small></h4><p>尚无已结算的共事记录</p></section><section><h4>卡片荣誉 <small>当前版本</small></h4><p>暂无荣誉</p></section></div></details>
  </div>`;
 }
 function team(players){return `<div class="team-profile-page"><section class="team-profile-identity"><img src="${asset('队伍logo/EDG.png')}" alt=""><h3>EDG</h3><span>第 01 赛年</span></section><div class="team-state-metrics">${[['羁绊',76],['状态',82],['熟练',68]].map(([label,n])=>`<div><b>${n}</b><span>${label}</span></div>`).join('')}</div><details class="team-metric-help"><summary>队伍三维 <span aria-hidden="true">⌄</span></summary><dl><div><dt>羁绊</dt><dd>五人的关系与磨合</dd></div><div><dt>状态</dt><dd>队伍当下的发挥</dd></div><div><dt>熟练</dt><dd>对战术体系的掌握</dd></div></dl></details><section class="profile-section"><h4>当前五人</h4><div class="team-profile-roster">${players.map(p=>`<button data-open-profile="${esc(key(p))}"><img src="${asset(p.photo||'选手半身像/'+p.name+'.png')}" alt=""><span>${esc(p.name)}</span></button>`).join('')}</div></section><section class="team-profile-next"><span>下一场 · BO3</span><div><strong>EDG <i>vs</i> BLG</strong><small>第一赛段 · 常规赛</small></div></section></div>`;}
 function records(kind){const relation=kind==='relationships';return `<div class="archive-record-page"><section class="records-empty"><div class="records-symbol">${relation?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87"/></svg>':cup}</div><h3>${relation?'还没有共事记录':'还没有荣誉记录'}</h3><p>${relation?'比赛结算后，记录与选手的熟识。':'获得赛事荣誉后，在这里回顾。'}</p></section><details class="record-scope"><summary>${relation?'熟识如何记录':'荣誉如何归属'} <span aria-hidden="true">⌄</span></summary><p>${relation?'同一选手的不同卡版本共享熟识。':'荣誉记在实际参赛的卡版本上。离队后保留此前获得的荣誉。'}</p></details></div>`;}
 window.NAV_PROFILE_UI={player,team,records};
})();
