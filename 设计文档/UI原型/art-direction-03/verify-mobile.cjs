const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 const base='http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/art-direction-03/');
 const ready=async()=>{await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready)};
 const snap=async name=>{await ready();await page.screenshot({path:path.join(__dirname,'preview',name),fullPage:true})};
 const overflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
 const box=s=>page.locator(s).boundingBox();
 const apart=async(a,b)=>{const x=await box(a),y=await box(b);assert(x&&y&&x.y+x.height<=y.y+1,`${a} overlaps ${b}: ${JSON.stringify({x,y})}`)};
 await page.goto(base+'mobile.html#album');await ready();assert.equal(await page.locator('.album-tile').count(),22);await snap('24-mobile-album.png');
 await page.locator('#collection-filter').click();await page.locator('[data-field="region"][data-value="PAC"]').click();await page.locator('[aria-label="关闭筛选"]').click();assert.equal(await page.locator('.album-tile').count(),22,'cancel must discard draft');
 await page.locator('#collection-filter').click();await page.locator('[data-field="region"][data-value="PAC"]').click();await page.locator('[data-field="sort"][data-value="rating"]').click();await snap('25-mobile-filters.png');await page.locator('#apply-filters').click();assert.equal(await page.locator('.album-tile').count(),4);
 await page.locator('#collection-query').fill('nothing-matches');assert.equal(await page.locator('.empty-list').count(),1);await page.locator('#clear-collection-query').click();assert.equal(await page.locator('.album-tile').count(),4);
 await page.locator('.album-tile').first().click();await page.locator('#page-back').click();await page.waitForURL(/#album$/);assert.equal(await page.locator('.album-tile').count(),4);assert.match(await page.locator('#active-filters').innerText(),/太平洋/);
 await page.locator('[data-clear-filter="region"]').click();await page.locator('[data-clear-filter="sort"]').click();
 await page.locator('#mobile-scroll').evaluate(e=>e.scrollTop=480);await page.waitForTimeout(150);const saved=await page.locator('#mobile-scroll').evaluate(e=>e.scrollTop);
 await page.locator('.album-tile').nth(4).click();await ready();await snap('26-mobile-detail.png');await page.goBack();await page.waitForURL(/#album$/);assert(Math.abs(await page.locator('#mobile-scroll').evaluate(e=>e.scrollTop)-saved)<5,'back restores scroll');
 await page.locator('#collection-filter').click();await page.locator('[data-field="tier"][data-value="钻"]').click();await page.locator('#apply-filters').click();assert.equal(await page.locator('.album-tile').count(),1);await page.reload();await ready();assert.equal(await page.locator('.album-tile').count(),1,'refresh retains filter');
 await page.locator('#header-pack').click();await page.locator('#pack-host .pack-phone').waitFor();await page.locator('#pack-host #skip').click();assert.equal(await page.locator('#pack-host .result-item').count(),10);await snap('27-mobile-pack-results.png');
 await page.locator('#pack-host [data-result="9"]').click();await page.waitForURL(/#card/);assert.equal(await page.locator('.detail-card-bed [data-tier="钻"]').count(),1);await page.locator('#page-back').click();await page.waitForURL(/#pack$/);assert.equal(await page.locator('#pack-host .result-item').count(),10,'return keeps results');
 await page.locator('#pack-host #main-action').click();await page.waitForURL(/#album$/);assert.equal(await page.locator('.album-tile').count(),1,'pack return keeps album filter');await page.locator('#header-pack').click();await page.waitForURL(/#pack$/);assert.equal(await page.locator('#pack-host .pack-phone').getAttribute('data-phase'),'sealed','new pack entry resets completed sequence');await page.locator('#pack-host .pack-header>a').click();
 await page.locator('#mobile-nav a[href="#players"]').click();await page.locator('.roster-link').first().click();await page.locator('.edition-switch a').last().click();await page.locator('#page-back').click();await page.waitForURL(/#players$/);
 await page.locator('#mobile-nav a[href="#home"]').click();await snap('28-mobile-home.png');
 for(const [width,height] of [[320,640],[360,640],[390,844],[430,932]]){
  await page.setViewportSize({width,height});await page.goto(base+'mobile.html#album');await ready();await overflow();await apart('.mobile-header','#mobile-scroll');await apart('#mobile-scroll','#mobile-nav');
  await page.locator('#collection-filter').click();assert((await box('#album-filters')).y>=0);await page.locator('#reset-draft').click();await page.locator('#apply-filters').click();
  const bad=await page.locator('.album-tile').evaluateAll(es=>es.flatMap(e=>{const picture=e.querySelector('.tile-image').getBoundingClientRect(),title=e.querySelector('.tile-info strong').getBoundingClientRect(),meta=e.querySelector('.tile-meta').getBoundingClientRect();return picture.bottom>title.top||title.bottom>meta.top?[e.textContent]:[]}));assert.deepEqual(bad,[],'tile text overlap');
  await page.locator('.album-tile[data-tier="钻"]').click();await ready();const overflowCard=await page.locator('.detail-card-bed .card-face').evaluate(e=>e.querySelector('.card-foot').getBoundingClientRect().bottom>e.getBoundingClientRect().bottom);assert.equal(overflowCard,false);await apart('.detail-meta','.detail-card-bed');
  await page.goto(base+'mobile.html#pack');await page.reload();await page.locator('#pack-host .pack-phone').waitFor();await page.locator('#pack-host #main-action').click();await page.locator('#pack-host .card-touch').waitFor();await page.waitForTimeout(320);await apart('#pack-host .pack-heading','#pack-host .card-touch');await apart('#pack-host .card-touch','#pack-host #progress');await apart('#pack-host .stack-under i:first-child','#pack-host #progress');await apart('#pack-host #progress','#pack-host #main-action');
  const action=await box('#pack-host #main-action');assert(action.y+action.height<=height,`pack action outside ${width}x${height}`);await overflow();
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'mobile.html#album');await page.locator('.album-tile').first().evaluate(e=>e.querySelector('strong').textContent='A-VERY-LONG-PLAYER-NAME');await apart('.album-tile:first-child .tile-info strong','.album-tile:first-child .tile-meta');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'mobile.html#album');await snap('29-mobile-desktop.png');
 assert.deepEqual(await page.locator('img').evaluateAll(es=>es.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)),[]);assert.deepEqual(errors,[]);console.log('PASS: album, region/tier/sort, cancel, search/empty, refresh, back scroll, detail editions, pack-result-detail-return, unified nav, 320/360/390/430 and short screens, text/card/control separation, long names, and no resource/JS errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
