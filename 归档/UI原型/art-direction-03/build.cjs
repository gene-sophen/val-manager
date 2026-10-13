const fs=require('node:fs'),path=require('node:path');
const previous=path.join(__dirname,'../art-direction-02');
let html=fs.readFileSync(path.join(previous,'concept.html'),'utf8');
html=html.replaceAll('ART DIRECTION 02','ART DIRECTION 03').replaceAll('视觉探索 02','视觉探索 03').replaceAll('skins.css','ui.css').replaceAll('data-skin="club"','data-skin="playful"');
html=html.replace('get("skin")==="console"?"console":"club"','get("skin")==="arena"?"arena":"playful"');
html=html.replaceAll('data-skin-value="club"','data-skin-value="playful"').replaceAll('data-skin-value="console"','data-skin-value="arena"');
html=html.replace('A · 俱乐部','A · 清爽弹性').replace('B · 竞技台','B · 竞技厚度');
html=html.replace('白色为底，<em>触感更鲜明。</em>','清晰的白，<em>扎实的手感。</em>');
html=html.replace('有厚度的按键、嵌入式数据槽、有重量的卡牌。<br>先确定界面手感，玩法继续后置。','更干净的面，更明确的侧壁。<br>中文字重、圆润数字和游戏图标一同重做。');
html=html.replace('你的主场。<br><span>下一程，一起。</span>','一起上场，<br><span>这就是你的主场。</span>');
html=html.replace('HOME BASE / 俱乐部基地','你的队伍，准备好了');
html=html.replace('EDWARD GAMING / 五人同行','不止五个名字，是同一支队伍');
html=html.replace('READY TOGETHER.','PLAY AS ONE.');
html=html.replace('TEAM MANAGEMENT','五位选手 · 一个目标');
html=html.replace('首发五人。','五人名单。');
html=html.replace('INDIVIDUALS. ONE TEAM.','每个位置，都很重要');
html=html.replace('PLAYER COLLECTION</small>','把闪光时刻收好</small>').replace('OUR STORY</small>','记住每一次并肩</small>');
html=html.replace('src="app.js"','src="app.js"').replace('src="skin.js"','src="skin.js"');
html=html.replace(/<dialog id="notes-dialog"[\s\S]*?<\/dialog>/,`<dialog id="notes-dialog" class="notes-dialog"><div class="dialog-head"><span>视觉方向 03</span><button class="icon-button" data-close="notes-dialog" aria-label="关闭说明"><svg><use href="#close"/></svg></button></div><h2>清晰、饱满，<br>按下去有回应。</h2><div class="design-rules"><p><b>A / 清爽弹性</b>参考多邻国的清晰轮廓、圆角比例与实色按钮底边。白色界面，以明亮蓝色强调操作。</p><p><b>B / 竞技厚度</b>借鉴皇室战争的厚按键、亮边与主次层级，收敛到白底与少量金色。仅主操作强化高光。</p><p><b>字体重新配对</b>中文 Noto Sans SC，英文和数字 Nunito。标题 800、按钮 700，正文 500，统一字号与笔画。</p></div><a class="primary-button" id="component-link" href="components.html">查看组件与字体 ↗</a><p>所有内容均为视觉样稿，玩法和引擎继续后置。</p></dialog>`);
const icons={
home:'<path fill="#8bbee6" d="M3 11 12 3l9 8v10H3Z"/><path fill="#c8e8ff" d="M5 10 12 5l7 5v9H5Z"/><path fill="#2886c8" d="M9 13h6v8H9Z"/><path fill="#3fa9eb" d="m2 10 10-9 10 9-2 3-8-7-8 7Z"/>',
people:'<path fill="#b3a0da" d="M3 17c0-4 4-6 7-6s7 2 7 6v5H3Z"/><path fill="#d7c9f4" d="M4 15c0-4 4-5 6-5s6 1 6 5v4H4Z"/><circle fill="#ad8cda" cx="10" cy="6" r="5"/><circle fill="#d7b7f3" cx="9" cy="5" r="4"/><path fill="#8ba5d6" d="M18 12c3 0 5 2 5 5v5h-5Z"/><circle fill="#b1c8ec" cx="19" cy="8" r="3"/>',
cards:'<rect x="2" y="4" width="15" height="19" rx="3" fill="#3069aa" transform="rotate(-9 9 13)"/><rect x="7" y="1" width="15" height="21" rx="3" fill="#6cb7ec"/><rect x="9" y="3" width="11" height="15" rx="2" fill="#b9e5ff"/><path fill="#3899d9" d="m14.5 6 4 4.5-4 4.5-4-4.5Z"/>',
bookmark:'<path fill="#d59f31" d="M5 3h14v20l-7-4-7 4Z"/><path fill="#ffd76d" d="M5 1h14v19l-7-4-7 4Z"/><path fill="#fff2bd" d="m12 4 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4Z"/>'
};
for(const [id,content] of Object.entries(icons))html=html.replace(new RegExp('<symbol id="'+id+'"[\\s\\S]*?<\\/symbol>'),'<symbol id="'+id+'" viewBox="0 0 24 24"><g stroke="none">'+content+'</g></symbol>');
fs.writeFileSync(path.join(__dirname,'concept.html'),html);
fs.copyFileSync(path.join(previous,'app.js'),path.join(__dirname,'app.js'));
let skin=fs.readFileSync(path.join(previous,'skin.js'),'utf8').replaceAll("'console'","'arena'").replaceAll("'club'","'playful'");
skin=skin.replace("'#f3f0e6'","'#ffffff'").replace("'#eff1f1'","'#f6f9fd'");
fs.writeFileSync(path.join(__dirname,'skin.js'),skin);
let components=fs.readFileSync(path.join(previous,'components.html'),'utf8').replaceAll('data-skin="club"','data-skin="playful"').replaceAll("'console'","'arena'").replaceAll("'club'","'playful'").replaceAll('skins.css','ui.css').replaceAll('视觉探索02','视觉探索03').replace('COMPONENT STUDY / 02','COMPONENT STUDY / 03');
components=components.replace('<style>','<link rel="stylesheet" href="lab.css"><style>');
components=components.replace('高光面 → 实体侧壁 → 接触阴影','清楚的轮廓 → 明确的侧壁 → 按压反馈');
components=components.replace('按下移动 4px，侧壁从 5px 收至 1px。','按下移动 4px，侧壁同步缩短。');
components=components.replace('<section class="lab-section"><div class="lab-heading"><h2>01',`<section class="type-specimen"><span>字，也要站得稳。</span><h2>每个人，都很重要。</h2><strong>ZmjjKK <b>81</b></strong><p>中文 Noto Sans SC · 数字 Nunito</p></section><section class="lab-section"><div class="lab-heading"><h2>01`);
components=components.replace('</head>','<link rel="stylesheet" href="lab.css"></head>');
fs.writeFileSync(path.join(__dirname,'components.html'),components);
// Selected direction: retain the A/B archive while providing a focused A entry.
let selected=html
 .replace('<title>视觉探索 03 · 白色游戏界面</title>','<title>清爽自然 · 视觉基准 A</title>')
 .replace('FIELDNOTES','VAL MANAGER')
 .replace('ART DIRECTION 03','VISUAL FOUNDATION / A')
 .replace(/<div class="studio-controls">[\s\S]*?<\/header>/,'<div class="studio-controls"><a class="spec-button" href="index.html">回看 A/B 对比 ↗</a><button class="spec-button" id="spec-button">设计语言 ↗</button></div></header>')
 .replace('清晰的白，<em>扎实的手感。</em>','清爽自然，<em>有自己的游戏感。</em>')
 .replace('更干净的面，更明确的侧壁。<br>中文字重、圆润数字和游戏图标一同重做。','以 A 为基础，继续发展属于这支队伍的视觉语言。<br>白底、清晰轮廓、适度厚度，以及自然的人物表达。')
 .replace(/<button class="icon-button theme-mobile"[\s\S]*?<\/button>/,'')
 .replace(/<script>document.documentElement.dataset.skin=[\s\S]*?<\/script>/,'<script>document.documentElement.dataset.skin="playful";</script>')
 .replace('<script src="skin.js"></script>','')
 .replace(/<dialog id="notes-dialog"[\s\S]*?<\/dialog>/,`<dialog id="notes-dialog" class="notes-dialog"><div class="dialog-head"><span>视觉基准 / A</span><button class="icon-button" data-close="notes-dialog" aria-label="关闭说明"><svg><use href="#close"/></svg></button></div><h2>清爽自然，<br>有自己的游戏感。</h2><div class="design-rules"><p><b>保留已经舒服的部分</b>白色底、清晰字重、圆润轮廓、实体按键，以及轻快的反馈。</p><p><b>长出自己的视觉语言</b>围绕选手卡、队伍关系和电竞比赛，发展配色、图标与构图。参考的是设计方法，具体表达属于这款游戏。</p><p><b>按层级分配厚度</b>主按键最明确；次级按钮和可选卡片适度凸起；说明文字与数据区保持轻盈。</p></div><a class="primary-button" id="component-link" href="components-a.html">查看基础组件 ↗</a><p>当前确定整体方向，细节继续打磨。玩法和引擎最后接入。</p></dialog>`);
