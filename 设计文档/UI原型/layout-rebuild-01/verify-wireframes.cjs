const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1040,height:1280},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dir=path.join(__dirname,'preview');fs.mkdirSync(dir,{recursive:true});
 await page.goto('http://127.0.0.1:8765/'+encodeURI('设计文档/UI原型/layout-rebuild-01/wireframes.html'));
 await page.evaluate(()=>document.fonts.ready);
 const snapshots=[];
 for(const size of ['regular','small']){
  await page.locator('#viewport').selectOption(size);
  for(const name of ['home','players','album']){
   await page.locator(`[data-page="${name}"]`).click();
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
   const geometry=await page.locator('.phone').evaluateAll(phones=>phones.map(phone=>{
    const body=phone.querySelector('.phone-body'), header=phone.querySelector('.phone-header'), nav=phone.querySelector('.phone-nav');
    const first=phone.querySelector('[data-results]>article');
    const rect=e=>e.getBoundingClientRect();
    return {layout:phone.dataset.layout,width:phone.clientWidth,overflow:body.scrollWidth>body.clientWidth+1,headerOverflow:header.scrollWidth>header.clientWidth+1,bodyOverNav:rect(body).bottom>rect(nav).top+1,firstTop:first?Math.round(rect(first).top-rect(phone).top):null,broken:[...phone.querySelectorAll('img')].filter(i=>!i.naturalWidth).map(i=>i.src)};
   }));
   for(const g of geometry){assert(!g.overflow,JSON.stringify(g));assert(!g.headerOverflow,JSON.stringify(g));assert(!g.bodyOverNav,JSON.stringify(g));assert.equal(g.broken.length,0,JSON.stringify(g));if(name==='album')assert(g.firstTop<=210,JSON.stringify(g));}
   snapshots.push({size,page:name,geometry});
   await page.screenshot({path:path.join(dir,`${size}-${name}.png`),fullPage:true});
  }
 }
 await page.locator('[data-page="players"]').click();
 await page.locator('[data-layout="L1"] [data-search]').fill('CHICHOO');
 assert.equal(await page.locator('.player-row').count(),1);assert.equal(await page.locator('.player-portrait').count(),1);
 await page.locator('[data-layout="L1"] [data-search]').fill('');
 await page.locator('[data-layout="L1"] [data-sort]').click();
 assert.match(await page.locator('.player-row').first().innerText(),/CHICHOO/);
 await page.locator('[data-page="album"]').click();
 await page.locator('[data-tier="钻"]').click();
 assert.equal(await page.locator('.collection-card').count(),2);
 await page.locator('[data-layout="L2"] [data-filter]').click();
 await page.locator('#quality-options [data-tier="all"]').click();
 assert.equal(await page.locator('.collection-card').count(),44);
 await page.locator('[data-layout="L1"] [data-search]').fill('no-such-player');
 assert.equal(await page.locator('.empty').count(),2);
 await page.locator('[data-layout="L1"] [data-search]').fill('');
 await page.locator('[data-layout="L1"] [data-go="home"]').click();
 assert.equal(await page.locator('.home-content').count(),2);
 await page.locator('#viewport').selectOption('regular');
 for(const width of [320,375,430]){
  await page.setViewportSize({width,height:844});
  for(const scheme of ['L1','L2']){
   await page.locator(`[data-scheme="${scheme}"]`).click();
   for(const name of ['home','players','album']){
    await page.locator(`[data-page="${name}"]`).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert(await page.locator(`.phone[data-layout="${scheme}"]`).evaluate(p=>[p.querySelector('.phone-body'),p.querySelector('.phone-header')].every(e=>e.scrollWidth<=e.clientWidth+1)));
   }
  }
 }
 await page.setViewportSize({width:375,height:844});
 await page.locator('[data-page="home"]').click();
 await page.locator('[data-scheme="L1"]').click();
 await page.screenshot({path:path.join(dir,'mobile-home.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(snapshots,null,2));
 console.log('PASS: 6 layouts at 390×844 / 360×640; 320/375/430 page bounds; images, navigation, search, quality and sorting.');
 console.log(JSON.stringify(snapshots.filter(s=>s.page==='album')));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
