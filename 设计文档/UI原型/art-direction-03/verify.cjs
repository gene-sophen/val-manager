const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1210},reducedMotion:'reduce',deviceScaleFactor:1});
 const problems=[];page.on('pageerror',e=>problems.push(e.message));page.on('response',r=>{if(r.status()>=400)problems.push(r.status()+' '+r.url())});
 const base='http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/art-direction-03/');const dir=path.join(__dirname,'preview');fs.mkdirSync(dir,{recursive:true});
 async function fonts(){await Promise.all(page.frames().map(f=>f.evaluate(()=>document.fonts.ready)));}
 await page.goto(base+'index.html');await fonts();await page.screenshot({path:path.join(dir,'01-home-comparison.png'),fullPage:true});
 for(const view of ['squad','detail','components']){
   await page.locator('[data-page="'+view+'"]').click();await page.waitForLoadState('networkidle');await fonts();
   const frame=page.frameLocator('#playful-frame');
   if(view!=='components')assert.equal(await frame.locator('[data-view="'+view+'"] .app-screen').isVisible(),true);
   else assert.equal(await frame.locator('.type-specimen').isVisible(),true);
   await page.screenshot({path:path.join(dir,({squad:'02',detail:'03',components:'04'}[view])+'-'+view+'-comparison.png'),fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 for(const skin of ['playful','arena']){
  await page.goto(base+'concept.html?skin='+skin+'#home');await fonts();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('VMRound')),true);
  assert.equal(await page.evaluate(()=>document.fonts.check('800 16px VMText','选手名单')),true);
  await page.screenshot({path:path.join(dir,'mobile-'+skin+'-home.png')});
  await page.locator('#home-screen .line-action').click();assert.equal(await page.locator('[data-view="squad"]').isVisible(),true);
  await page.locator('.player-row[data-player="CHICHOO"]').click();assert.equal(await page.locator('#player-name').innerText(),'CHICHOO');
  await page.locator('#detail-screen [data-target="squad"]').click();await page.locator('.player-row[data-player="ZmjjKK"]').click();
  await page.locator('[data-edition="diamond"]').click();await page.frameLocator('#card-frame').locator('.card.r-钻.visible').waitFor();
  await page.locator('#view-art-button').click();assert.equal(await page.locator('#art-dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
  await page.goto(base+'components.html?skin='+skin);await fonts();
  const primary=page.locator('#demo-primary');const before=await primary.evaluate(e=>getComputedStyle(e).transform);
  const r=await primary.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  const after=await primary.evaluate(e=>getComputedStyle(e).transform);assert.notEqual(before,after,'Button must physically depress');
  await page.screenshot({path:path.join(dir,'pressed-'+skin+'.png')});await page.mouse.up();
  assert.ok((await page.locator('#lab-feedback').innerText()).includes('已按下'));
  await page.locator('.view-switch button').nth(1).click();assert.equal(await page.locator('.view-switch button').nth(1).getAttribute('aria-pressed'),'true');
 }
 for(const width of [360,390,430])for(const skin of ['playful','arena']){
  await page.setViewportSize({width,height:780});await page.goto(base+'concept.html?skin='+skin);await fonts();
  for(const view of ['home','squad','detail']){
   await page.evaluate(view=>showView(view,false),view);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow ${width}/${skin}/${view}`);
   const nav=page.locator('[data-view="'+view+'"] '+(view==='detail'?'.detail-footer':'.bottom-nav'));
   const box=await nav.boundingBox();assert.ok(box.y+box.height<=781,`Footer clipped ${width}/${skin}/${view}`);
  }
 }
 await page.goto(base+'index.html');await fonts();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-mobile-skin="arena"]').click();assert.equal(await page.locator('[data-concept="arena"]').isVisible(),true);
 await page.goto(base+'concept.html?skin=playful');await fonts();
 for(const frame of page.frames()){assert.deepEqual(await frame.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);}
 assert.deepEqual(problems,[]);
 console.log(JSON.stringify({status:'passed',checks:['A/B and page switch','local variable fonts','roster navigation','diamond and full art','physical button depression','selected states','360/390/430 horizontal bounds and bottom navigation','mobile comparison','images and browser errors'],screenshots:dir},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
