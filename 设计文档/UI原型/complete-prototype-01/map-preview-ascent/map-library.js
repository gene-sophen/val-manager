const asset='../../../../素材库/', layouts='../../../../引擎/maps/layouts/', canvas=document.querySelector('#canvas'), ns='http://www.w3.org/2000/svg';
let svg,styled,reference,mode='styled',box=[60,52,840,840],drag,regions,manifest,request=0;
const make=(name,attrs)=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;};
async function read(url,json=false){const r=await fetch(url);if(!r.ok)throw Error('地图载入失败');return json?r.json():r.text();}
function setBox(next){box=next;svg.setAttribute('viewBox',box.join(' '));document.querySelector('#zoom-value').textContent=Math.round(regions.all[2]/box[2]*100)+'%';}
function applyMode(){if(!svg)return;styled.setAttribute('opacity',mode==='reference'?'0':'1');reference.setAttribute('opacity',mode==='reference'?'1':mode==='overlay'?document.querySelector('#opacity').value/100:'0');document.querySelector('#compare-tools').hidden=mode!=='overlay';document.querySelector('#view-caption').textContent=mode==='styled'?'保留真实轮廓 · 区域名称可关闭':mode==='reference'?'原始小地图 · 相同方向与比例':'原图叠加 · 检查轮廓与内墙';}
function zoom(factor){if(!svg)return;const width=Math.max(210,Math.min(1050,box[2]*factor)),height=box[3]*width/box[2];setBox([box[0]+(box[2]-width)/2,box[1]+(box[3]-height)/2,width,height]);}
function focus(){const holder=document.querySelector('.regions');holder.replaceChildren();for(const [key,value] of Object.entries(regions)){const b=document.createElement('button');b.dataset.region=key;b.textContent=key==='all'?'全图':key==='mid'?'中路':key.toUpperCase()+' 区';b.setAttribute('aria-pressed',String(key==='all'));b.onclick=()=>{setBox(value.slice());holder.querySelectorAll('button').forEach(p=>p.setAttribute('aria-pressed',String(p===b)));};holder.append(b);}}
function switches(){svg.querySelector('#map-labels').style.display=document.querySelector('#labels').checked?'':'none';svg.querySelector('#map-details').style.display=document.querySelector('#details').checked?'':'none';}
async function load(id){const token=++request;try{
 const entry=manifest[id];if(!entry)throw Error('未知地图');
 const [text,data]=await Promise.all([read(asset+'地图风格/'+entry.visual),read(layouts+entry.layout,true)]);if(token!==request)return;
 const parsed=new DOMParser().parseFromString(text,'image/svg+xml');if(parsed.querySelector('parsererror'))throw Error('地图格式异常');
 const next=document.importNode(parsed.documentElement,true);next.setAttribute('role','img');next.setAttribute('aria-label',entry.name+' 风格化地图与原始小地图对照');
 styled=make('g',{'data-layer':'styled'});for(const child of [...next.children])if(!['defs','title','desc'].includes(child.tagName))styled.append(child);next.append(styled);
 const matrix=data.coordinates.sourceTransform.matrix||[0,-.853,.853,0,57,916.472];
 reference=make('g',{'data-layer':'reference',opacity:0,'pointer-events':'none'});reference.append(make('rect',{x:0,y:0,width:960,height:960,fill:'#282d2e'}),make('image',{href:asset+'地图参考/'+id+'-minimap.png',width:data.coordinates.sourceWidth,height:data.coordinates.sourceHeight,transform:'matrix('+matrix.join(' ')+')'}));next.append(reference);
 canvas.querySelector('svg')?.remove();canvas.querySelector('#loading')?.remove();svg=next;canvas.prepend(svg);
 regions={all:id==='ascent'?[60,52,840,840]:[40,40,880,880]};for(const p of data.landmarks.filter(p=>p.sourceName==='Site'||p.name.includes('包点'))){const q=data.visualSiteAnchors?.[p.region]||p;regions[p.region.toLowerCase()]=[q.x-190,q.y-190,380,380];}
 const mid=data.landmarks.filter(p=>p.region==='Mid');if(mid.length){const c=mid.reduce((a,p)=>[a[0]+p.x/mid.length,a[1]+p.y/mid.length],[0,0]);regions.mid=[c[0]-210,c[1]-210,420,420];}
 if(id==='ascent')regions={all:[60,52,840,840],a:[83,410,345,345],mid:[332,289,307,397],b:[520,377,358,388]};
 setBox(regions.all.slice());focus();applyMode();switches();drag=null;
 document.title=entry.name+' · 柔色地图库';document.querySelector('h1').replaceChildren(document.createTextNode(entry.name+' '),Object.assign(document.createElement('span'),{textContent:id.toUpperCase()}));
 document.querySelector('.seal').textContent=String(Object.keys(manifest).indexOf(id)+1).padStart(2,'0');
 document.querySelector('.mini img').src=asset+'地图风格/'+entry.visual;document.querySelector('.mini img').alt=entry.name+' 缩略图';document.querySelector('.mini b').textContent=id.toUpperCase();
 document.querySelector('.source-link').href=asset+'地图官方/'+id+'-plan.webp';
 const items=data.landmarks.filter(p=>p.sourceName==='Site'||p.name.includes('包点')||['Main','Garage','Tower','Hall','Bridge','Market'].includes(p.sourceName)).slice(0,4);
 const list=document.querySelector('.detail-list');list.replaceChildren();for(const [i,p] of items.entries()){const li=document.createElement('li'),num=document.createElement('span'),text=document.createElement('span');num.className='num';num.textContent=String(i+1).padStart(2,'0');text.textContent=p.name;li.append(num,text);list.append(li);}
 document.querySelector('#status').textContent=entry.name+' · 可切换原图对照、查看局部';
 document.querySelector('.board').setAttribute('aria-label',entry.name+' 地图预览');
 document.querySelector('#c-legend').hidden=!regions.c;
 document.querySelectorAll('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===id)));
 const url=new URL(location.href);url.searchParams.set('map',id);history.replaceState(null,'',url);
 const position=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=position(e);drag={id:e.pointerId,x:p.x,y:p.y,box:box.slice()};svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=position(e);setBox([box[0]+drag.x-p.x,box[1]+drag.y-p.y,box[2],box[3]]);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,()=>drag=null);
 }catch(e){document.querySelector('#status').textContent=e.message;}}
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));applyMode();});
document.querySelector('#zoom-in').onclick=()=>zoom(.8);document.querySelector('#zoom-out').onclick=()=>zoom(1.25);document.querySelector('#reset').onclick=()=>{if(svg)setBox(regions.all.slice());document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region==='all')));};
document.querySelector('#labels').onchange=switches;document.querySelector('#details').onchange=switches;document.querySelector('#opacity').oninput=e=>{document.querySelector('#opacity-value').value=e.target.value+'%';applyMode();};
read(layouts+'manifest.json',true).then(data=>{manifest=data;const picker=document.querySelector('.map-picker');for(const [id,entry]of Object.entries(data)){const b=document.createElement('button');b.dataset.map=id;b.setAttribute('aria-pressed','false');const img=document.createElement('img');img.src=asset+'地图风格/'+entry.visual;img.alt='';const label=document.createElement('span');label.textContent=entry.name;b.append(img,label);b.onclick=()=>load(id);picker.append(b);}const selected=new URLSearchParams(location.search).get('map');load(data[selected]?selected:'ascent');}).catch(e=>document.querySelector('#status').textContent=e.message);
