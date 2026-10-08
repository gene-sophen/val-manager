(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = path => '../../../素材库/' + path;
  const photo = p => asset(p.photo || `选手半身像/${p.name}.png`);
  const roster = window.VISUAL_PLAYERS;
  const diamond = {...roster[0], ...window.VISUAL_DIAMOND, tier:'钻', photo:'切面海报/23东京_ZmjjKK.png'};
  const cards = [...roster, ...window.PACK_EXTRA, diamond, ...window.COLLECTION_EXTRA];
  const labels = {home:'俱乐部', players:'选手', album:'卡册'};
  const descriptions = {
    home:['首页：概览与入口','确认身份、名单摘要与卡册入口的先后；比赛相关区域等待玩法定义。','身份与摘要先出现，标准高度下两组入口在首屏内；短屏可滚动。','先建立人物印象，再进入名单；卡册入口需要向下浏览。'],
    players:['选手：查阅与比较','围绕姓名、能力和特工组织；暂不添加未定义的上场、训练操作。','一行一人，便于纵向比较能力；搜索直接可见。','双列大头像，人物辨识更强；搜索收在顶部按钮中。'],
    album:['卡册：版本与收藏','围绕卡面、品质和版本组织；开包入口集中在本页。','搜索和品质常驻，卡片较紧凑；适合连续浏览、筛选。','大卡面占主要空间，筛选按需展开；适合欣赏收藏。']
  };
  const paths = {
    home:'M4 10 12 4l8 6v10H4Z M9 20v-7h6v7',
    players:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87',
    album:'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h4',
    search:'M21 21l-5-5 M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13',
    filter:'M4 6h16 M7 12h10 M10 18h4',
    arrow:'M5 12h14 M14 7l5 5-5 5'
  };
  const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
  const state = {page:labels[location.hash.slice(1)] ? location.hash.slice(1) : 'home', scheme:'L1', query:{players:'',album:''}, tier:'all', sorted:{players:false,album:false}, search:{players:false,album:false}};
  const tierName = t => t === 'all' ? '全部品质' : `${t}卡`;
  const stats = p => `<div class="micro-stats"><span>枪法<b>${p.AIM}</b></span><span>协同<b>${p.SYN}</b></span><span>意识<b>${p.SEN}</b></span></div>`;
  const mini = p => `<div class="mini-person"><img src="${esc(photo(p))}" alt=""><strong>${esc(p.name)}</strong></div>`;
  const summary = () => `<div class="metric-strip"><div><b>${roster.length}</b><small>选手</small></div><div><b>${(roster.reduce((sum,p)=>sum+p.rating,0)/roster.length).toFixed(1)}</b><small>平均能力</small></div><div><b>${cards.length}</b><small>卡牌</small></div></div>`;
  function home(layout) {
    const identity = `<div class="club-identity"><img src="${asset('队伍logo/EDG.png')}" alt="EDG"><div><strong>EDG</strong><small>CN · 俱乐部</small></div></div>`;
    const hero = `<div class="home-hero"><img src="${photo(roster[1])}" alt="CHICHOO"><img src="${photo(roster[0])}" alt="ZmjjKK"><div class="hero-caption"><strong>EDG</strong><small>CN · 俱乐部</small></div></div>`;
    const people = `<section><div class="section-title"><h4>选手</h4></div><div class="mini-roster">${roster.map(mini).join('')}</div></section>`;
    const main = `<button class="main-key" data-go="players">查看选手 ${icon('arrow')}</button>`;
    const collection = `<section class="home-collection"><div class="section-title"><h4>卡册</h4></div><div class="mini-collection">${[roster[0],roster[3],diamond].map(mini).join('')}</div><button class="secondary-key" data-go="album">查看卡册 ${icon('arrow')}</button></section>`;
    return `<div class="home-content ${layout==='L2'?'visual':''}">${layout==='L1'?identity+summary()+people+main:hero+summary()+main+people}${collection}</div>`;
  }
  function searchField() {
    return `<label class="search-field">${icon('search')}<input type="search" aria-label="搜索${labels[state.page]}" placeholder="搜索姓名、队伍" value="${esc(state.query[state.page])}" data-search></label>`;
  }
  const sort = () => `<button data-sort>${state.sorted[state.page]?'能力从高到低 ↓':'默认排序 ↕'}</button>`;
  function listPage(layout) {
    const album = state.page==='album';
    const tools = layout==='L1'
      ? `<div class="list-tools"><div class="search-row">${searchField()}</div>${album?`<div class="quick-tiers">${['all','铜','银','金','钻'].map(t=>`<button data-tier="${t}" aria-pressed="${state.tier===t}">${t==='all'?'全部':t+'卡'}</button>`).join('')}</div>`:''}${album?'':`<div class="sort-line"><span>能力 · 特工</span>${sort()}</div>`}</div>`
      : `${state.search[state.page]?`<div class="search-reveal">${searchField()}</div>`:''}<div class="visual-toolbar">${album?`<button data-filter>${tierName(state.tier)} ▾</button>`:'<small>能力 · 特工</small>'}${sort()}</div>`;
    return tools + `<div data-results class="${album?'collection-grid':layout==='L1'?'roster-list':'portrait-list'} ${layout==='L2'?'visual':''}"></div>`;
  }
  function filtered() {
    const q = state.query[state.page].trim().toLowerCase();
    const list = (state.page==='players'?roster:cards).filter(p => (!q || `${p.name} ${p.team}`.toLowerCase().includes(q)) && (state.page!=='album'||state.tier==='all'||state.tier===p.tier));
    return state.sorted[state.page] ? list.sort((a,b)=>b.rating-a.rating) : list;
  }
  function player(p, layout) {
    if (layout==='L1') return `<article class="player-row"><img src="${esc(photo(p))}" alt=""><div class="player-info"><strong>${esc(p.name)}</strong><small>${esc(p.team)} · ${esc(p.agents.join(' / '))}</small>${stats(p)}</div><div class="player-rating">${p.rating}<small>能力</small></div></article>`;
    return `<article class="player-portrait"><img src="${esc(photo(p))}" alt=""><div class="portrait-info"><div class="portrait-name"><strong>${esc(p.name)}</strong><b aria-label="能力 ${p.rating}">${p.rating}</b></div><small>${esc(p.team)} · ${esc(p.agents.join(' / '))}</small>${stats(p)}</div></article>`;
  }
  const card = p => `<article class="collection-card ${p.tier==='钻'?'diamond':''}"><div class="card-photo"><img src="${esc(photo(p))}" alt=""><b aria-label="能力 ${p.rating}">${p.rating}</b></div><div class="card-info"><strong>${esc(p.name)}</strong><div class="card-meta"><span>${esc(p.team)} · ${p.tier==='钻'?'23 东京':'基础版'}</span><small>${p.tier}卡</small></div></div></article>`;
  function updateResults() {
    if (state.page==='home') return;
    const list=filtered();
    $$('.phone').forEach(phone => {
      $('[data-results]',phone).innerHTML=list.length?list.map(p=>state.page==='players'?player(p,phone.dataset.layout):card(p)).join(''):'<p class="empty">没有匹配结果</p>';
      $('.page-count',phone).textContent=`${list.length} ${state.page==='album'?'张':'人'}`;
      $$('[data-tier]',phone).forEach(b=>b.setAttribute('aria-pressed',b.dataset.tier===state.tier));
      $$('[data-sort]',phone).forEach(b=>b.textContent=state.sorted[state.page]?'能力从高到低 ↓':'默认排序 ↕');
      const filter=$('[data-filter]',phone); if(filter) filter.textContent=tierName(state.tier)+' ▾';
    });
  }
  function render() {
    const desc=descriptions[state.page];
    $('#purpose-title').textContent=desc[0]; $('#purpose-note').textContent=desc[1];
    $('#note-L1').textContent=desc[2]; $('#note-L2').textContent=desc[3];
    $$('[data-page]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.page===state.page));
    $$('.phone').forEach(phone=>{
      const layout=phone.dataset.layout;
      phone.innerHTML=`<header class="phone-header"><h3>${labels[state.page]}${state.page!=='home'?'<span class="page-count"></span>':''}</h3>${layout==='L2'&&state.page!=='home'?`<button class="header-action" data-toggle-search aria-label="展开搜索" aria-expanded="${state.search[state.page]}">${icon('search')}</button>`:''}${state.page==='album'&&layout==='L1'?`<button class="header-action" data-sort aria-label="切换卡片排序">默认排序 ↕</button>`:''}${state.page==='album'?'<a class="header-action" href="../art-direction-03/pack.html">开包 ↗</a>':''}</header><main class="phone-body">${state.page==='home'?home(layout):listPage(layout)}</main><nav class="phone-nav" aria-label="${layout} 页面导航">${Object.entries(labels).map(([key,label])=>`<button data-go="${key}" class="${state.page===key?'active':''}" ${state.page===key?'aria-current="page"':''}>${icon(key)}${label}</button>`).join('')}</nav>`;
    });
    updateResults();
  }
  function selectScheme(scheme) {
    state.scheme=scheme;
    $$('[data-scheme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.scheme===scheme));
    $$('[data-scheme-panel]').forEach(p=>p.classList.toggle('mobile-active',p.dataset.schemePanel===scheme));
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button)return;
    const page=button.dataset.page || button.dataset.go;
    if(page) { if(state.page!==page){state.page=page;history.replaceState(null,'','#'+page);render();} return; }
    if(button.dataset.scheme) {selectScheme(button.dataset.scheme);return;}
    if(button.hasAttribute('data-sort')) {state.sorted[state.page]=!state.sorted[state.page];updateResults();return;}
    if(button.hasAttribute('data-toggle-search')) {
      state.search[state.page]=!state.search[state.page];render();
      if(state.search[state.page]) $('.phone[data-layout="L2"] [data-search]').focus();
      return;
    }
    if(button.hasAttribute('data-filter')) {
      $('#quality-options').innerHTML=['all','铜','银','金','钻'].map(t=>`<button type="button" data-tier="${t}" aria-pressed="${state.tier===t}">${tierName(t)}</button>`).join('');
      $('#quality-dialog').showModal(); return;
    }
    if(button.dataset.tier) {state.tier=button.dataset.tier;updateResults();$('#quality-dialog').close();}
  });
  document.addEventListener('input',event=>{
    if(!event.target.matches('[data-search]'))return;
    state.query[state.page]=event.target.value;
    $$('[data-search]').forEach(input=>{if(input!==event.target)input.value=event.target.value;});
    updateResults();
  });
  $('#viewport').addEventListener('change',event=>{
    const small=event.target.value==='small';
    $('#comparison').style.setProperty('--phone-width',small?'360px':'390px');
    $('#comparison').style.setProperty('--phone-height',small?'640px':'844px');
  });
  window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(labels[page]){state.page=page;render();}});
  render();selectScheme('L1');
})();
