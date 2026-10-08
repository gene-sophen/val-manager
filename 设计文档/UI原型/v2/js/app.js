/* ================= 路由 + 各屏渲染与交互 ================= */
const NOANIM = location.hash.includes('shot') || matchMedia('(prefers-reduced-motion: reduce)').matches;
if(NOANIM) document.body.classList.add('no-anim');

const SCREENS = ['lobby','squad','more','draft','transfer','result','match'];
const ALIAS = {journey:'lobby', lineup:'squad', coach:'squad', draw:'lobby'};
const AFTER_SHOW = {squad: drawSynLines};
function go(name){ location.hash = 'screen=' + name; }
function route(){
  let raw = (location.hash.match(/screen=(\w+)/) || [])[1] || 'lobby';
  const q = new URLSearchParams(location.hash.slice(1));
  let name = ALIAS[raw] || raw;
  if(raw === 'draw' && q.get('tab') === 'album') name = 'more'; // 旧图鉴入口 → 更多页
  if(!SCREENS.includes(name)) name = 'lobby';
  $$('.screen').forEach(s => s.classList.remove('on'));
  $('#screen-' + name).classList.add('on');
  // 结算页为打断式全屏：隐藏顶栏/底栏
  $('#topbar').style.display = name === 'result' ? 'none' : '';
  $('#tabbar').style.display = name === 'result' ? 'none' : '';
  $$('#tabbar .tab').forEach(t => t.classList.toggle('on', t.dataset.screen === name));
  if(AFTER_SHOW[name]) requestAnimationFrame(AFTER_SHOW[name]);
  if(name === 'lobby'){
    $('#screen-lobby').scrollTop = 0;
    if(!state.lobbySeen){ state.lobbySeen = true; $('#stage5').classList.add('entering'); }
    animateMapLines();
  }
  setTimeout(() => {
    // 旧 hash 别名副作用
    if(raw === 'coach'){ setSquadSeg('coach'); if(q.get('tab') === 'career') setCoachTab('career'); }
    if(raw === 'journey'){ if(q.has('flipped')){ state.regMatchDone = true; renderLobby(); renderJourney(); } scrollLobbyToMap(); }
    if(raw === 'lineup' && q.get('sheet')) openSheetForce(q.get('sheet'));
    if(raw === 'draw' && !q.get('tab')){ openPackOverlay(); if(q.has('opened')) doOpenPack(); }
    applyDemoParams(name, q);
  }, 30);
}
// 截图验证用的状态直达参数（正常浏览无影响），如 #screen=lobby&flipped=1
function applyDemoParams(name, q){
  if(name === 'lobby' && q.has('flipped')){
    state.regMatchDone = true; renderLobby(); renderJourney();
    setTimeout(scrollLobbyToMap, 30);
  }
  if(name === 'lobby' && q.has('map')) setTimeout(scrollLobbyToMap, 10);
  if(name === 'squad' && q.get('seg') === 'coach') setSquadSeg('coach');
  if(name === 'squad' && q.get('ctab') === 'career'){ setSquadSeg('coach'); setCoachTab('career'); }
  if(name === 'squad' && q.get('sheet')) openSheetForce(q.get('sheet'));
  if(name === 'match' && q.get('tab') === 'cmd') $('.mt[data-mtab="cmd"]').click();
  if(name === 'match' && q.has('focus')) $('#sandbox').click();
  if(name === 'transfer' && q.has('preview')){ tfPickNew = 'Rossy'; tfPickOld = 'heybay'; tryPreview(); }
  if(name === 'draft' && q.has('pick')){ state.draftSel = DRAFT_POOL.slice(0, 5); refreshDraftPicks(); }
  if(q.get('pack') === 'open'){ openPackOverlay(); doOpenPack(); }
}
window.addEventListener('hashchange', route);
$$('#tabbar .tab').forEach(t => t.addEventListener('click', () => go(t.dataset.screen)));

/* ================= 顶栏 ================= */
function syncTopbar(){
  $('#tb-rep').textContent = state.coach.rep;
  $('#tb-tac').textContent = state.coach.tac;
  $('#tb-cli').textContent = state.coach.cli;
  $('#pack-cnt').textContent = '×' + state.packs;
  $('#pack-stock').textContent = state.packs;
  $('#lobby-pack-cnt').textContent = '×' + state.packs;
}
$('#coach-chip').addEventListener('click', () => { go('squad'); setTimeout(() => setSquadSeg('coach'), 30); });
$('#pack-btn').addEventListener('click', openPackOverlay);
$('#gear-btn').addEventListener('click', () => toast('敬请期待'));
$('#modal-mask').addEventListener('click', e => { if(e.target.id === 'modal-mask') closeModal(); });

