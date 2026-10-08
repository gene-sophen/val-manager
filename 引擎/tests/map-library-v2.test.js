// Visual/source preflight only. Passing this does not certify nine combat maps.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{inside}=require('../geometry-v2');
const root=path.resolve(__dirname,'../..'),manifest=require('../maps/layouts/manifest.json');
test('nine visual maps keep their source hashes, full bounds and correct two/three-site coverage',()=>{
 assert.equal(Object.keys(manifest).length,9);
 for(const [id,e]of Object.entries(manifest)){
  const d=JSON.parse(fs.readFileSync(path.join(root,'引擎/maps/layouts',e.layout),'utf8'));
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,d.reference.asset))).digest('hex'),d.reference.sha256,id+' provenance');
  for(const contour of d.footprintContours)for(const [x,y]of contour.points)assert(x>=0&&x<=960&&y>=0&&y<=960,id+' clipped');
  if(d.visualSiteAnchors){assert.deepEqual(Object.keys(d.visualSiteAnchors).sort(),['haven','lotus'].includes(id)?['A','B','C']:['A','B']);for(const p of Object.values(d.visualSiteAnchors))assert(d.plantZoneContours.some(c=>inside(p,c.points.map(([x,y])=>({x,y})))),id+' badge outside plant area');}
  const svg=fs.readFileSync(path.join(root,'素材库/地图风格',e.visual),'utf8');assert(svg.includes(d.layoutVersion));assert.equal(e.simulationReady,false,id+' must not claim a combat release');
 }
});
