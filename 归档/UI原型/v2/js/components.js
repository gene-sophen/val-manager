/* ================= 组件工厂 ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let toastTimer = null;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function openModal(html){ $('#modal-box').innerHTML = html; $('#modal-mask').classList.add('show'); }
function closeModal(){ $('#modal-mask').classList.remove('show'); }

/* CR 式双层按钮 */
function btnHTML(label, mod='', id=''){
  return `<span class="btn-o ${mod}"><button class="btn"${id ? ` id="${id}"` : ''}><span>${label}</span></button></span>`;
}

const EMEA_TINT = 'filter:invert(72%) sepia(58%) saturate(500%) hue-rotate(2deg)';
const ST_ICON = {hot:'🔥', cold:'❄️'};
const ST_DESC = {hot:'状态火热：近期表现出色，三维临时 +3', cold:'状态低迷：近期表现挣扎，三维临时 -3，建议训练赛调整'};

/* PLAYERS（英文品质）→ 卡面组件数据（中文品质） */
function cardData(id){
  const p = PLAYERS[id];
  return {
    id, team:p.team, region:p.region, q:QN[p.q],
    rating:Math.round((p.g + p.s + p.m) / 3),
    g:p.g, s:p.s, m:p.m,
    agents:p.agents || [], trait:p.trait || '',
  };
}