/* ================= 开包浮层 ================= */
function openPackOverlay(){ $('#pack-overlay').classList.add('show'); }
function closePackOverlay(){ $('#pack-overlay').classList.remove('show'); }
$('#pack-close').addEventListener('click', closePackOverlay);
$('#draft-pack').addEventListener('click', openPackOverlay);
$('#open-pack').addEventListener('click', doOpenPack);
function doOpenPack(){
  if(state.packs <= 0) return toast('卡包不足，继续征程赢取卡包');
  state.packs--; syncTopbar();
  $('#draw-result').style.display = 'none';
  const show = () => {
    $('#draw-result').style.display = 'block';
    const row = $('#draw-row');
    row.innerHTML = '';
    DRAW_FIVE.forEach((id, i) => {
      const d = document.createElement('div');
      mountCard(d, cardData(id), 66);
      if(!NOANIM) d.style.animationDelay = (i * 0.12) + 's';
      const q = PLAYERS[id].q;
      if(q === 'gold' || q === 'diamond'){
        const cls = q === 'gold' ? 'qflash-g' : 'qflash-d';
        setTimeout(() => { d.classList.add(cls); setTimeout(() => d.classList.remove(cls), 1000); }, NOANIM ? 0 : i * 120 + 450);
      }
      d.addEventListener('click', () => {
        const p = PLAYERS[id];
        toast(`${id} · ${p.team} · ${QN[p.q]}卡（枪${p.g} 协${p.s} 意${p.m}）`);
      });
      row.appendChild(d);
    });
  };
  if(NOANIM){ show(); return; }
  const pv = $('#pack-visual'), fl = $('#pack-flash');
  pv.classList.remove('shake'); void pv.offsetWidth; pv.classList.add('shake');
  setTimeout(() => { fl.classList.remove('burst'); void fl.offsetWidth; fl.classList.add('burst'); }, 380);
  setTimeout(show, 520);
}

/* ================= 大厅 ================= */
function calcPower(){
  const avg = state.lineup.reduce((a, id) => a + (PLAYERS[id].g + PLAYERS[id].s + PLAYERS[id].m) / 3, 0) / 5;
  return (avg * (0.9 + state.chemistry / 500)).toFixed(1);
}
function renderLobby(){
  // 五人错落站位：后/前交替（back 较小且上移）
  const order = [4, 0, 2, 3, 1].map(i => state.lineup[i]);
  $('#stage5').innerHTML = order.map((id, i) => {
    const p = PLAYERS[id];
    return `<div class="st5 ${i % 2 === 0 ? 'back' : 'front'} q-${p.q}" data-id="${id}">
      <div class="hx"><img src="${pimg(id)}" alt="${id}"></div>
      <div class="nm">${id}${p.status ? ` <span style="font-size:9px">${ST_ICON[p.status]}</span>` : ''}</div></div>`;
  }).join('');
  $$('#stage5 .st5').forEach(el => el.addEventListener('click', () => go('squad')));
  $('#lobby-power').textContent = calcPower();
  // 下一场 VS 卡
  const fight = $('#lobby-fight');
  if(!state.regMatchDone){
    fight.innerHTML = `
      <div class="vs"><img src="${A('队伍logo/EDG.png')}" alt="EDG"><span class="v">VS</span><img src="${A('队伍logo/BLG.png')}" alt="BLG"></div>
      <div class="meta">常规赛 · 第 5 轮 · BO3 · 胜场锁定 <b>季后赛①</b></div>
      ${btnHTML('出 战', 'atk', 'lobby-play')}`;
  } else {
    fight.innerHTML = `
      <div class="last">上轮 常规赛收官 <b>13 : 7</b> 轻取 BLG</div>
      <div class="vs"><img src="${A('队伍logo/EDG.png')}" alt="EDG"><span class="v">VS</span><img src="${A('队伍logo/FPX.png')}" alt="FPX"></div>
      <div class="meta">季后赛① · 半决赛 · BO5 · <b>关键场</b></div>
      ${btnHTML('出 战', '', 'lobby-play')}`;
  }
  $('#lobby-play').addEventListener('click', playCurrentMatch);
}
function playCurrentMatch(){
  if(!state.regMatchDone){
    state.regMatchDone = true; renderJourney(); renderLobby();
    const cur = $('.mapnode.current');
    if(cur && !NOANIM){ cur.classList.add('lit-flash'); setTimeout(() => cur.classList.remove('lit-flash'), 1200); }
    toast('常规赛收官！季后赛① 已解锁');
  } else {
    go('result');
  }
}
$('#entry-pack').addEventListener('click', openPackOverlay);
$('#entry-camp').addEventListener('click', () => toast('训练赛营地建设中：约训练赛 · 联机PK预留'));
$('#entry-gear').addEventListener('click', () => toast('设置建设中'));

