const {chromium}=require('playwright');const assert=require('assert/strict');const path=require('path');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1040,height:1160},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/navigation-rebuild-01/index.html')+'#campaign');await p.evaluate(()=>document.fonts.ready);
await p.locator('[data-action="calendar"]').click();assert.equal(await p.locator('#page-title').innerText(),'赛年赛历');assert(await p.locator('#main-nav').isHidden());assert.equal(await p.locator('.past-phases').evaluate(e=>e.open),false);
await p.screenshot({path:path.join(__dirname,'preview/calendar-refined.png'),fullPage:true});
await p.locator('.past-phases summary').click();await p.locator('#nav-scroll').evaluate(e=>e.scrollTop=100);await p.waitForTimeout(60);const rememberedScroll=await p.locator('#nav-scroll').evaluate(e=>e.scrollTop);
await p.locator('#subpage-dock [data-go="campaign/prepare"]').click();assert.equal(await p.locator('#page-title').innerText(),'赛前备战');await p.screenshot({path:path.join(__dirname,'preview/prepare-refined.png'),fullPage:true});
await p.locator('.roster-disclosure summary').click();assert.equal(await p.locator('.prep-roster .balance-card').count(),5);await p.locator('.prep-roster .balance-card').first().click();assert(await p.locator('#nav-dialog').evaluate(e=>e.open));await p.keyboard.press('Escape');assert(await p.locator('.roster-disclosure').evaluate(e=>e.open));
await p.locator('[data-action="bp-order"]').click();assert.equal(await p.locator('.bp-order li').count(),7);await p.keyboard.press('Escape');
await p.locator('#page-back').click();await p.waitForFunction(()=>location.hash==='#campaign/calendar');assert(await p.locator('.past-phases').evaluate(e=>e.open));assert(Math.abs(await p.locator('#nav-scroll').evaluate(e=>e.scrollTop)-rememberedScroll)<2,'scroll should restore '+rememberedScroll);
await p.locator('#page-back').click();await p.waitForFunction(()=>location.hash==='#campaign');assert(await p.locator('[data-action="calendar"]').evaluate(e=>e===document.activeElement));
await p.locator('[data-action="prepare"]').click();await p.locator('#page-back').click();await p.waitForFunction(()=>location.hash==='#campaign');assert(await p.locator('[data-action="prepare"]').evaluate(e=>e===document.activeElement));
for(const width of [320,360,390,430]){await p.setViewportSize({width,height:640});for(const route of ['calendar','prepare']){
 await p.evaluate(r=>location.hash='campaign/'+r,route);await p.waitForTimeout(50);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.locator('#nav-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 assert(await p.locator('.nav-phone').evaluate(e=>{const body=e.querySelector('#nav-scroll').getBoundingClientRect(),dock=e.querySelector('#subpage-dock').getBoundingClientRect();return body.bottom<=dock.top+1&&dock.bottom<=e.getBoundingClientRect().bottom+1;}));
}}
await p.setViewportSize({width:360,height:640});await p.evaluate(()=>location.hash='campaign/prepare');await p.waitForTimeout(50);await p.locator('.roster-disclosure').evaluate(e=>e.open=false);await p.locator('.nav-phone').screenshot({path:path.join(__dirname,'preview/prepare-small.png')});
await p.reload();await p.locator('#page-back').click();await p.waitForTimeout(100);assert.equal(await p.locator('#page-title').innerText(),'征战');
assert.deepEqual(errors,[]);console.log('PASS subpage routes, source-aware back, focus/scroll restoration, disclosure/details, BP reference, 320–430px and short-screen dock.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
