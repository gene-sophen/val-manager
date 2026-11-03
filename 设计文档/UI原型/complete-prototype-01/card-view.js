// Presentation renderer copied from the user-approved equal-frame card study.
(() => {
const root='../../../素材库/';
const asset=(s,kind='full')=>window.VM_IMAGES?.asset(s,kind)||root+encodeURI(s);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const traitIcon=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${kind==='moment'?'M8 3h8v5a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6':'M12 3 19 6v6c0 4-7 9-7 9S5 16 5 12V6Z M9 11l2 2 4-4'}"/></svg>`;
  function traitMarkup(p){
    if(!p.trait)return '';
    return `<span class="player-trait" aria-label="特性：${esc(p.trait)}">${traitIcon('trait')}<strong>${esc(p.trait)}</strong></span>`;
  }
  function momentMarkup(p){return p.moment?`<span class="player-moment">${traitIcon('moment')}<span><small>明星时刻</small><strong>${esc(p.moment)}</strong></span></span>`:'';}
  function renderPlayer(p,key,sortKey='default',variant='card'){
    const isDiamond=p.tier==='钻',thumb=variant==='thumb',photo=isDiamond?'选手半身像/'+p.name+'.png':p.photo||'选手半身像/'+p.name+'.png';
    const label=(thumb?'查看完整卡面：':'查看 ')+esc(p.name)+'，'+esc(p.team)+'，'+esc(p.tier)+'卡，总评 '+p.rating+'，枪法 '+p.AIM+'，协同 '+p.SYN+'，意识 '+p.SEN,metrics=thumb?'':'<span class="players-metrics">'+[['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,key])=>`<span class="${sortKey===key?'sorted-metric':''}"><b>${p[key]}</b><small>${label}</small></span>`).join('')+'</span>';
    return `<button class="${thumb?'card-thumb':'balance-card'}" data-player="${esc(key)}" data-tier="${esc(p.tier)}" data-variant="${thumb?'thumb':'card'}" aria-label="${label}${p.trait?'，特性 '+esc(p.trait):''}${p.moment?'，明星时刻 '+esc(p.moment):''}"><span class="portrait-space"><span class="card-team-word" aria-hidden="true">${esc(p.team)}</span><img class="balance-portrait" decoding="async" loading="${thumb?'lazy':'eager'}" src="${asset(photo,thumb?'thumb':'full')}" alt="" width="320" height="360"><span class="balance-rating"><b>${p.rating}</b></span><img class="balance-team" src="${asset('队伍logo/'+p.team+'.png')}" alt="${esc(p.team)}" width="40" height="40">${isDiamond?`<span class="player-event">${esc(p.event||p.cut||'赛事珍藏')}</span>`:''}</span><span class="balance-identity"><strong class="balance-name">${esc(p.name)}</strong>${thumb?'':'<small class="balance-club">'+esc(p.team)+' · '+esc(p.tier)+'卡</small>'}</span><span class="player-signature"><span class="balance-agents">${p.agents.slice(0,3).map((a,i)=>`${i===0&&p.tier!=='铜'?'<span class="signature-portrait" title="招牌英雄：'+esc(a)+'">':''}<img src="${asset(p.agentAssets?.[a]||'英雄头像/'+a+'.png')}" alt="${esc(a)}" title="${esc(a)}" width="32" height="32" loading="lazy">${i===0&&p.tier!=='铜'?'</span>':''}`).join('')}</span>${isDiamond?momentMarkup(p):traitMarkup(p)}</span>${metrics}</button>`;
  }

window.renderNavCard=renderPlayer;window.renderPlayerCard=renderPlayer;window.renderNavTrait=traitMarkup;
})();