/* ================= 征程 · 攀登地图（大厅屏下半段） ================= */
function standingsRows(){
  return STANDINGS.map((s, i) =>
    `<div class="srow${s.me ? ' me' : ''}"><span class="rk">${i+1}</span><img src="${A('队伍logo/' + s.t + '.png')}" alt="${s.t}"><span class="tn">${s.t}</span><span class="wl">${s.w}胜${s.l}负</span></div>`).join('');
}
function renderJourney(){
  const map = $('#journey-map');
  map.querySelectorAll('.mapnode,.map-cur,.map-start').forEach(n => n.remove());
  JOURNEY.filter(nd => nd.id !== 'champ').forEach(nd => {
    const pos = MAP_POS[nd.id], rg = RC_REGION[nd.rc];
    const el = document.createElement('div');
    el.className = 'mapnode ' + nd.st;
    el.style.left = pos.x + '%'; el.style.top = pos.y + 'px';
    el.style.setProperty('--nc', RC_COLOR[nd.rc]);
    const rs = nd.st === 'done' ? nd.res : nd.st === 'locked' ? '未解锁' :
      (state.regMatchDone ? '13:7 收官' : '进行中');
    el.innerHTML = `<div class="ring"><img src="${A('赛区图标/' + rg + '.png')}" alt="${rg}"${rg === 'EMEA' ? ` style="${EMEA_TINT}"` : ''}></div>
      <div class="nm">${nd.nm}</div><div class="rs">${rs}</div>`;
    if(nd.st === 'locked') el.addEventListener('click', () => toast(nd.lock));
    map.appendChild(el);
  });
  // 当前节点沉底卡片
  const card = document.createElement('div');
  card.className = 'map-cur panel-th'; card.id = 'map-cur';
  card.innerHTML = currentCardHTML();
  map.appendChild(card);
  bindCurrentCard();
  // 地图底部起点入口
  const st = document.createElement('div');
  st.className = 'map-start';
  st.innerHTML = `<div class="t">新的征程</div><div class="d">十选五出征 · 组建你的冠军班底</div>`;
  st.addEventListener('click', () => go('draft'));
  map.appendChild(st);
  drawMapLines();
}
function currentCardHTML(){
  if(!state.regMatchDone){
    return `<div class="sub">当前 · 第一赛段常规赛 · 第 5 轮（积分榜前二晋级季后赛）</div>
      <div class="st-toggle" id="st-toggle"><span>积分榜 · 4胜0负 · 第 1 位</span><span class="arr">▾</span></div>
      <div class="st-body" id="st-body"><div class="standings">${standingsRows()}</div></div>
      <div class="vs"><img src="${A('队伍logo/EDG.png')}" alt="EDG"><span class="v">VS</span><img src="${A('队伍logo/BLG.png')}" alt="BLG"></div>
      <div class="meta">常规赛 · BO3 · 胜场锁定 <b>季后赛①</b></div>
      ${btnHTML('出 战', 'atk', 'play-normal')}
      <div class="watch-link"><span id="watch-link">观赛页布局预览 ›</span></div>`;
  }
  return `<div class="sub">当前 · 季后赛① · 半决赛</div>
    <div class="flip-line" id="flip-result">上轮常规赛收官 <b>13 : 7</b> 轻取 BLG <span style="color:var(--txt-3)">(点展开数据)</span>
      <div class="mini" id="flip-mini">
        击杀王：<b>Haodong 24</b> · 首杀 7 次<br>
        团队爆能器安装率 <b>68%</b> · 手枪局 2/2<br>
        默契 <b>+2</b> · heybay 状态有所回暖
      </div>
    </div>
    <div class="vs"><img src="${A('队伍logo/EDG.png')}" alt="EDG"><span class="v">VS</span><img src="${A('队伍logo/FPX.png')}" alt="FPX"></div>
    <div class="meta">季后赛① · 半决赛 · BO5<span class="nm-key">关键场</span></div>
    ${btnHTML('出 战', '', 'play-key')}`;
}
function bindCurrentCard(){
  const pn = $('#play-normal');
  if(pn) pn.addEventListener('click', playCurrentMatch);
  const pk = $('#play-key');
  if(pk) pk.addEventListener('click', playCurrentMatch);
  const st = $('#st-toggle');
  if(st) st.addEventListener('click', () => {
    st.classList.toggle('open');
    $('#st-body').classList.toggle('open');
  });
  const wl = $('#watch-link');
  if(wl) wl.addEventListener('click', e => { e.stopPropagation(); go('match'); });
  const fr = $('#flip-result');
  if(fr) fr.addEventListener('click', () => {
    const m = $('#flip-mini'); if(m) m.style.display = m.style.display === 'block' ? 'none' : 'block';
  });
}
function drawMapLines(){
  const order = ['kick','m1','reg1','po1','m2','reg2','po2'];
  const pts = order.map(id => { const p = MAP_POS[id]; return [p.x * 3.9, p.y]; });
  pts.push([195, 86]); // 冠军赛峰顶
  const seg = (a, b) => `C ${a[0]} ${(a[1]+b[1])/2}, ${b[0]} ${(a[1]+b[1])/2}, ${b[0]} ${b[1]}`;
  const build = list => list.slice(1).reduce((d, p, i) => d + ' ' + seg(list[i], p), `M ${list[0][0]} ${list[0][1]}`);
  const lit = build(pts.slice(0, 3));      // 起点 → 当前节点
  const locked = build(pts.slice(2));      // 当前 → 峰顶
  $('#map-lines').innerHTML =
    `<path d="${locked}" fill="none" stroke="rgba(120,135,150,.35)" stroke-width="3" stroke-dasharray="1 10" stroke-linecap="round"/>` +
    `<path d="${lit}" fill="none" stroke="rgba(232,185,62,.55)" stroke-width="3" stroke-dasharray="1 10" stroke-linecap="round"/>`;
}
/* 首次进大厅：路径描边生长（截图/减动效模式跳过） */
function animateMapLines(){
  if(NOANIM || state.mapAnimated) return;
  state.mapAnimated = true;
  $$('#map-lines path').forEach(p => {
    const L = p.getTotalLength();
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)';
    p.style.strokeDashoffset = '0';
    setTimeout(() => { p.style.transition = 'none'; p.style.strokeDasharray = '1 10'; p.style.strokeDashoffset = '0'; }, 1300);
  });
}
function scrollLobbyToMap(){
  const sc = $('#screen-lobby');
  sc.scrollTop = $('#journey-map').offsetTop + 320;
}
$('#crown-zone').addEventListener('click', () => toast(JOURNEY[0].lock));

