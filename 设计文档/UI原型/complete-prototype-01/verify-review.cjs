// Validate browser proof artifacts; this does not launch or pretend to run a browser.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'preview',name),'utf8'));
const catalog=read('catalog.json'),desktop=read('final-browser-checks.json'),mobile=read('final-responsive-checks.json');
assert.equal(catalog.length,43);for(const page of catalog)assert(fs.existsSync(path.join(__dirname,page.image)),page.image);
assert.equal(desktop.length,35);assert(desktop.every(c=>!c.blocked&&!c.overflow&&!c.badImages.length));
assert.equal(mobile.length,140);assert(mobile.every(c=>!c.blocked&&!c.overflow&&!c.dockOverlap&&!c.badImages&&c.largeText));
console.log('PASS historical alignment evidence: 43 screenshots, 35 page entries, 140 responsive states. Artifact checks, not a fresh browser run.');
const evidence=path.resolve(__dirname,'../../../docs/validation/2026-10-04-season-followup');
const latest=read('season-catalog.json');assert.equal(latest.length,37);for(const page of latest)assert(fs.existsSync(path.resolve(__dirname,page.image)),page.image);
const pages=JSON.parse(fs.readFileSync(path.join(evidence,'browser-pages.json'))),responsive=JSON.parse(fs.readFileSync(path.join(evidence,'browser-responsive.json'))),reveals=JSON.parse(fs.readFileSync(path.join(evidence,'pack-reveal.json')));
assert.equal(pages.length,35);assert(pages.every(c=>!c.blocked&&!c.horizontalOverflow&&!c.undefinedText&&!c.brokenImages.length&&c.allImagesDecoded));
assert.equal(responsive.length,36);assert(responsive.every(c=>!c.horizontalOverflow&&!c.coveredByDock&&!c.brokenImages.length&&c.largeText));
assert.equal(reveals.length,30);reveals.forEach((r,i)=>{assert.equal(r.pack,Math.floor(i/10)+1);assert.equal(r.card,i%10+1);});
console.log('PASS current season evidence: 35 pages + 2 real-bracket BO5 scenes, 36 responsive states, 30 individual reveals. Artifact checks, not a fresh browser run.');
