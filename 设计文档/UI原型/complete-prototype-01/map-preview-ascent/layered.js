/* Review the exact compiled positions and visibility used by the v5 engine. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';let data,geometry,selected='a_site-generator-back';
 const element=(type,attrs,parent)=>{const e=document.createElementNS(NS,type);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;};
 const label=(text,x,y,parent,size=12)=>{const e=element('text',{x,y,'font-size':size,fill:'#526d77','text-anchor':'middle','paint-order':'stroke',stroke:'#f9f8ef','stroke-width':3},parent);e.textContent=text;};
 function controls(){for(const id of ['areas','positions','windows','rays','source'])$(id).style.display=$('show-'+id).checked?'':'none';}
 function choose(id){selected=id;$('area-picker').value=data.positions[id].area;draw();}
 function draw(){
  const p=data.positions[selected],doors={'b-market-door':$('door-closed').checked?'closed':'open'},matrix=Object.fromEntries(Object.keys(data.positions).map(id=>[id,SPATIAL_MATCH.inspectVisibility(5,selected,id,doors,'ascent','ascent-balance-5').visible]));
  $('door-state').replaceChildren();for(const d of data.doorDefinitions){element('polygon',{points:d.points.map(p=>p.join(',')).join(' '),fill:$('door-closed').checked?'#9c9585':'#dce7df',opacity:$('door-closed').checked?1:.3,stroke:'#827e70','stroke-width':1.5},$('door-state'));}
  $('positions').replaceChildren();$('rays').replaceChildren();$('micro-route').replaceChildren();$('post-picker').replaceChildren();
  let visible=0;
  for(const [id,q]of Object.entries(data.positions)){
   const seen=id!==selected&&matrix[id]>0;if(seen)visible++;
   if(seen){const trace=SPATIAL_MATCH.inspectVisibility(5,selected,id,doors,'ascent','ascent-balance-5').trace; if(trace)element('line',{x1:p.x,y1:p.y,x2:trace.x,y2:trace.y,stroke:'#71978d','stroke-width':1,'stroke-opacity':.42,'stroke-dasharray':'3 3'},$('rays'));}
   const group=element('g',{'data-position':id,tabindex:0,role:'button','aria-label':q.name},$('positions'));
   element('circle',{cx:q.x,cy:q.y,r:id===selected?7:4.3,fill:id===selected?'#c6a766':seen?'#6c9f93':'#b9c6cd',stroke:'#fff','stroke-width':1.3},group);
   const title=element('title',{},group);title.textContent=q.name+(id===selected?' · 所选':seen?' · 可见':' · 遮挡');
   group.addEventListener('click',()=>choose(id));group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(id);}});
   if(q.area===$('area-picker').value){const b=document.createElement('button');b.textContent=q.name;b.setAttribute('aria-pressed',String(id===selected));b.onclick=()=>choose(id);$('post-picker').append(b);}
  }
  label(p.name,p.x,p.y-15,$('positions'),14);
  $('position-name').textContent=p.name;$('position-role').textContent=p.role==='peek'?'探头位':'驻守 / 保护位';
  $('position-info').replaceChildren();const count=document.createElement('b');count.textContent=visible;$('position-info').append('当前可见 ',count,' 个站位。身体露出比例按实际枪线判断，掩体不会直接加减一个固定胜率。');
  const windows=data.engagementWindows.filter(w=>w.areas.includes(p.area));$('window-info').textContent='相关交火窗口：'+windows.map(w=>w.name).join('、')+'。';
  const next=p.peekTo||p.returnTo;$('peek').hidden=!next;$('peek').textContent=p.peekTo?'走到探头位 →':'返回保护位 →';$('peek').onclick=()=>choose(next);
  const route=p.peekRoute||(p.returnTo?data.positions[p.returnTo].peekRoute:null);if(route)element('polyline',{points:route.map(q=>q.x+','+q.y).join(' '),fill:'none',stroke:'#b88c48','stroke-width':2,'stroke-dasharray':'4 3'},$('micro-route'));
  $('status').textContent='站位可见性已载入 · 宏观路线不参与射击授权';controls();
 }
 Promise.all(['ascent-combat-v5.json','ascent-geometry-v5.json'].map(file=>fetch('../../../../引擎/maps/'+file).then(r=>{if(!r.ok)throw Error('地图数据载入失败');return r.json();}))).then(([d,g])=>{
  data=SPATIAL_MATCH.replayMap({layoutVersion:d.layoutVersion,behaviorVersion:'ascent-balance-5'});geometry=g;for(const key of ['areas','positions','windows'])$('count-'+key).textContent=data.layerCounts[key];
  for(const o of geometry.obstacles){if(o.door)continue;const shape=element('path',{d:'M'+o.points.map(p=>p.join(' ')).join('L')+'Z',fill:o.kind==='low-divider'?'#c6d5ce':'#8ca3ab',stroke:'#78939d','stroke-width':.8,'data-collision-id':o.id},$('partitions'));const title=element('title',{},shape);title.textContent=o.name;}
  for(const [id,n]of Object.entries(data.nodes)){const option=document.createElement('option');option.value=id;option.textContent=n.name;$('area-picker').append(option);element('circle',{cx:n.x,cy:n.y,r:22,fill:'#8fb1c7','fill-opacity':.12,stroke:'#8aa7b8','stroke-width':1,'stroke-dasharray':'3 3'},$('areas'));label(n.name,n.x,n.y-25,$('areas'),11);}
  for(const w of data.engagementWindows){const [x,y,right,bottom]=w.bounds;element('rect',{x,y,width:right-x,height:bottom-y,rx:12,fill:'#dbc48b','fill-opacity':.07,stroke:'#c2a572','stroke-width':1,'stroke-dasharray':'4 4'},$('windows'));label(w.name,(x+right)/2,y+17,$('windows'),11);}
  $('area-picker').onchange=()=>choose(Object.keys(data.positions).find(id=>data.positions[id].area===$('area-picker').value));
  for(const id of ['areas','positions','windows','rays','source'])$('show-'+id).onchange=controls;
  $('door-closed').onchange=draw;choose(selected);
 }).catch(e=>{$('status').textContent=e.message;});
})();