/* ================= 十选五出征 ================= */
function renderDraft(){
  const grid = $('#draft-grid');
  grid.innerHTML = '';
  DRAFT_POOL.forEach(id => {
    const d = document.createElement('div');
    mountCard(d, cardData(id), 108);
    d.dataset.id = id;
    d.insertAdjacentHTML('beforeend', '<div class="ord"></div>');
    d.addEventListener('click', () => {
      const i = state.draftSel.indexOf(id);
      if(i >= 0) state.draftSel.splice(i, 1);
      else {
        if(state.draftSel.length >= 5) return toast('已选满 5 人，先取消一名选手');
        state.draftSel.push(id);
      }
      refreshDraftPicks();
    });
    grid.appendChild(d);
  });
  refreshDraftPicks();
}
function refreshDraftPicks(){
  $$('#draft-grid .cardwrap').forEach(c => {
    const i = state.draftSel.indexOf(c.dataset.id);
    c.classList.toggle('picked', i >= 0);
    c.querySelector('.ord').textContent = i >= 0 ? (i + 1) : '';
  });
  $('#draft-cnt').textContent = state.draftSel.length;
  const ok = state.draftSel.length === 5;
  $('#draft-ok').disabled = !ok;
  $('#draft-ok-o').classList.toggle('dis', !ok);
}
$('#draft-ok').addEventListener('click', () => {
  state.lineup = [...state.draftSel];
  syncLineup(); renderTransfer(); go('squad');
  toast('出征阵容已确定！');
});

