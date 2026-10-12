// Headless development tests, a fresh browser context and uniquely named test DB only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),runtime=process.env.VM_TEST_NODE_MODULES||'C:/Users/13670/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const out=path.join(root,'docs/validation/2026-10-12-player-experience');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.VM_TEST_CHROME||'C:/Users/13670/AppData/Local/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto('http://127.0.0.1:8765/游戏/out/career-browser-check.html?ux=matrix');
 const name=await page.locator('meta[name=career-test-database]').getAttribute('content');assert(/^val-manager-test-/.test(name));
 await page.getByRole('button',{name:'开始征战 →',exact:true}).waitFor();
 const matrix=[];
 const chapters=await page.locator('#page-list button').evaluateAll(es=>es.map(e=>({route:e.dataset.preview,text:e.textContent})));
 for(const largeText of [false,true]){if(largeText){await page.setViewportSize({width:1280,height:960});await page.locator('.header-menu[data-go="archive/settings"]').click();await page.getByLabel('放大文字',{exact:true}).check();}for(const item of chapters){
  await page.setViewportSize({width:1280,height:960});await page.locator('#page-list [data-preview="'+item.route+'"]').click();
  for(const size of [{width:320,height:640},{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:960}]){
   await page.setViewportSize(size);await page.screenshot();
   const result=await page.evaluate(()=>{const app=document.querySelector('.app-phone'),body=document.getElementById('page-body'),ar=app.getBoundingClientRect();return {route:location.hash,width:window.innerWidth,overflow:body.scrollWidth>body.clientWidth+2,small:[...app.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.height&&r.width&&!e.closest('details:not([open])')&&!e.closest('dialog:not([open])')&&(r.height<43||r.width<43);}).map(e=>e.textContent.trim()),outside:[...app.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.height&&!e.closest('details:not([open])')&&!e.closest('dialog:not([open])')&&(r.left<ar.left-2||r.right>ar.right+2);}).map(e=>e.textContent.trim())};});
   matrix.push({page:item.text,size,largeText,...result});
   if(size.width===390&&['campaign','campaign/compare','campaign/tactics','campaign/agents','campaign/reinforce-review','archive/player/ZmjjKK-金'].includes(item.route))await page.screenshot({path:path.join(out,item.route.replaceAll('/','-')+(largeText?'-large':'')+'.png')});
  }
 }}
 fs.writeFileSync(path.join(out,'layout-matrix.json'),JSON.stringify({database:name,errors,matrix},null,2));
 console.log(JSON.stringify({database:name,pages:chapters.length,checks:matrix.length,errors,layoutIssues:matrix.filter(m=>m.overflow||m.small.length||m.outside.length)}));
 await context.close();await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
