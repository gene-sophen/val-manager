// Preserve original artwork; publish only size-appropriate derivatives through the URL resolver.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),assetRoot=path.join(root,'素材库'),output=path.join(assetRoot,'优化'),app=path.join(root,'设计文档/UI原型/complete-prototype-01');
async function build(){
 let sharp;try{sharp=require('sharp');}catch{if(!process.env.VM_SHARP_ROOT)throw Error('需要sharp，或通过VM_SHARP_ROOT指定已有运行库');sharp=require(process.env.VM_SHARP_ROOT);}
 fs.mkdirSync(output,{recursive:true});const sources=[],assets={};
 for(const dir of ['选手半身像','切面海报','英雄头像','队伍logo','赛区图标','地图官方'])for(const name of fs.readdirSync(path.join(assetRoot,dir)))if(/\.(png|jpe?g|webp)$/i.test(name))sources.push(dir+'/'+name);
 let sourceBytes=0,fullBytes=0,thumbBytes=0,next=0;
 async function worker(){for(;;){const i=next++;if(i>=sources.length)return;const key=sources[i],file=path.join(assetRoot,key),source=fs.readFileSync(file),hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,20),portrait=/^(选手半身像|切面海报)\//.test(key),map=key.startsWith('地图官方/'),plan=key.includes('-plan.');
  const entry={};sourceBytes+=source.length;
  for(const [kind,width,quality]of [['full',portrait?720:map?(plan?1280:800):128,portrait?84:map?86:90],['thumb',portrait?240:map?400:64,portrait?80:map?84:88]]){
   const name=hash+'-'+kind+'.webp',dest=path.join(output,name);if(!fs.existsSync(dest))await sharp(source).rotate().resize({width,height:portrait?1080:map?(plan?1280:800):128,fit:'inside',withoutEnlargement:true}).webp({quality,alphaQuality:100,effort:5}).toFile(dest);
   const size=fs.statSync(dest).size;entry[kind]='优化/'+name;if(kind==='full')fullBytes+=size;else thumbBytes+=size;
  }assets[key]=entry;
  if(i%40===0)console.log('Encoded',i+1,'/',sources.length);
 }}
 await Promise.all(Array.from({length:4},worker));
 const manifest={version:'mobile-images-20261009-1',assets};fs.writeFileSync(path.join(app,'image-manifest.js'),'/* GENERATED: 游戏/build-image-assets.cjs */\nwindow.VM_IMAGE_MANIFEST='+JSON.stringify(manifest)+';\n');
 const report={files:sources.length,sourceBytes,fullBytes,thumbBytes,manifest:manifest.version};console.log(JSON.stringify(report));return report;
}
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={build};