/* ================= 战队 · 阵容 ================= */
function setSquadSeg(seg){
  $$('.squad-seg .mt').forEach(x => x.classList.toggle('on', x.dataset.seg === seg));
  $('#squad-lineup').style.display = seg === 'lineup' ? '' : 'none';
  $('#squad-coach').style.display = seg === 'coach' ? '' : 'none';
  if(seg === 'lineup') requestAnimationFrame(drawSynLines);
}
$$('.squad-seg .mt').forEach(t => t.addEventListener('click', () => setSquadSeg(t.dataset.seg)));

const SLOT_POS = [{x:70,y:8},{x:192,y:8},{x:16,y:132},{x:131,y:132},{x:246,y:132}];
function syncLineup(){
  const hf = $('#hexfield');
  hf.querySelectorAll('.hslot').forEach(n => n.remove());
  state.lineup.forEach((id, i) => {
    const p = PLAYERS[id], pos = SLOT_POS[i];
    const el = document.createElement('div');
    el.className = 'hslot'; el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; el.dataset.id = id;
    el.innerHTML = `${p.status ? `<span class="st-ico">${ST_ICON[p.status]}</span>` : ''}
      <div class="hex ${p.q}"><div class="in"><img src="${pimg(id)}" alt="${id}"></div></div>
      <div class="hid">${id}</div>
      <div class="hst">枪<b>${p.g}</b> 协<b>${p.s}</b> 意<b>${p.m}</b></div>`;
    el.addEventListener('click', () => openSheet(id));
    hf.appendChild(el);
  });
  $('#power-val').textContent = calcPower();
  $('#chem-val').textContent = state.chemistry;
  $('#chem-fill').style.width = `calc(${state.chemistry}% - 4px)`;
  drawSynLines();
  renderLobby();
}
function drawSynLines(){
  const svg = $('#syn-lines'), hf = $('#hexfield');
  const r = hf.getBoundingClientRect();
  if(!r.width) return;
  svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  const c = SLOT_POS.map(p => ({x: p.x + 52, y: p.y + 51}));
  const links = [[0,2,.9],[0,3,.5],[1,3,.8],[1,4,.45],[2,3,.7],[3,4,.65],[0,1,.35]];
  svg.innerHTML = links.map(([a,b,o]) =>
    `<line x1="${c[a].x}" y1="${c[a].y}" x2="${c[b].x}" y2="${c[b].y}" stroke="rgba(34,200,216,${o * .55})" stroke-width="${1 + o * 2}"/>`).join('');
}
function openSheet(id){
  const p = PLAYERS[id];
  const obs = OBS[id] || OBS_DEFAULT;
  const bar = (lab, v) => `<div class="statbar"><div class="sr"><span>${lab}</span><b>${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`;
  $('#sheet-body').innerHTML = `
    <div class="detail-top">
      <div id="sheet-card"></div>
      <div class="detail-info">
        <div class="did">${id}</div>
        <div class="dteam">${p.team} · ${QN[p.q]}卡 · ${p.status ? ST_ICON[p.status] + (p.status === 'hot' ? '火热' : '低迷') : '状态平稳'}</div>
        ${bar('枪法', p.g)}${bar('协同', p.s)}${bar('意识', p.m)}
        ${p.status ? `<div class="st-desc ${p.status}">${ST_DESC[p.status]}</div>` : ''}
      </div>
    </div>
    <div class="sec-title">观察记录</div>
    <div class="obs-list">
      ${obs.map(o => `<div class="obs-item${o.neg ? ' neg' : ''}">「${o.t}」<span class="when">${o.w}</span></div>`).join('')}
    </div>
    <div class="obs-note">观察记录只记录评语，不下结论。</div>
    <div style="margin-top:14px"><span class="btn-o ghost block"><button class="btn" id="sheet-close"><span>收 起</span></button></span></div>`;
  mountCard($('#sheet-card'), cardData(id), 112);
  $('#sheet-mask').classList.add('show');
  $('#player-sheet').classList.add('show');
  $('#sheet-close').addEventListener('click', closeSheet);
}
function openSheetForce(id){
  openSheet(id);
  const sh = $('#player-sheet'), mk = $('#sheet-mask');
  sh.style.transition = 'none'; sh.style.transform = 'none'; mk.style.display = 'block';
}
function closeSheet(){ $('#sheet-mask').classList.remove('show'); $('#player-sheet').classList.remove('show'); }
$('#sheet-mask').addEventListener('click', closeSheet);
$('#transfer-btn').addEventListener('click', () => { renderTransfer(); go('transfer'); });

