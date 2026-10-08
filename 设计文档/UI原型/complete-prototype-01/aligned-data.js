(() => {
 const D=DEMO,R=PROTOTYPE_RULES;
 D.cards=CN_CONTENT.cards.map(p=>({...p,trait:p.trait||NAV_TRAITS[p.name]||'',moment:p.moment||''}));
 D.pool=D.cards;D.key=R.key;D.clubs=CN_CONTENT.clubs;D.allMaps=R.mapCatalog;D.maps=R.mapCatalog.slice(0,7);D.resultsFor=R.results;D.roundsFor=R.rounds;
 D.seed=()=>R.init({version:2,club:'EDG',run:'none',phase:0,year:0,roster:[],unlocked:[],history:false,seasons:[],pack:0,packs:[],chosenPack:null,opened:[0,0,0],lineup:[],reinforce:[],reinforcementPack:[],bp:[],pendingMap:'',sides:['attack','defense','attack'],agents:{},attack:[...D.tactics.attack],defense:[...D.tactics.defense],tacticSide:'attack',map:0,round:0,playing:false,speed:2,halftimeSeen:false,coachName:'新星教练',reducedMotion:false,largeText:false,positions:{},query:'',tier:'all',region:'all',sort:'default',teamSort:'default',teamQuery:'',archive:'album'});
 D.sync=s=>{R.init(s);D.packs=s.packs;D.maps=s.activeMaps.map(id=>({...R.mapCatalog.find(m=>m.id===id),score:Math.round(s.mapKnowledge[id])}));};
 D.softPlan=m=>`<img class="map-layout" src="../../../素材库/地图风格/${m.id}-v2.svg" alt="${m.name} · 真实布局简绘">`;
 D.plan=m=>`<button class="map-layout-button" data-map-plan="${m.id}" aria-label="放大 ${m.name} 战术图">${D.softPlan(m)}</button>`;
 D.art=(m,live=false)=>live?D.plan(m):`<img class="map-poster" src="../../../素材库/地图官方/${m.id}-poster.webp" alt="${m.name} · 官方地图实景">`;
 D.demoRoster=()=>['ZmjjKK','nobody','Smoggy','CHICHOO','stew'].map(name=>R.key(D.cards.find(p=>p.name===name&&p.tier!=='钻')));
})();
