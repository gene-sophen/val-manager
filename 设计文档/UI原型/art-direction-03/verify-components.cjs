const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
const p=await browser.newPage({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
const base='http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/art-direction-03/');
await p.goto(base+'component-kit.html');await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:path.join(__dirname,'preview/06-component-kit.png'),fullPage:true});
await p.locator('[data-busy-demo]').click();assert.equal(await p.locator('[data-busy-demo]').getAttribute('aria-busy'),'true');
await p.locator('#kit-toast').waitFor({state:'visible'});assert.equal(await p.locator('[data-busy-demo]').isDisabled(),false);
await p.locator('[data-card-select]').first().click();assert.equal(await p.locator('#sample-count').innerText(),'2');
await p.locator('[data-state="error"]').click();await p.locator('#retry-demo').click();await p.getByRole('heading',{name:'重新加载成功'}).waitFor();
await p.locator('[data-open-confirm]').first().click();await p.locator('[data-confirm-cancel]').click();assert.equal(await p.locator('#confirm-sheet').evaluate(d=>d.open),false);
await p.setViewportSize({width:390,height:844});await p.goto(base+'selected.html#squad');await p.evaluate(()=>document.fonts.ready);
await p.locator('#roster-query').fill('nobody');assert.equal(await p.locator('.player-row:visible').count(),1);
await p.locator('#roster-query').fill('no-match');assert.equal(await p.locator('#filter-empty').isVisible(),true);
await p.locator('[data-reset-all]').click();assert.equal(await p.locator('.player-row:visible').count(),5);
await p.locator('#open-filter').click();await p.locator('[data-choice-group="tier"] [data-value="银"]').click();await p.keyboard.press('Escape');
assert.equal(await p.locator('.player-row:visible').count(),5);assert.equal(await p.locator('#open-filter').evaluate(e=>e===document.activeElement),true);
await p.locator('#open-filter').click();await p.locator('[data-choice-group="tier"] [data-value="金"]').click();await p.locator('[data-choice-group="sort"] [data-value="rating"]').click();
await p.screenshot({path:path.join(__dirname,'preview/07-filter-sheet.png')});await p.locator('#filter-apply').click();
assert.equal(await p.locator('.player-row:visible').count(),3);assert.equal(await p.locator('.player-row:visible').first().getAttribute('data-player'),'CHICHOO');
await p.screenshot({path:path.join(__dirname,'preview/08-filtered-roster.png')});
await p.locator('.player-row:visible').first().click();assert.equal(await p.locator('#player-name').innerText(),'CHICHOO');
for(const width of [360,390,430]){await p.setViewportSize({width,height:780});await p.goto(base+'component-kit.html');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('[data-open-filter]').first().click();const r=await p.locator('#filter-sheet').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1&&r.y+r.height<=781);await p.keyboard.press('Escape');}
assert.deepEqual(errors,[]);console.log('PASS: loading, selection, retry, confirmation, search, empty state, filter cancel/apply, focus return, sort, and 360/390/430 sheet layout.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