/* ================= 换人 ================= */
let tfPickNew = null, tfPickOld = null;
function renderTransfer(){
  const nw = $('#tf-new');
  nw.innerHTML = '';
  const avail = TF_NEW.filter(id => !state.tfUsed.has(id));
  if(!avail.length){
    nw.innerHTML = '<div class="tf-empty">本卡包已用完</div>';
  } else {
    avail.forEach(id => {
      const d = document.createElement('div');
      mountCard(d, cardData(id), 104);
      d.dataset.id = id;
      d.insertAdjacentHTML('beforeend', `<div class="delta-tag">默契 ${PLAYERS[id].delta}</div>`);
      d.addEventListener('click', () => {
        tfPickNew = id;
        $$('#tf-new .cardwrap').forEach(x => x.classList.toggle('sel', x === d));
        tryPreview();
      });
      nw.appendChild(d);
    });
  }
  $('#tf-lineup').innerHTML = state.lineup.map(id => {
    const p = PLAYERS[id];
    return `<div class="tf-slot" data-id="${id}">
      <div class="hex ${p.q}"><img src="${pimg(id)}" alt="${id}"></div>
      <div class="nm">${id}</div></div>`;
  }).join('');
  tfPickNew = tfPickOld = null;
  $$('#tf-lineup .tf-slot').forEach(c => c.addEventListener('click', () => {
    tfPickOld = c.dataset.id;
    $$('#tf-lineup .tf-slot').forEach(x => x.classList.toggle('sel', x === c));
    tryPreview();
  }));
}
function tryPreview(){
  if(!tfPickNew || !tfPickOld) return;
  const p = PLAYERS[tfPickNew];
  const after = state.chemistry + p.delta;
  openModal(`
    <div class="sec-title" style="margin-top:0">换人预览</div>
    <div class="swap-cmp">
      <div class="hx"><img src="${pimg(tfPickOld)}" alt="${tfPickOld}"></div>
      <span class="arr">▶</span>
      <div class="hx"><img src="${pimg(tfPickNew)}" alt="${tfPickNew}"></div>
    </div>
    <div style="text-align:center;font-size:12px;color:var(--txt-2)">${tfPickOld} 下场 · ${tfPickNew} 上场（${QN[p.q]}卡）</div>
    <div class="chem-delta">默契 ${state.chemistry} → <span class="dn">${after}（${p.delta}）</span></div>
    ${after < 60 ? '<div class="warn-line">⚠ 默契将跌破协同加成阈值（60）！</div>' : ''}
    ${after >= 60 && after < 80 ? '<div style="text-align:center;font-size:10.5px;color:var(--txt-2)">仍在 60 阈值之上，协同加成保留</div>' : ''}
    <div style="display:flex;gap:10px;margin-top:14px">
      <span class="btn-o ghost" style="flex:1"><button class="btn" id="swap-cancel"><span>取 消</span></button></span>
      <span class="btn-o" style="flex:1"><button class="btn" id="swap-ok"><span>确认换人</span></button></span>
    </div>`);
  $('#swap-cancel').addEventListener('click', closeModal);
  $('#swap-ok').addEventListener('click', () => {
    state.lineup[state.lineup.indexOf(tfPickOld)] = tfPickNew;
    state.chemistry = after;
    state.tfUsed.add(tfPickNew);
    closeModal(); syncLineup(); renderTransfer();
    toast(`换人完成：${tfPickNew} 进入阵容`);
  });
}
$('#tf-back').addEventListener('click', () => go('squad'));

