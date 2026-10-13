// Presentation renderer copied from the user-approved equal-frame card study.
(() => {
const root='../../../素材库/';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const traitIcon=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${kind==='moment'?'M8 3h8v5a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6':'M12 3 19 6v6c0 4-7 9-7 9S5 16 5 12V6Z M9 11l2 2 4-4'}"/></svg>`;
  function traitMarkup(p){
    if(!p.trait)return '';
    return `<span class="player-trait" aria-label="特性：${esc(p.trait)}">${traitIcon('trait')}<strong>${esc(p.trait)}</strong></span>`;
  }
  function momentMarkup(p){return p.moment?`<span class="player-moment">${traitIcon('moment')}<span><small>明星时刻</small><strong>${esc(p.moment)}</strong></span></span>`:'';}
  function renderPlayer(p,key,sortKey="default"){
    const isDiamond=p.tier==='钻';
    return `<button class="balance-card" data-player="${key}" data-tier="${p.tier}" aria-label="查看 ${esc(p.name)}，${p.tier}卡，总评 ${p.rating}${p.trait?'，特性 '+esc(p.trait):''}${p.moment?'，明星时刻 '+esc(p.moment):''}"><span class="portrait-space"><img class="balance-portrait" src="${root+encodeURI(p.photo||'选手半身像/'+p.name+'.png')}" alt=""><b class="balance-rating">${p.rating}</b>${isDiamond?`<span class="diamond-mark" aria-label="钻卡">◇</span><span class="player-event">${esc(p.event)}</span>`:`<img class="balance-team" src="${root}队伍logo/${encodeURIComponent(p.team)}.png" alt="${esc(p.team)}">`}</span><strong class="balance-name">${esc(p.name)}</strong><span class="player-signature"><span class="balance-agents">${p.agents.map(a=>`<img src="${root+encodeURI(p.agentAssets?.[a]||'英雄头像/'+a+'.png')}" alt="${esc(a)}" title="${esc(a)}">`).join('')}</span>${isDiamond?momentMarkup(p):traitMarkup(p)}</span><span class="players-metrics">${[['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,key])=>`<span class="${sortKey===key?'sorted-metric':''}"><b>${p[key]}</b><small>${label}</small></span>`).join('')}</span></button>`;
  }

window.renderNavCard=renderPlayer;window.renderNavTrait=traitMarkup;
})();
