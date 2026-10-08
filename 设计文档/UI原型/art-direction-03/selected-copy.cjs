// Product copy pass. Historical comparison pages retain their original wording.
module.exports=html=>html
 .replace('<div class="studio-controls">','<div class="studio-controls"><a class="spec-button" href="mobile.html#album">手机原型 ↗</a>')
 .replace(/<section class="intro"[\s\S]*?<\/section>/,'<section class="intro" aria-label="原型说明"><div><div class="eyebrow">A / 界面原型</div><h1>俱乐部 · 选手 · 卡册</h1></div></section>')
 .replace(/<div class="home-heading">[\s\S]*?<\/div>/,'<div class="home-heading"><h2>我的队伍</h2></div>')
 .replace('不止五个名字，是同一支队伍','EDWARD GAMING')
 .replace('PLAY AS ONE.','EDG')
 .replace('<span class="small-label">五位选手 · 一个目标</span>','')
 .replace('管理我的阵容','查看选手')
 .replace('把闪光时刻收好','卡面')
 .replace('<strong>俱乐部手记</strong><small>记住每一次并肩</small>','<strong>原型说明</strong>')
 .replace(/<section class="journal">[\s\S]*?<\/section>/,'')
 .replace(/<div class="roster-heading">[\s\S]*?<\/div>/,'<div class="roster-heading"><h2>选手名单</h2></div>')
 .replace(/<div class="roster-note">[\s\S]*?<\/div>/,'')
 .replace(/<p class="demo-footnote">[\s\S]*?<\/p>/g,'')
 .replace('展开珍藏卡面','查看卡面');
