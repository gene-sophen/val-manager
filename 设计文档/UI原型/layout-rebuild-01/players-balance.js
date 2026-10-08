(() => {
  'use strict';
  // Trait names are presentation snapshots from the existing card design documents.
  const goldTraits={ZmjjKK:'大场面先生',CHICHOO:'铁壁',nobody:'定海神针'};
  const players=window.VISUAL_PLAYERS.map(p=>({...p,trait:p.tier==='金'?goldTraits[p.name]:undefined}));
  const diamond={...window.cardSampleDiamond(),trait:'首杀机器',moment:'冥驹审判',event:'2023 · 东京大师赛'};
  const root='../../../素材库/';
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const query=document.getElementById('player-query');
  const sort=document.getElementById('player-sort');
  const grid=document.getElementById('players-grid');
  const scroll=document.getElementById('players-scroll');
  const dialog=document.getElementById('player-dialog');
  const storageKey='vm-layout-players-review-v1';
  let previewDiamond=location.hash==='#diamond';
  let saved={};
  try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}')||{};}catch{}
  query.value=typeof saved.query==='string'?saved.query:'';
  sort.value=['default','rating','AIM','SYN','SEN'].includes(saved.sort)?saved.sort:'default';
  const traitIcon=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${kind==='moment'?'M8 3h8v5a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6':'M12 3 19 6v6c0 4-7 9-7 9S5 16 5 12V6Z M9 11l2 2 4-4'}"/></svg>`;
  function traitMarkup(p){
    if(!p.trait)return '';
    return `<span class="player-trait" aria-label="特性：${esc(p.trait)}">${traitIcon('trait')}<strong>${esc(p.trait)}</strong></span>`;
  }
  function momentMarkup(p){return p.moment?`<span class="player-moment">${traitIcon('moment')}<span><small>明星时刻</small><strong>${esc(p.moment)}</strong></span></span>`:'';}
  function renderPlayer(p,key){
    const isDiamond=p.tier==='钻';
    return `<button class="balance-card" data-player="${key}" data-tier="${p.tier}" aria-label="查看 ${esc(p.name)}，${p.tier}卡，总评 ${p.rating}${p.trait?'，特性 '+esc(p.trait):''}${p.moment?'，明星时刻 '+esc(p.moment):''}"><span class="portrait-space"><img class="balance-portrait" src="${root+encodeURI(p.photo||'选手半身像/'+p.name+'.png')}" alt=""><b class="balance-rating">${p.rating}</b>${isDiamond?`<span class="diamond-mark" aria-label="钻卡">◇</span><span class="player-event">${esc(p.event)}</span>`:`<img class="balance-team" src="${root}队伍logo/${encodeURIComponent(p.team)}.png" alt="${esc(p.team)}">`}</span><strong class="balance-name">${esc(p.name)}</strong><span class="player-signature"><span class="balance-agents">${p.agents.map(a=>`<img src="${root}英雄头像/${encodeURIComponent(a)}.png" alt="${esc(a)}" title="${esc(a)}">`).join('')}</span>${isDiamond?momentMarkup(p):traitMarkup(p)}</span><span class="players-metrics">${[['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,key])=>`<span class="${sort.value===key?'sorted-metric':''}"><b>${p[key]}</b><small>${label}</small></span>`).join('')}</span></button>`;
  }
  function showCard(p){
    const detail=document.getElementById('player-detail');
    detail.innerHTML=`<div class="players-grid detail-card-wrap">${renderPlayer(p,'detail').replace('<button ','<article ').replace('</button>','</article>')}</div>`;
    if(p.tier==='钻')detail.insertAdjacentHTML('beforeend',`<div class="detail-traits"><span class="detail-trait-label">通用特性</span>${traitMarkup(p)}</div>`);
    dialog.showModal();
  }
  function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify({query:query.value,sort:sort.value,scroll:scroll.scrollTop}));}catch{}}
  function render(resetScroll=true){
    const term=query.value.trim().toLocaleLowerCase();
    let list=players.map((p,i)=>({...((previewDiamond&&i===0)?diamond:p),index:i})).filter(p=>`${p.name} ${p.team} ${p.agents.join(' ')}`.toLocaleLowerCase().includes(term));
    if(sort.value!=='default')list.sort((a,b)=>b[sort.value]-a[sort.value]);
    grid.dataset.sort=sort.value;
    grid.innerHTML=list.map(p=>renderPlayer(p,p.index)).join('');
    document.getElementById('player-count').textContent=list.length;
    document.getElementById('players-empty').hidden=list.length>0;
    grid.hidden=!list.length;
    if(resetScroll)scroll.scrollTop=0;
    persist();
  }
  query.addEventListener('input',()=>render());sort.addEventListener('change',()=>render());
  document.getElementById('players-search-form').addEventListener('submit',event=>{event.preventDefault();query.blur();});
  document.getElementById('clear-search').onclick=()=>{query.value='';render();query.focus();};
  grid.addEventListener('click',event=>{const button=event.target.closest('[data-player]');if(!button)return;showCard(previewDiamond&&+button.dataset.player===0?diamond:players[+button.dataset.player]);});
  document.getElementById('close-player').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  scroll.addEventListener('scroll',persist,{passive:true});window.addEventListener('pagehide',persist);
  function syncPreview(){
    document.querySelectorAll('[data-preview]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.preview==='diamond')===previewDiamond)));
  }
  document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{
    previewDiamond=button.dataset.preview==='diamond';
    history.replaceState(null,'',previewDiamond?'#diamond':location.pathname);
    query.value='';sort.value='default';syncPreview();render();
  }));
  syncPreview();
  render(false);
  const restoredScroll=Number.isFinite(saved.scroll)?saved.scroll:0;
  document.fonts.ready.then(()=>requestAnimationFrame(()=>{scroll.scrollTop=restoredScroll;}));
})();
