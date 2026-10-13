// Visual-only state. No game engine, game commands, or save files are accessed.
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const asset = path => '../../../素材库/' + path;
const players = window.VISUAL_PLAYERS;
let selectedPlayer = players[0], edition = 'standard', sorted = false, portraitView = false;
const favorites = new Set();
let toastTimer;

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2300);
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $$('[data-theme-value]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme)));
  document.querySelector('meta[name="theme-color"]').content = theme === 'paper' ? '#f0ede5' : '#171d1d';
}
function renderPlayers() {
  const ordered = sorted ? [...players].sort((a,b) => b.rating-a.rating) : players;
  $('#player-list').classList.toggle('portraits', portraitView);
  $('#player-list').innerHTML = ordered.map((p,i) => `<button class="player-row" data-action="player" data-player="${p.name}" style="--quality:var(--${{金:'gold',银:'silver',铜:'bronze'}[p.tier]})" aria-label="查看 ${p.name}，${p.tier}卡，能力 ${p.rating}"><span class="player-photo"><img src="${asset('选手半身像/'+p.name+'.png')}" alt="" loading="lazy"></span><span class="player-info"><strong>${p.name}${p.name==='ZmjjKK'?'<span class="player-tag">FOCUS</span>':''}</strong><small>${p.agents.slice(0,2).join(' / ')}</small></span><span class="player-rating">${p.rating}<small>${p.tier}卡</small></span></button>`).join('');
}
function cardURL() { return 'card-art.html?player=' + encodeURIComponent(selectedPlayer.name) + '&edition=' + edition; }
function renderDetail() {
  const p = selectedPlayer;
  $('#player-name').innerHTML = p.name + '<span class="name-dot"></span>';
  $('#player-subtitle').textContent = p.region + ' / ' + (p.team==='EDG'?'EDWARD GAMING':p.team);
  $('#file-number').textContent = String(players.indexOf(p)+1).padStart(3,'0');
  $('#player-tier').textContent = edition==='diamond'?'钻卡':p.tier+'卡';
  $('#stage-edition').textContent = edition==='diamond'?'TOKYO 2023 / SPECIAL EDITION':'STANDARD EDITION / '+String(players.indexOf(p)+1).padStart(2,'0');
  $('#card-frame').src = cardURL();
  $('#favorite-button').setAttribute('aria-pressed', String(favorites.has(p.name)));
  $('#favorite-button').setAttribute('aria-label', favorites.has(p.name)?'取消收藏选手':'收藏选手');
  $$('[data-edition]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.edition===edition));
    button.classList.toggle('selected',button.dataset.edition===edition);
    button.disabled = button.dataset.edition==='diamond' && p.name!=='ZmjjKK';
    button.title = button.disabled ? '此视觉样稿只提供 ZmjjKK 的珍藏卡示例' : '';
  });
  const values = edition==='diamond' ? window.VISUAL_DIAMOND : p;
  $('#ability-bars').innerHTML = [['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,key])=>`<div class="ability-row"><span>${label}</span><span class="ability-track"><span style="width:${values[key]}%"></span></span><strong>${values[key]}</strong></div>`).join('');
  $('#agent-pool').innerHTML = p.agents.slice(0,3).map(agent=>`<span class="agent-item"><img src="${asset('英雄头像/'+agent+'.png')}" alt="">${agent}</span>`).join('');
}
function showView(view, push=true) {
  if(!['home','squad','detail'].includes(view)) view='home';
  $$('.screen-column').forEach(column => column.classList.toggle('mobile-active', column.dataset.view===view));
  if(push && location.hash !== '#'+view) history.pushState({view},'', '#'+view);
  const target = document.querySelector(`[data-view="${view}"] .device`);
  if(matchMedia('(min-width:761px)').matches && push) {
    target.classList.add('highlight');
    setTimeout(()=>target.classList.remove('highlight'),1000);
    const focusTarget = target.querySelector('button');
    focusTarget?.focus({preventScroll:true});
  }
}
function openDialog(id) { const dialog=document.getElementById(id); if(!dialog.open) dialog.showModal(); }
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.themeValue) setTheme(button.dataset.themeValue);
  if(button.dataset.close) document.getElementById(button.dataset.close).close();
  if(button.dataset.action==='theme') setTheme(document.documentElement.dataset.theme==='paper'?'graphite':'paper');
  if(button.dataset.action==='notes') openDialog('notes-dialog');
  if(button.dataset.action==='view') showView(button.dataset.target);
  if(button.dataset.action==='player') {
    selectedPlayer=players.find(p=>p.name===button.dataset.player)||players[0]; edition='standard'; renderDetail();
    $('#detail-screen .scroll-body').scrollTop=0; showView('detail');
  }
  if(button.dataset.rosterView) {
    portraitView=button.dataset.rosterView==='portraits';
    $$('[data-roster-view]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
    renderPlayers();
  }
  if(button.dataset.edition) { edition=button.dataset.edition;renderDetail(); }
});
$('#spec-button').addEventListener('click',()=>openDialog('notes-dialog'));
$('#sort-button').addEventListener('click',()=>{sorted=!sorted;$('#sort-button').innerHTML=(sorted?'能力优先':'默认顺序')+' <svg><use href="#sort"/></svg>';renderPlayers();});
$('#favorite-button').addEventListener('click',()=>{const name=selectedPlayer.name;if(favorites.has(name)) favorites.delete(name);else favorites.add(name);renderDetail();notify(favorites.has(name)?'已标记喜欢 · 本次预览有效':'已取消标记');});
$('#view-art-button').addEventListener('click',()=>{$('#full-card-frame').src=cardURL();openDialog('art-dialog');});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
window.addEventListener('popstate',()=>{const open=$('dialog[open]');if(open)open.close();showView(location.hash.slice(1),false);});
const params=new URLSearchParams(location.search);
setTheme(params.get('theme')==='paper'?'paper':'graphite');
renderPlayers();renderDetail();showView(location.hash.slice(1)||'home',false);