/* 定稿卡面原型 v16 的组件化复刻（金银铜 + 钻） */
function cardHTML(o){
  const regionImg = `<img class="rgen" src="${A('赛区图标/'+o.region+'.png')}" ${o.region==='EMEA'?`style="${EMEA_TINT}"`:''}>`;
  const agents = (o.agents||[]).map((a,i) =>
    `<div class="ag${i===0 && o.q!=='铜' ? ' sig':''}"><div class="heximg"><img src="${A('英雄头像/'+a+'.png')}"></div></div>`).join('');
  const stats = `<div class="stats">
    <div class="stat"><b>${o.g}</b><span>枪法</span></div>
    <div class="stat"><b>${o.s}</b><span>协同</span></div>
    <div class="stat"><b>${o.m}</b><span>意识</span></div></div>`;
  if(o.q === '钻'){
    return `<div class="card r-钻">
      <div class="frame"></div><div class="bevel"></div>
      <div class="cbody">
        <div class="pbg"><img class="watermark" src="${A('队伍logo/'+o.team+'.png')}"></div>
        <div class="portrait"><img src="${A('切面海报/'+o.poster)}"><div class="scrim"></div></div>
        <div class="vignette"></div><div class="grain"></div>
        ${decoSVG('钻')}
        <div class="sheen"></div><div class="gem"></div>${regionImg}
        <div class="rating" data-n="${o.rating}">${o.rating}</div>
        <div class="d-banner"><div class="d-pid">${o.id}</div></div>
        <div class="d-cut">${o.cut}</div>
        <div class="agents"><div class="ag sig"><div class="heximg"><img src="${A('英雄头像/'+o.agents[0]+'.png')}"></div></div></div>
        <div class="badges"><div class="plate moment"><div class="picon"><svg width="14" height="14" style="color:#A9F1FF"><use href="#i-scope"/></svg></div><div class="ptext"><b>${o.moment}</b></div></div></div>
        <div class="d-stat ds1"><span>枪法</span><b>${o.g}</b></div>
        <div class="d-stat ds2"><span>协同</span><b>${o.s}</b></div>
        <div class="d-stat ds3"><span>意识</span><b>${o.m}</b></div>
      </div></div>`;
  }
  return `<div class="card r-${o.q}">
    <div class="frame"></div><div class="bevel"></div>
    <div class="cbody">
      <div class="pbg"><img class="watermark" src="${A('队伍logo/'+o.team+'.png')}"></div>
      <div class="portrait"><img src="${A('选手半身像/'+o.id+(IMG_EXT[o.id]||'.png'))}"><div class="scrim"></div></div>
      <div class="vignette"></div><div class="grain"></div>
      ${o.q==='金'?'<div class="wing l"></div><div class="wing r"></div>':''}
      ${decoSVG(o.q)}
      <div class="gem"></div>${regionImg}
      <div class="rating" data-n="${o.rating}">${o.rating}</div>
      <div class="corner"><img class="tlo" src="${A('队伍logo/'+o.team+'.png')}"></div>
      <div class="who"><div class="pid">${o.id}</div></div>
      <div class="agents">${agents}</div>
      ${o.q==='金'?`<div class="badges"><div class="plate trait"><div class="picon"><svg width="14" height="14" style="color:#E8B93E"><use href="#i-star"/></svg></div><div class="ptext"><b>${o.trait}</b></div></div></div>`:''}
      ${stats}
    </div></div>`;
}
/* 各品质 SVG 花边（抄自卡面原型 v16） */
function decoSVG(q){
  const OUTER = 'M 138.5,23.2 Q 150.0,20.0 161.5,23.2 L 275.7,55.4 Q 287.2,58.7 287.2,70.7 L 287.2,399.3 Q 287.2,411.3 275.7,414.6 L 161.5,446.8 Q 150.0,450.0 138.5,446.8 L 24.3,414.6 Q 12.8,411.3 12.8,399.3 L 12.8,70.7 Q 12.8,58.7 24.3,55.4 Z';
  const INNER = 'M 140.4,29.7 Q 150.0,27.0 159.6,29.7 L 273.1,61.7 Q 282.8,64.5 282.8,74.5 L 282.8,395.5 Q 282.8,405.5 273.1,408.3 L 159.6,440.3 Q 150.0,443.0 140.4,440.3 L 26.9,408.3 Q 17.2,405.5 17.2,395.5 L 17.2,74.5 Q 17.2,64.5 26.9,61.7 Z';
  if(q === '铜') return `<svg class="deco" viewBox="0 0 300 470">
    <path d="${OUTER}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2" transform="translate(0,-1)"/>
    <path d="${OUTER}" fill="none" stroke="rgba(214,181,145,.3)" stroke-width=".8" transform="translate(0,.8)"/></svg>`;
  if(q === '银') return `<svg class="deco" viewBox="0 0 300 470" style="color:#C9D4DE">
    <path d="${OUTER}" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2.6" transform="translate(0,-1.2)"/>
    <path d="${OUTER}" fill="none" stroke="#C9D4DE" stroke-width="1.1" opacity=".75"/>
    <use href="#medal" x="277" y="49" width="18" height="18"/><use href="#medal" x="5" y="49" width="18" height="18"/>
    <use href="#medal" x="277" y="398" width="18" height="18" opacity=".55"/><use href="#medal" x="5" y="398" width="18" height="18" opacity=".55"/></svg>`;
  if(q === '金') return `<svg class="deco" viewBox="0 0 300 470" style="color:#E8B93E">
    <path d="${OUTER}" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="3.2" transform="translate(0,-1.4)"/>
    <path d="${OUTER}" fill="none" stroke="#E8B93E" stroke-width="1.5" opacity=".9"/>
    <path d="${INNER}" fill="none" stroke="#E8B93E" stroke-width=".7" opacity=".45"/>
    <use href="#medal" x="140" y="11" width="19" height="19"/><use href="#medal" x="277" y="49" width="19" height="19"/><use href="#medal" x="4" y="49" width="19" height="19"/>
    <use href="#medal" x="277" y="398" width="19" height="19" opacity=".6"/><use href="#medal" x="4" y="398" width="19" height="19" opacity=".6"/><use href="#medal" x="140" y="438" width="19" height="19" opacity=".6"/>
    <g stroke="#E8B93E" fill="none" opacity=".75"><path d="M150 30 v16 M130 33 l7 13 M170 33 l-7 13 M112 41 l11 9 M188 41 l-11 9" stroke-width="1.2"/><path d="M150 34 v8 M136 37 l4 6 M164 37 l-4 6" stroke-width=".7" opacity=".6"/></g></svg>`;
  return `<svg class="deco" viewBox="0 0 300 470" style="color:#A9F1FF">
    <defs><linearGradient id="prism2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9F1FF"/><stop offset=".5" stop-color="#f2feff"/><stop offset=".8" stop-color="#b99df1"/><stop offset="1" stop-color="#A9F1FF"/></linearGradient></defs>
    <path d="${OUTER}" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="3.4" transform="translate(0,-1.4)"/>
    <path d="${OUTER}" fill="none" stroke="url(#prism2)" stroke-width="1.8"/>
    <path d="${INNER}" fill="none" stroke="url(#prism2)" stroke-width=".8" opacity=".5"/>
    <use href="#medal" x="140" y="11" width="20" height="20"/><use href="#medal" x="277" y="49" width="20" height="20"/><use href="#medal" x="4" y="49" width="20" height="20"/>
    <use href="#medal" x="277" y="398" width="20" height="20" opacity=".6"/><use href="#medal" x="4" y="398" width="20" height="20" opacity=".6"/>
    <path d="M126 452 L150 434 L174 452" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2.4" transform="translate(0,-1)"/>
    <path d="M126 452 L150 434 L174 452" fill="none" stroke="url(#prism2)" stroke-width="1.3"/>
    <path d="M136 452 L150 440 L164 452" fill="none" stroke="url(#prism2)" stroke-width=".8" opacity=".6"/></svg>`;
}
/* 缩放挂载：300×470 卡面 → 任意宽度 */
function mountCard(el, o, w){
  const s = w / 300;
  el.classList.add('cardwrap');
  el.style.width = w + 'px'; el.style.height = (470 * s) + 'px';
  el.innerHTML = cardHTML(o);
  el.firstElementChild.style.transform = `scale(${s})`;
}
