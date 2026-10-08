// Shared presentation renderer. All ratings are a read-only snapshot, not new rules.
(() => {
 const assets='../../../素材库/';
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.renderCollectible=(p)=>{
  const diamond=p.tier==='钻';
  const photo=p.photo||('选手半身像/'+p.name+'.png');
  return `<article class="collectible" data-tier="${esc(p.tier)}" aria-label="${esc(p.name)}，${esc(p.tier)}卡，能力 ${p.rating}"><div class="card-face"><div class="card-portrait"><span class="card-team-word" aria-hidden="true">${esc(p.team)}</span><img class="card-photo" src="${assets+encodeURI(photo)}" alt="${esc(p.name)}${diamond?'赛事影像':''}"><div class="card-rating"><b>${p.rating}</b><small>OVR</small></div><img class="card-team-logo" src="${assets+encodeURI(p.logo||('队伍logo/'+p.team+'.png'))}" alt="${esc(p.team)}"><span class="card-quality"><i class="quality-gem" aria-hidden="true"></i>${esc(p.tier)}卡${diamond?' · 赛事珍藏':''}</span></div><div class="card-copy"><div class="card-meta"><span>${esc(p.region)} / ${esc(p.team)}</span><span>${diamond?'MOMENTS':'PLAYER SERIES'}</span></div><h2 class="card-name">${esc(p.name)}</h2><p class="card-subline">${diamond?'2023 · 东京大师赛':''}</p><div class="card-agents">${p.agents.slice(0,diamond?1:3).map(a=>`<img src="${assets+encodeURI(p.agentAssets?.[a]||('英雄头像/'+a+'.png'))}" alt="${esc(a)}">`).join('')}<span>${diamond?'冥驹审判':'擅长特工'}</span></div><div class="card-stats">${[['枪法','AIM'],['协同','SYN'],['意识','SEN']].map(([label,key])=>`<span><b>${p[key]}</b><small>${label}</small></span>`).join('')}</div><div class="card-foot"><span>VAL MANAGER</span><span>${diamond?'TOKYO · 2023':'COLLECTION / '+esc(p.region)}</span></div></div></div></article>`;
 };
 window.cardSampleDiamond=()=>({...window.VISUAL_PLAYERS[0],...window.VISUAL_DIAMOND,tier:'钻',photo:'切面海报/23东京_ZmjjKK.png',agents:['捷风']});
})();
