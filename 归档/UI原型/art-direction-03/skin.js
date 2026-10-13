const setSkin = skin => {
  skin=skin==='arena'?'arena':'playful';
  document.documentElement.dataset.skin=skin;
  document.querySelectorAll('[data-skin-value]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skinValue===skin)));
  const url=new URL(location.href);url.searchParams.set('skin',skin);history.replaceState(null,'',url);
  const link=document.getElementById('component-link');if(link)link.href='components.html?skin='+skin;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',skin==='playful'?'#ffffff':'#f6f9fd');
};
setSkin(new URLSearchParams(location.search).get('skin'));
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.skinValue)setSkin(button.dataset.skinValue);
  if(button.dataset.action==='skin')setSkin(document.documentElement.dataset.skin==='playful'?'arena':'playful');
});
