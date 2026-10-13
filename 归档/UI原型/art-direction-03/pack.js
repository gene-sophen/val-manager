// Visual prototype: deterministic data, cancellable motion, no game state.
window.mountPack=(root=document,options={})=>{
 const $=id=>root.querySelector('#'+id),stage=$('pack-stage'),main=$('main-action'),back=$('back-action'),skip=$('skip'),progress=$('progress'),phone=root.querySelector('.pack-phone');
 const sequence=[...VISUAL_PLAYERS,...PACK_EXTRA,cardSampleDiamond()].sort((a,b)=>'铜银金钻'.indexOf(a.tier)-'铜银金钻'.indexOf(b.tier));
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 let phase='sealed',index=0,busy=false,revision=0,timer,gesture=null,suppressClick=false;
 const announce=text=>$('live-status').textContent=text;
 const wait=(ms,callback)=>{const rev=revision;clearTimeout(timer);timer=setTimeout(()=>{if(rev===revision)callback()},reduce()?0:ms)};
 const invalidate=()=>{revision++;clearTimeout(timer);busy=false;gesture=null;stage.style.removeProperty('--drag');stage.style.removeProperty('--tilt')};
 const packMarkup=`<div class="pack-orbit"></div><button class="pack-touch" data-touch="seal" aria-label="打开中国赛区卡包，也可向右滑动封条"><div class="paper-pack"><div class="pack-seal"><span>向右划开</span><i>→</i></div><div class="pack-region">CN<small>中国赛区</small></div><div class="pack-emblem" aria-hidden="true">V</div><div class="pack-card-icons" aria-hidden="true"><i></i><i></i></div><div class="pack-band"><strong>选手卡包</strong><b>10<small>张</small></b></div></div></button>`;
 function compactCard(p,i){
  const photo=p.photo||'选手半身像/'+p.name+'.png';
  return `<button class="result-item result-compact" data-result="${i}" data-tier="${p.tier}" aria-label="查看 ${p.name}，${p.tier}卡，能力 ${p.rating}"><span class="result-photo"><img src="../../../素材库/${encodeURI(photo)}" alt="" draggable="false"><b>${p.rating}</b><small>${p.tier}卡</small></span><span class="result-name">${p.name}</span><span class="result-team">${p.tier==='钻'?'2023 · 东京':p.team}</span></button>`;
 }
 function render({enter=false}={}){
  const focusOnStage=stage.contains(document.activeElement);
  phone.dataset.phase=phase;stage.className='pack-stage';stage.dataset.phase=phase;delete stage.dataset.special;
  stage.style.removeProperty('--drag');stage.style.removeProperty('--tilt');
  main.disabled=busy;main.setAttribute('aria-busy',String(busy));back.disabled=busy;
  skip.hidden=phase==='summary';$('demo-pill').hidden=true;skip.textContent=phase==='sealed'?'直接查看':'查看全部';
  back.hidden=phase!=='front';back.disabled=busy||index===0;
  $('inspect-action').hidden=phase!=='front';$('inspect-action').disabled=busy;
  progress.hidden=phase!=='front';progress.innerHTML=sequence.map((_,i)=>`<i class="${i<index?'done':i===index?'current':''}"></i>`).join('');
  progress.setAttribute('aria-label',`第 ${index+1} 张，共 ${sequence.length} 张`);
  $('stage-note').hidden=true;$('footnote').hidden=true;
  if(phase==='sealed'||phase==='opening'){
   $('stage-kicker').textContent='中国赛区 · 10 张';$('stage-title').textContent='选手卡包';stage.innerHTML=packMarkup;
   main.innerHTML=phase==='opening'?'拆封中…':'打开卡包 <span>→</span>';
   if(phase==='opening'){stage.classList.add('opening');stage.querySelector('.pack-touch').disabled=true}
  }else if(phase==='front'){
   const p=sequence[index];$('stage-kicker').textContent=`${String(index+1).padStart(2,'0')} / ${sequence.length}`;$('stage-title').textContent=p.tier==='钻'?'赛事珍藏':p.tier+'卡';stage.dataset.special=String(p.tier==='钻');
   stage.innerHTML=`<div class="stack-under" aria-hidden="true"><i></i><i></i></div><button class="card-touch" data-touch="card" aria-label="${index===sequence.length-1?'查看结果':'下一张'}，也可左滑">${renderCollectible(p)}</button>`;
   if(enter)stage.classList.add('card-enter');stage.querySelectorAll('img').forEach(img=>img.draggable=false);
   main.innerHTML=index===sequence.length-1?'查看结果 <span>✓</span>':'下一张 <span>→</span>';$('gesture-hint').hidden=index!==0;
   announce(`${p.tier}卡，${p.name}，能力 ${p.rating}。第 ${index+1} 张，共 ${sequence.length} 张。`);
  }else{
   $('stage-kicker').textContent='10 张选手卡';$('stage-title').textContent='开包结果';stage.classList.add('results-stage');stage.innerHTML=`<div class="results-summary">${['钻','金','银','铜'].map(t=>`<span>${t} ${sequence.filter(p=>p.tier===t).length}</span>`).join('')}</div><div class="results-grid">${sequence.map(compactCard).join('')}</div>`;main.innerHTML=options.onExit?'返回卡册 <span>→</span>':'重新体验 <span>↻</span>';announce('已展示全部 10 张选手卡。');
  }
  if(phase!=='front')$('gesture-hint').hidden=true;
  if(focusOnStage&&phase==='front')stage.querySelector('.card-touch').focus({preventScroll:true});
 }
 function top(){phone.scrollTop=0;phone.querySelector('.pack-content').scrollTop=0;window.scrollTo({top:0,behavior:'instant'});$('stage-title').focus({preventScroll:true})}
 function summary(){invalidate();phase='summary';render();top()}
 function open(){if(busy||phase!=='sealed')return;invalidate();phase='opening';busy=true;render();announce('拆封中');wait(620,()=>{phase='front';busy=false;render({enter:true})})}
 function advance(){
  if(busy||phase!=='front')return;if(index===sequence.length-1){summary();return}
  busy=true;main.disabled=true;back.disabled=true;$('inspect-action').disabled=true;main.setAttribute('aria-busy','true');stage.classList.remove('card-enter');stage.classList.add('card-leaving');
  wait(180,()=>{index++;render({enter:true});wait(220,()=>{busy=false;main.disabled=false;back.disabled=false;$('inspect-action').disabled=false;main.setAttribute('aria-busy','false')})});
 }
 function previous(){if(busy||phase!=='front'||index===0)return;invalidate();index--;render()}
 main.onclick=()=>{if(phase==='sealed')open();else if(phase==='front')advance();else if(phase==='summary'){if(options.onExit){options.onExit();return}invalidate();index=0;phase='sealed';render();top()}};skip.onclick=summary;back.onclick=previous;
 const dialog=$('result-dialog');function inspect(p){if(options.onInspect){options.onInspect(p);return}$('result-detail').innerHTML=renderCollectible(p);dialog.showModal()}
 $('inspect-action').onclick=()=>{if(!busy)inspect(sequence[index])};dialog.querySelector('.close-button').onclick=()=>dialog.close();
 dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}};
 stage.onclick=e=>{if(suppressClick){suppressClick=false;e.preventDefault();return}const result=e.target.closest('[data-result]');if(result){inspect(sequence[+result.dataset.result]);return}const touch=e.target.closest('[data-touch]');if(!touch||busy)return;if(touch.dataset.touch==='seal')open();else advance()};
 // Horizontal gestures preserve native vertical scrolling. All actions also have buttons.
 stage.onpointerdown=e=>{suppressClick=false;const target=e.target.closest('[data-touch]');if(!target||busy||!e.isPrimary||e.button!==0)return;suppressClick=false;gesture={id:e.pointerId,target,x:e.clientX,y:e.clientY,dx:0,kind:target.dataset.touch,axis:null};target.setPointerCapture(e.pointerId)};
 stage.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(!gesture.axis&&Math.hypot(dx,dy)>8)gesture.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(gesture.axis!=='x')return;gesture.dx=dx;const drag=gesture.kind==='seal'?Math.max(0,Math.min(dx,160)):Math.min(0,Math.max(dx,-180));stage.style.setProperty('--drag',drag+'px');stage.style.setProperty('--tilt',(drag/22)+'deg');stage.classList.add('dragging')};
 function endGesture(e,cancel=false){
  if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.target.hasPointerCapture(e.pointerId))g.target.releasePointerCapture(e.pointerId);stage.classList.remove('dragging');stage.style.removeProperty('--drag');stage.style.removeProperty('--tilt');
  if(cancel){suppressClick=true;return}if(g.axis){suppressClick=true;if(g.axis==='x'&&(g.kind==='seal'?g.dx>60:g.dx < -55)){if(g.kind==='seal')open();else advance()}}
 }
 stage.onpointerup=e=>endGesture(e);stage.onpointercancel=e=>endGesture(e,true);
 stage.onkeydown=e=>{suppressClick=false;if(phase!=='front'||!e.target.closest('.card-touch'))return;if(e.key==='ArrowLeft'){e.preventDefault();advance()}if(e.key==='ArrowRight'){e.preventDefault();previous()}};
 if($('side-card-stack'))$('side-card-stack').innerHTML=renderCollectible(VISUAL_PLAYERS[0])+renderCollectible(cardSampleDiamond());
 if(options.onExit)phone.querySelector('.pack-header>a').onclick=e=>{e.preventDefault();e.stopPropagation();options.onExit()};
 render();
 return {destroy:invalidate,reset(){invalidate();index=0;phase='sealed';render();top()}};
};
if(document.querySelector('.pack-phone'))window.mountPack();
