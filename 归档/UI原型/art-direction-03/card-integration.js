// Apply the chosen card direction only to selected.html; comparison archives stay intact.
cardURL=function(){return 'card-art-a.html?player='+encodeURIComponent(selectedPlayer.name)+'&edition='+edition};
renderDetail();
document.querySelector('meta[name="theme-color"]').content='#ffffff';
const cardEntry=document.querySelector('.shortcut-rack>button');
if(cardEntry){const link=document.createElement('a');link.className='collection-entry';link.href='mobile.html#album';link.innerHTML='<span class="shortcut-icon"><svg><use href="#cards"/></svg></span><span><strong>选手收藏</strong><small>卡册与开包</small></span>';cardEntry.replaceWith(link)}
