/* Review the same candidate positions and physical visibility as live previews. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';let data,geometry,selected,loadGeneration=0;const params=new URLSearchParams(location.search);let mapId=SPATIAL_MATCH.mapIds.includes(params.get('map'))?params.get('map'):'haven';
 const element=(type,attrs,parent)=>{const e=document.createElementNS(NS,type);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;};
 const behavior=()=>mapId+'-balance-3';
 const positionLabel=(q,id)=>q.name?.includes('undefined')?(data.nodes[q.node].name+' · 集结位 '+(Number(id.split('-').at(-1))+1)):q.name;
 const label=(text,x,y,parent,size=12)=>{const e=element('text',{x,y,'font-size':size,fill:'#526d77','text-anchor':'middle','paint-order':'stroke',stroke:'#f9f8ef','stroke-width':3},parent);e.textContent=text;};
 function controls(){for(const id of ['areas','positions','windows','rays','source'])$(id).style.display=$('show-'+id).checked?'':'none';}
 function choose(id){selected=id;$('area-picker').value=data.positions[id].area;draw();}
 function draw(){
  const p=data.positions[selected],doors=Object.fromEntries(data.doorDefinitions.map(d=>[d.id,document.querySelector('[data-door="'+d.id+'"]').checked?'closed':'open'])),matrix=Object.fromEntries(Object.keys(data.positions).map(id=>[id,SPATIAL_MATCH.inspectVisibility(6,selected,id,doors,data.id,behavior()).visible]));
  $('door-state').replaceChildren();for(const d of data.doorDefinitions){element('polygon',{points:d.points.map(p=>p.join(',')).join(' '),fill:doors[d.id]==='closed'?'#9c9585':'#dce7df',opacity:doors[d.id]==='closed'?1:.3,stroke:'#827e70','stroke-width':1.5},$('door-state'));}
  $('positions').replaceChildren();$('rays').replaceChildren();$('micro-route').replaceChildren();$('post-picker').replaceChildren();
  let visible=0;
  for(const [id,q]of Object.entries(data.positions)){
   const seen=id!==selected&&matrix[id]>0;if(seen)visible++;
   if(seen){const trace=SPATIAL_MATCH.inspectVisibility(6,selected,id,doors,data.id,behavior()).trace; if(trace)element('line',{x1:p.x,y1:p.y,x2:trace.x,y2:trace.y,stroke:'#71978d','stroke-width':1,'stroke-opacity':.42,'stroke-dasharray':'3 3'},$('rays'));}
   const name=positionLabel(q,id),group=element('g',{'data-position':id,tabindex:0,role:'button','aria-label':name},$('positions'));
   element('circle',{cx:q.x,cy:q.y,r:id===selected?7:4.3,fill:id===selected?'#c6a766':seen?'#6c9f93':'#b9c6cd',stroke:'#fff','stroke-width':1.3},group);
   const title=element('title',{},group);title.textContent=name+(id===selected?' · 所选':seen?' · 可见':' · 遮挡');
   group.addEventListener('click',()=>choose(id));group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(id);}});
   if(q.area===$('area-picker').value){const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-pressed',String(id===selected));b.onclick=()=>choose(id);$('post-picker').append(b);}
  }
  label(positionLabel(p,selected),p.x,p.y-15,$('positions'),14);
  $('position-name').textContent=positionLabel(p,selected);$('position-role').textContent=p.role==='peek'?'探头位':'驻守 / 保护位';
  $('position-info').replaceChildren();const count=document.createElement('b');count.textContent=visible;$('position-info').append('当前可见 ',count,' 个站位。身体露出比例按实际枪线判断，掩体不会直接加减一个固定胜率。');
  const windows=data.engagementWindows.filter(w=>w.areas.includes(p.area));$('window-info').textContent=windows.length?'相关交火窗口：'+windows.map(w=>w.name).join('、')+'。':'当前位置以行进与集结为主。';
  const next=p.peekTo||p.returnTo;$('peek').hidden=!next;$('peek').textContent=p.peekTo?'走到探头位 →':'返回保护位 →';$('peek').onclick=()=>choose(next);
  const route=p.peekRoute||(p.returnTo?data.positions[p.returnTo].peekRoute:null);if(route)element('polyline',{points:route.map(q=>q.x+','+q.y).join(' '),fill:'none',stroke:'#b88c48','stroke-width':2,'stroke-dasharray':'4 3'},$('micro-route'));
  $('status').textContent='站位可见性已载入 · 宏观路线不参与射击授权';controls();
 }
 function load(){const generation=++loadGeneration;Promise.all([mapId+'-combat-v6.json',mapId+'-geometry-v6.json'].map(file=>fetch('../../../../引擎/maps/'+file).then(r=>{if(!r.ok)throw Error('地图数据载入失败');return r.json();}))).then(([d,g])=>{
  if(generation!==loadGeneration)return;data=SPATIAL_MATCH.replayMap({layoutVersion:d.layoutVersion,behaviorVersion:behavior()});geometry=g;selected=Object.keys(data.positions)[0];$('map-art').setAttribute('href','../../../../素材库/'+data.visualAsset);$('source').setAttribute('href','../../../../素材库/地图参考/'+mapId+'-minimap.png');$('source').setAttribute('transform','matrix('+data.source.sourceTransform.join(' ')+')');$('replay-link').href='../?scene=map-'+mapId;$('area-picker').replaceChildren();$('areas').replaceChildren();$('windows').replaceChildren();$('partitions').replaceChildren();for(const w of data.physicalBarriers||[])element('polygon',{points:w.points.map(p=>p.join(',')).join(' '),fill:'#828c86',stroke:'#f0eee3','stroke-width':1.5},$('partitions'));$('mechanisms').replaceChildren();for(const door of data.doorDefinitions){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.door=door.id;input.checked=geometry.initialDoors[door.id]==='closed';input.onchange=draw;label.append(input,door.name+'关闭');$('mechanisms').append(label);}for(const key of ['areas','positions','windows'])$('count-'+key).textContent=data.layerCounts[key];
  for(const [id,n]of Object.entries(data.nodes)){const option=document.createElement('option');option.value=id;option.textContent=n.name;option.disabled=!Object.values(data.positions).some(p=>p.area===id);$('area-picker').append(option);element('circle',{cx:n.x,cy:n.y,r:22,fill:'#8fb1c7','fill-opacity':.12,stroke:'#8aa7b8','stroke-width':1,'stroke-dasharray':'3 3'},$('areas'));label(n.name,n.x,n.y-25,$('areas'),11);}
  for(const w of data.engagementWindows){const [x,y,right,bottom]=w.bounds;element('rect',{x,y,width:right-x,height:bottom-y,rx:12,fill:'#dbc48b','fill-opacity':.07,stroke:'#c2a572','stroke-width':1,'stroke-dasharray':'4 4'},$('windows'));label(w.name,(x+right)/2,y+17,$('windows'),11);}
  $('area-picker').onchange=()=>choose(Object.keys(data.positions).find(id=>data.positions[id].area===$('area-picker').value));
  for(const id of ['areas','positions','windows','rays','source'])$('show-'+id).onchange=controls;
  choose(selected);
 }).catch(e=>{$('status').textContent=e.message;});}
 for(const id of SPATIAL_MATCH.mapIds){const option=document.createElement('option');option.value=id;option.textContent=SPATIAL_MATCH.combatMap(id).name;$('map-picker').append(option);}$('map-picker').value=mapId;$('map-picker').onchange=()=>{mapId=$('map-picker').value;history.replaceState(null,'','?map='+mapId);load();};load();
})();
