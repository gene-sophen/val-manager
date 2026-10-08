const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 const base='http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/art-direction-03/');
 const snap=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(__dirname,'preview',name),fullPage:true})};
 const ready=()=>page.waitForFunction(()=>!document.getElementById('main-action').disabled);
 const count=()=>page.locator('#stage-kicker').innerText();
 const phase=()=>page.locator('.pack-phone').getAttribute('data-phase');
 const checkWidth=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
 const drag=async(selector,dx,dy=0)=>{const r=await page.locator(selector).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up()};
 await page.goto(base+'pack.html');await page.waitForLoadState('networkidle');await snap('16-pack-clean.png');
 await drag('.pack-touch',28);assert.equal(await phase(),'sealed','small drag must cancel');
 await drag('.pack-touch',100);await page.locator('.card-touch').waitFor();await ready();assert.equal(await count(),'01 / 10');
 await page.waitForTimeout(320);await snap('17-continuous-stack.png');
 await drag('.card-touch',-25);assert.equal(await count(),'01 / 10','small card drag must cancel');
 await drag('.card-touch',-100);await ready();assert.equal(await count(),'02 / 10','one swipe reveals exactly one next card');
 await page.locator('#back-action').click();assert.equal(await count(),'01 / 10');
 // Real browser touch events test the mobile path, not just synthetic event handlers.
 const cdp=await page.context().newCDPSession(page);const r=await page.locator('.card-touch').boundingBox(),x=r.x+r.width*.65,y=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let d=10;d<=100;d+=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-d,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready();assert.equal(await count(),'02 / 10','touch swipe');
 await page.locator('#inspect-action').click();assert.equal(await page.locator('#result-dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
 await page.locator('.card-touch').focus();await page.keyboard.press('ArrowLeft');await ready();assert.equal(await count(),'03 / 10');
 await page.keyboard.press('ArrowRight');assert.equal(await count(),'02 / 10');
 for(let i=2;i<10;i++){await page.locator('#main-action').click();await ready()}
 assert.equal(await count(),'10 / 10');assert.equal(await page.locator('#pack-stage .collectible').getAttribute('data-tier'),'钻');await page.waitForTimeout(850);await snap('18-diamond-stack.png');
 await page.locator('#main-action').click();assert.equal(await page.locator('.result-item').count(),10);await snap('19-compact-results.png');
 await page.locator('[data-result="9"]').click();assert.equal(await page.locator('#result-detail [data-tier="钻"]').count(),1);await page.keyboard.press('Escape');
 await page.locator('#main-action').click();await page.locator('#main-action').click();await page.locator('#skip').click();await page.waitForTimeout(750);assert.equal(await phase(),'summary','skip cancels opening callback');
 await page.locator('#main-action').click();await page.locator('#main-action').click();await page.locator('.card-touch').waitFor();await page.locator('.card-touch').dblclick({delay:20});await ready();assert.equal(await count(),'02 / 10','rapid taps must not skip cards');
 await page.locator('#main-action').click();await page.locator('#skip').click();await page.waitForTimeout(500);assert.equal(await phase(),'summary','skip cancels transition');
 for(const [width,height] of [[360,740],[390,844],[430,932],[360,640]]){
  await page.setViewportSize({width,height});await page.goto(base+'pack.html');await checkWidth();await page.locator('#main-action').click();await page.locator('.card-touch').waitFor();await checkWidth();const b=await page.locator('#main-action').boundingBox();assert(b.y+b.height<=height,`main action outside ${width}x${height}`);await page.locator('#skip').click();await checkWidth();
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'pack.html');await page.locator('#main-action').click();await page.locator('.card-touch').waitFor();assert.equal(await page.locator('.card-touch').evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1060});await page.goto(base+'pack.html');await snap('20-pack-flow-desktop.png');
 await page.goto(base+'cards.html');await page.waitForLoadState('networkidle');await snap('21-card-copy.png');await page.locator('[data-card="3"]').click();await page.keyboard.press('Escape');
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});for(const file of ['cards.html','selected.html#home','selected.html#squad','selected.html#detail']){await page.goto(base+file);await page.waitForLoadState('networkidle');await checkWidth();assert.deepEqual(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)),[])}}
 await page.setViewportSize({width:390,height:844});await page.goto(base+'selected.html#squad');await snap('22-roster-clean.png');await page.locator('#open-filter').click();assert.equal(await page.locator('#filter-title').innerText(),'筛选选手');await page.keyboard.press('Escape');
 await page.goto(base+'selected.html#detail');await page.locator('[data-edition="diamond"]').click();await page.waitForLoadState('networkidle');assert.equal(await page.frameLocator('#card-frame').locator('[data-tier="钻"]').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS: seal drag/cancel, card drag/cancel, actual touch, single-action next, keyboard, rapid taps, inspect, 10-card result, skip race cancellation, compact summary, reduced motion, 360/390/430 and short screens, clean copy, integrated details, no JS/resource errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
