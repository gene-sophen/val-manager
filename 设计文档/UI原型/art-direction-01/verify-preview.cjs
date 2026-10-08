const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1150},deviceScaleFactor:1,reducedMotion:'reduce'});
  const problems=[];
  page.on('pageerror',e=>problems.push(e.message));
  page.on('response',r=>{if(r.status()>=400)problems.push(r.status()+' '+r.url());});
  const base='http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/art-direction-01/index.html');
  const out=path.join(__dirname,'preview');fs.mkdirSync(out,{recursive:true});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  await page.frameLocator('#card-frame').locator('.card.visible').waitFor();
  await page.screenshot({path:path.join(out,'01-graphite-board.png'),fullPage:true});
  await page.getByRole('button',{name:'暖灰白',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'paper');
  await page.screenshot({path:path.join(out,'02-paper-board.png'),fullPage:true});
  await page.locator('[data-player="CHICHOO"]').click();
  assert.equal(await page.locator('#player-name').innerText(),'CHICHOO');
  assert.equal(await page.locator('[data-edition="diamond"]').isDisabled(),true);
  await page.locator('[data-player="Haodong"]').click();
  await page.frameLocator('#card-frame').locator('.card.r-铜.visible').waitFor();
  await page.locator('#sort-button').click();
  assert.equal(await page.locator('.player-row').first().getAttribute('data-player'),'CHICHOO');
  await page.locator('[data-roster-view="portraits"]').click();
  assert.equal(await page.locator('.player-list.portraits').count(),1);
  await page.locator('[data-roster-view="list"]').click();
  await page.locator('#spec-button').click();assert.equal(await page.locator('#notes-dialog').evaluate(d=>d.open),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#notes-dialog').evaluate(d=>d.open),false);
  await page.setViewportSize({width:390,height:844});await page.goto(base+'#home');await page.evaluate(()=>{setTheme('graphite');showView('home',false);});
  await page.screenshot({path:path.join(out,'03-mobile-home.png')});
  await page.locator('#home-screen [data-target="squad"]').first().click();
  assert.equal(await page.locator('[data-view="squad"]').isVisible(),true);
  await page.screenshot({path:path.join(out,'04-mobile-roster.png')});
  await page.locator('[data-player="ZmjjKK"].player-row').click();
  await page.frameLocator('#card-frame').locator('.card.visible').waitFor();
  await page.screenshot({path:path.join(out,'05-mobile-player.png')});
  await page.locator('[data-edition="diamond"]').click();
  await page.frameLocator('#card-frame').locator('.card.r-钻.visible').waitFor();
  const rating=await page.frameLocator('#card-frame').locator('.rating').innerText();
  assert.match(rating,/^\d+$/);
  await page.locator('#favorite-button').click();
  assert.equal(await page.locator('#favorite-button').getAttribute('aria-pressed'),'true');
  await page.locator('#view-art-button').click();
  await page.frameLocator('#full-card-frame').locator('.card.r-钻.visible').waitFor();
  await page.screenshot({path:path.join(out,'06-mobile-card.png')});
  await page.keyboard.press('Escape');
  for(const width of [360,390,430]){
    await page.setViewportSize({width,height:780});
    for(const view of ['home','squad','detail']){
      await page.evaluate(view=>showView(view),view);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}/${view}`);
    }
  }
  await page.goto(base+'?theme=paper#home');await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'07-mobile-paper.png')});
  const imageFailures=[];
  for(const frame of page.frames()) imageFailures.push(...await frame.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)));
  assert.deepEqual(imageFailures,[]);
  assert.deepEqual(problems,[]);
  console.log(JSON.stringify({status:'passed',viewports:[360,390,430,1440],checks:['theme','player selection','bronze artwork','diamond artwork','sorting','portrait layout','dialogs','favorite','mobile navigation','horizontal overflow','image loading','console errors'],screenshots:out},null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
