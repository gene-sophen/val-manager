// Real current frontend, separate unique test DB and legacy/preview keys. No default DB access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'设计文档/UI原型/complete-prototype-01'),base='/设计文档/UI原型/complete-prototype-01/';
const name='val-manager-test-ui-'+crypto.randomUUID();let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace('<head>','<head><meta name="career-test-database" content="'+name+'"><base href="'+base+'">').replace('VAL MANAGER / UI PROTOTYPE','独立完整征战验收 / '+name).replace('这一年，由你执教。','验收赛年，不使用个人存档。');
if(!process.argv.includes('--production-layout'))html=html.replace('<body>','<body class="qa-workbench">');
const output=path.join(root,'游戏/out/career-browser-check.html');fs.writeFileSync(output,html);console.log(JSON.stringify({output,database:name}));
