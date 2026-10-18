// CDP touch input, not wheel / scrollTop assignment. Only disposable test databases.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),app=path.join(root,'设计文档/UI原型/complete-prototype-01');
const out=process.env.VM_TEST_OUTPUT||path.join(root,'docs/validation/2026-10-18-scroll-simulation/touch');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(path.join(process.env.VM_TEST_NODE_MODULES||'C:/Users/13670/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));
let browser;const checks=[],errors=[];
(async()=>{
 const name='val-manager-test-touch-'+crypto.randomUUID();
 const html=fs.readFileSync(path.join(app,'index.html'),'utf8').replace('<head>','<head><meta name="career-test-database" content="'+name+'"><base href="/设计文档/UI原型/complete-prototype-01/">');
 fs.writeFileSync(path.join(root,'游戏/out/career-browser-check.html'),html);
 browser=await chromium.launch({headless:true,executablePath:process.env.VM_TEST_CHROME||'C:/Users/13670/AppData/Local/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),cdp=await p.context().newCDPSession(p);
 p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.VM_TEST_BASE_URL||'http://127.0.0.1:8765')+'/游戏/out/career-browser-check.html');await p.locator('.opening-screen').waitFor();
 async function swipe(container,direction='up',origin){
  if(origin)await p.locator(container+' '+origin).first().scrollIntoViewIfNeeded();
  const data=await p.locator(container).evaluate((e,origin)=>{const root=e.id==='nav-scroll',owner=root?VM_BOOT.scroll.element:e,box=e.getBoundingClientRect(),r=root?{left:box.left,right:box.right,width:box.width,top:document.querySelector('#app-top').getBoundingClientRect().bottom,bottom:document.querySelector('#subpage-dock').hidden?document.querySelector('#main-nav').getBoundingClientRect().top:document.querySelector('#subpage-dock').getBoundingClientRect().top}:box,q=origin?e.querySelector(origin)?.getBoundingClientRect():null;const x=q?Math.max(r.left+12,Math.min(r.right-12,q.left+q.width/2)):r.left+r.width*.6;const y=q?Math.max(r.top+55,Math.min(r.bottom-55,q.top+q.height/2)):r.top+(r.bottom-r.top)*.72;return {before:owner.scrollTop,height:owner.clientHeight,total:owner.scrollHeight,x,y,top:r.top,bottom:r.bottom,hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,200)};},origin);
  const distance=Math.min(240,(data.bottom-data.top)*.38),start=direction==='up'?data.y:Math.max(data.top+20,data.y-distance),end=direction==='up'?Math.max(data.top+20,start-distance):Math.min(data.bottom-20,start+distance);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:data.x,y:start}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:data.x,y:start+(end-start)*i/12}]});await p.waitForTimeout(18);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(320);
  return {...data,after:await p.locator(container).evaluate(e=>(e.id==='nav-scroll'?VM_BOOT.scroll.element:e).scrollTop),direction,origin:origin||'text'};
 }
 async function check(label,container,origin){const a=await swipe(container,'up',origin),b=await swipe(container,'down');const row={label,container,up:a,down:b,pass:a.after>a.before+5&&b.after<b.before-5};checks.push(row);await p.screenshot({path:path.join(out,label+'.png')});if(!process.argv.includes('--baseline'))assert(row.pass,JSON.stringify(row));}
 async function preview(route){await p.locator('#page-list [data-preview="'+route+'"]').evaluate(e=>e.click());await p.waitForTimeout(250);}
 await preview('archive/settings');await check('settings','#nav-scroll');
 for(let i=0;i<14;i++)await swipe('#nav-scroll');const bottom=await p.locator('.danger-zone').boundingBox(),nav=await p.locator('#main-nav').boundingBox();await p.locator('.restart-card [data-action=clear-career]').tap();assert(await p.locator('#app-dialog[open]').count());await p.keyboard.press('Escape');checks.push({label:'last-item-visible-and-tappable',pass:bottom.y+bottom.height<=nav.y+1,bottom,nav});
 await preview('archive/album');await check('card-image','#nav-scroll','.card-thumb img');
 await p.setViewportSize({width:390,height:568});await p.locator('.card-thumb').first().tap();await p.locator('#app-dialog[open]').waitFor();await check('player-dialog','#dialog-body');await p.locator('#dialog-close').tap();await check('after-dialog-close','#nav-scroll');await p.setViewportSize({width:390,height:844});
 await p.locator('#filter-entry').tap();await p.setViewportSize({width:640,height:320});await check('filter-landscape','#filter-fields');await p.locator('#filter-close').tap();await p.setViewportSize({width:390,height:844});
 await preview('campaign/pick');await check('draft-cards','#nav-scroll','.card-thumb img');
 await p.locator('[data-scene=map-split]').evaluate(e=>e.click());await p.locator('.spatial-replay').waitFor();await check('sandtable','#nav-scroll','.spatial-map');
 await p.locator('[data-spatial-expand]').tap();await p.locator('.spatial-focus[open]').waitFor();const focus=await p.locator('.spatial-focus').evaluate(e=>({total:e.scrollHeight,height:e.clientHeight}));if(focus.total>focus.height+10)await check('fullscreen','.spatial-focus');else checks.push({label:'fullscreen-fits',pass:true,...focus});await p.keyboard.press('Escape');await check('after-fullscreen-close','#nav-scroll');
 // Keep reading the lower report when a committed manual point rebuilds the view.
 await p.locator('#subpage-dock [data-action=next-round]').tap();await p.waitForTimeout(450);const before=await p.evaluate(()=>VM_BOOT.scroll.top);await p.locator('#subpage-dock [data-action=next-round]').tap();await p.locator('#round-busy').waitFor({state:'hidden',timeout:60000});await p.waitForTimeout(500);const after=await p.evaluate(()=>VM_BOOT.scroll.top);checks.push({label:'manual-round-preserves-reading-position',before,after,pass:before>50&&after>50});
 assert.deepEqual(errors,[]);assert(checks.every(x=>x.pass)||process.argv.includes('--baseline'));
 fs.writeFileSync(path.join(out,'touch-checks.json'),JSON.stringify({database:name,emulatedTouch:true,realDeviceVerified:false,checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,failures:checks.filter(x=>!x.pass),errors}));await browser.close();
})().catch(async error=>{fs.writeFileSync(path.join(out,'touch-failure.json'),JSON.stringify({checks,errors,error:error.message},null,2));console.error(error);await browser?.close();process.exitCode=1;});
