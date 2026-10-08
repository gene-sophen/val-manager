// Reuse the existing v16 artwork in an isolated iframe; never modify the source artwork.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'数据源/cards_full.json'),'utf8'));
const names = ['ZmjjKK','CHICHOO','nobody','Smoggy','Haodong'];
const players = names.map(name => {
  const p = catalog.find(p=>p.name===name);
  if(!p) throw new Error('Missing player: '+name);
  return {name:p.name,team:p.team,region:p.region,tier:p.tier,rating:p.rating,AIM:p.AIM,SYN:p.SYN,SEN:p.SEN,agents:p.agents};
});
const diamonds = JSON.parse(fs.readFileSync(path.join(root,'数据源/diamond_cards.json'),'utf8'));
const diamondList = Array.isArray(diamonds)?diamonds:(diamonds.cards||[]);
const diamond = diamondList.find(p=>JSON.stringify(p).includes('东京') && (p.name==='ZmjjKK'||p.player==='ZmjjKK'));
// The original Tokyo artwork has this visual sample when no matching catalog record exists.
const diamondStats = diamond && Number.isFinite(diamond.AIM) ? {AIM:diamond.AIM,SYN:diamond.SYN,SEN:diamond.SEN,rating:diamond.rating ?? Math.round((diamond.AIM+diamond.SYN+diamond.SEN)/3)} : {AIM:88,SYN:75,SEN:80,rating:90};
fs.writeFileSync(path.join(__dirname,'players.js'),'// Snapshot for visual exploration only.\nwindow.VISUAL_PLAYERS = '+JSON.stringify(players,null,2)+';\nwindow.VISUAL_DIAMOND = '+JSON.stringify(diamondStats)+';\n');
let art = fs.readFileSync(path.join(root,'设计文档/选手卡/卡面原型.html'),'utf8').replaceAll('../../素材库/','../../../素材库/');
art = art.replace('<title>选手卡卡面原型 v10 · 双布局体系</title>','<title>选手卡 · 视觉原型复用</title>');
const additions = `<style>html,body{width:300px;height:470px;min-height:0;margin:0;padding:0;overflow:hidden;background:transparent}body::before,header{display:none}.row{display:block;width:300px;height:470px;margin:0;max-width:none}.card{display:none;filter:none!important;transition:none!important}.card:hover{transform:none!important}.card.visible{display:block}</style>
<script src="players.js"></script><script>
const params=new URLSearchParams(location.search), p=window.VISUAL_PLAYERS.find(p=>p.name===params.get('player'))||window.VISUAL_PLAYERS[0];
const isDiamond=params.get('edition')==='diamond'&&p.name==='ZmjjKK';
const tier=isDiamond?'钻':p.tier;
const card=document.querySelector('.card.r-'+tier);card.classList.add('visible');
document.querySelectorAll('.card:not(.visible)').forEach(el=>el.remove());
if(!isDiamond){
 card.querySelector('.portrait img').src='../../../素材库/选手半身像/'+p.name+'.png';
 card.querySelector('.portrait img').alt=p.name;
 card.querySelector('.pid').textContent=p.name;
 card.querySelector('.rating').textContent=p.rating;card.querySelector('.rating').dataset.n=p.rating;
 card.querySelectorAll('.stat b').forEach((el,i)=>el.textContent=[p.AIM,p.SYN,p.SEN][i]);
 const logo=card.querySelector('.tlo');if(logo)logo.src='../../../素材库/队伍logo/'+p.team+'.png';
 const watermark=card.querySelector('.watermark');if(watermark)watermark.src='../../../素材库/队伍logo/'+p.team+'.png';
 card.querySelectorAll('.agents .ag').forEach((el,i)=>{if(!p.agents[i])el.remove();else{el.querySelector('img').src='../../../素材库/英雄头像/'+p.agents[i]+'.png';el.querySelector('img').alt=p.agents[i];}});
 const trait=card.querySelector('.ptext b');if(trait&&p.name!=='ZmjjKK')trait.textContent='选手珍藏';
}else{
 const values=window.VISUAL_DIAMOND;
 card.querySelector('.rating').textContent=values.rating;card.querySelector('.rating').dataset.n=values.rating;
 card.querySelectorAll('.d-stat b').forEach((el,i)=>el.textContent=[values.AIM,values.SYN,values.SEN][i]);
}
</script>`;
art=art.replace('</head>',additions.split('<script src=')[0]+'</head>');
art=art.replace('</body>','<script src='+additions.split('<script src=')[1]+'</body>');
fs.writeFileSync(path.join(__dirname,'card-art.html'),art);
console.log('Generated visual data and isolated v16 artwork.');