selected=selected.replace('</head>','<link rel="stylesheet" href="refinements.css"></head>')
 .replace('href="components-a.html"','href="component-kit.html"')
 .replace('</body>','<script src="refinements.js"></script><script src="card-integration.js"></script></body>');
selected=require('./selected-copy.cjs')(selected);
fs.writeFileSync(path.join(__dirname,'selected.html'),selected);
let chosenComponents=components
 .replace(/<button class="lab-switch"[\s\S]*?<\/button>/,'')
 .replace(/<script>document.documentElement.dataset.skin=[\s\S]*?<\/script>/,'<script>document.documentElement.dataset.skin="playful";</script>')
 .replace('<script src="skin.js"></script>','')
 .replace("e.currentTarget.href='concept.html?skin='+document.documentElement.dataset.skin","e.currentTarget.href='selected.html'")
 .replace('href="concept.html" id="back-concept"','href="selected.html" id="back-concept"');
fs.writeFileSync(path.join(__dirname,'components-a.html'),chosenComponents);
let comparison=fs.readFileSync(path.join(previous,'index.html'),'utf8');
comparison=comparison.replaceAll('ROUND TWO','ROUND THREE').replaceAll('>02<','>03<').replaceAll('第二轮','第三轮').replaceAll('温润俱乐部','清爽弹性').replaceAll('精密竞技台','竞技厚度').replaceAll('club','playful').replaceAll('console','arena');
comparison=comparison.replace('象牙白 / 森林绿 / 黄铜细节','参考多邻国 · 清晰轮廓 / 实色侧壁').replace('瓷白 / 石墨灰 / 陶橙按键','参考皇室战争 · 厚按键 / 明确亮边');
comparison=comparison.replace('像桌上的收藏游戏。','清晰、圆润、有弹性。').replace('像一台比赛控制设备。','厚实、饱满、有竞技感。');
comparison=comparison.replace('柔和倒角 · 厚实按键 · 温暖而有重量','白色主场 · 蓝色操作 · 轻快的游戏感').replace('硬朗边角 · 嵌入式面板 · 更鲜明的竞技感','白色主场 · 金色主键 · 更强的动作感');
comparison=comparison.replace('白色，<br>也可以很有<br><em>游戏感。</em>','干净的白，<br>扎实的<br><em>游戏手感。</em>');
comparison=comparison.replace('保留舒服的浅底色。<br>让按钮有厚度，面板有层次，<br>每一次按下都有回应。','借鉴多邻国与皇室战争。<br>重做轮廓、厚度和字体，<br>让立体感更干净、更明确。');
comparison=comparison.replace('主按键 5px 侧壁<br>面板 3px 底边 / 数据内凹','中文 Noto Sans SC<br>英文与数字 Nunito');
comparison=comparison.replace('有层次，也有轻重。','字体和组件，一起重做。');
comparison=comparison.replace('02 / 白色游戏界面探索','03 / 游戏手感与字体探索');
comparison=comparison.replace('<span>03</span>选手名单','<span>02</span>选手名单');
comparison=comparison.replace('</head>','<link rel="stylesheet" href="board.css"></head>');
fs.writeFileSync(path.join(__dirname,'index.html'),comparison);
fs.copyFileSync(path.join(previous,'comparison.css'),path.join(__dirname,'comparison.css'));
console.log('Generated round-three concepts and comparison.');
