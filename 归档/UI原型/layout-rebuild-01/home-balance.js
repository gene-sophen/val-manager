(() => {
  const players=window.VISUAL_PLAYERS;
  const root='../../../素材库/';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rail=document.getElementById('people-rail');
  const dialog=document.getElementById('balance-dialog');
  const prev=document.getElementById('rail-prev'), next=document.getElementById('rail-next');
  rail.innerHTML=players.map((p,i)=>`<button class="balance-card" data-player="${i}" data-tier="${p.tier}" aria-label="查看 ${esc(p.name)}，能力 ${p.rating}"><span class="portrait-space"><img class="balance-portrait" src="${root}选手半身像/${esc(p.name)}.png" alt=""><b class="balance-rating">${p.rating}</b><img class="balance-team" src="${root}队伍logo/${esc(p.team)}.png" alt="${esc(p.team)}"></span><strong class="balance-name">${esc(p.name)}</strong><span class="balance-agents">${p.agents.map(a=>`<img src="${root}英雄头像/${encodeURIComponent(a)}.png" alt="${esc(a)}" title="${esc(a)}">`).join('')}</span></button>`).join('');
  function update(){
    const rect=rail.getBoundingClientRect();
    const shown=[...rail.children].map((card,i)=>({i,rect:card.getBoundingClientRect()})).filter(p=>p.rect.left>=rect.left-1&&p.rect.right<=rect.right+1);
    if(shown.length)document.getElementById('rail-position').textContent=`${shown[0].i+1}${shown.length>1?'–'+(shown.at(-1).i+1):''} / ${players.length}`;
    prev.disabled=rail.scrollLeft<2;next.disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;
  }
  const move=dir=>rail.scrollBy({left:dir*168,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  prev.onclick=()=>move(-1);next.onclick=()=>move(1);
  rail.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(rail);
  rail.addEventListener('click',event=>{const button=event.target.closest('[data-player]');if(!button)return;document.getElementById('balance-detail').innerHTML=renderCollectible(players[+button.dataset.player]);dialog.showModal();});
  document.getElementById('close-detail').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  update();
})();