/* ================= 结算页 ================= */
$('#res-continue').addEventListener('click', () => {
  if(!state.resultClaimed){
    state.resultClaimed = true;
    state.packs += 1;
    state.chemistry = 82;
    state.coach.rep += 3; state.coach.tac += 2; state.coach.cli += 1;
    syncTopbar(); syncLineup();
  }
  go('lobby');
  toast('卡包 ×1 已入库');
});

/* ================= 观赛页 ================= */
$('#match-back').addEventListener('click', () => { go('lobby'); setTimeout(scrollLobbyToMap, 50); });
$$('.match-tabs .mt').forEach(t => t.addEventListener('click', () => {
  $$('.match-tabs .mt').forEach(x => x.classList.toggle('on', x === t));
  $('#match-feed').style.display = t.dataset.mtab === 'feed' ? '' : 'none';
  $('#match-cmd').style.display = t.dataset.mtab === 'cmd' ? '' : 'none';
}));
$('#sandbox').addEventListener('click', function(){
  this.classList.toggle('focus');
  this.querySelector('.placeholder div:last-child').textContent =
    this.classList.contains('focus') ? '专注模式 · 点击任意处退出' : '接入引擎后启用 · 点击进入专注模式';
});
$$('.cmd-btn[data-tac]').forEach(b => b.addEventListener('click', () => {
  $$('.cmd-btn[data-tac]').forEach(x => x.classList.toggle('on', x === b));
  toast('战术比重已调整：' + b.textContent);
}));
$('#igl-btn').addEventListener('click', () => toast('场上指挥已更换为 Munchkin（假操作）'));
$('#pause-btn').addEventListener('click', () => {
  openModal(`
    <div class="sec-title" style="margin-top:0">教练窗口 · 回合间调整</div>
    <div style="font-size:12px;color:var(--txt-2);line-height:2">
      ▸ 下一局战术比重：<b style="color:var(--q-gold)">防守 +1 档</b><br>
      ▸ 指定盯防：<b style="color:var(--side-def)">Haodong → 对方突破位</b><br>
      ▸ 暂停后历史胜率：<b style="color:var(--warn)">63%</b>（临场 58）
    </div>
    <div style="font-size:10px;color:var(--txt-3);margin-top:8px">（示意面板 · 接引擎后读取真实回合数据）</div>
    <div style="margin-top:14px"><span class="btn-o block"><button class="btn" id="pause-ok"><span>确 认 调 整</span></button></span></div>`);
  $('#pause-ok').addEventListener('click', () => { closeModal(); toast('调整已生效（假）'); });
});

/* ================= 战队 · 教练 ================= */
function setCoachTab(tab){
  $$('.ctabs .mt[data-ctab]').forEach(x => x.classList.toggle('on', x.dataset.ctab === tab));
  $('#coach-tri').style.display = tab === 'tri' ? '' : 'none';
  $('#coach-career').style.display = tab === 'career' ? '' : 'none';
}
$$('.ctabs .mt[data-ctab]').forEach(t => t.addEventListener('click', () => setCoachTab(t.dataset.ctab)));

/* ================= 更多 · 图鉴 ================= */
function renderGallery(region='all'){
  const grid = $('#gallery-grid');
  grid.innerHTML = '';
  GALLERY_ORDER
    .filter(id => region === 'all' || PLAYERS[id].region === region)
    .forEach(id => {
      const locked = GALLERY_LOCKED.has(id);
      const d = document.createElement('div');
      mountCard(d, cardData(id), 112);
      if(locked){
        d.classList.add('locked');
        d.insertAdjacentHTML('beforeend', '<div class="lock-mask">未获得</div>');
      } else {
        d.addEventListener('click', () => {
          const p = PLAYERS[id];
          toast(`${id} · ${QN[p.q]}卡（枪${p.g} 协${p.s} 意${p.m}）`);
        });
      }
      grid.appendChild(d);
    });
}
$$('#region-filter .rf').forEach(b => b.addEventListener('click', () => {
  $$('#region-filter .rf').forEach(x => x.classList.toggle('on', x === b));
  renderGallery(b.dataset.region);
}));

/* ================= 初始化 ================= */
renderJourney(); renderDraft(); syncLineup(); renderTransfer(); renderGallery(); syncTopbar();
route();
// 截图模式（#shot）：手机框贴左上，配合 --window-size=500,940 + 裁剪 390x844
if(location.hash.includes('shot')){
  document.querySelector('.phone').style.margin = '0';
  document.body.style.background = '#000';
}
