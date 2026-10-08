// Replaceable UI fixtures. No simulation, draw probability or game-save API.
(() => {
 const team=VISUAL_PLAYERS.map(p=>({...p,trait:NAV_TRAITS[p.name]}));
 const diamond={...cardSampleDiamond(),trait:'首杀机器',moment:'冥驹审判',event:'2023 · 东京大师赛'};
 const cards=[...team,...PACK_EXTRA,diamond,...COLLECTION_EXTRA.map(p=>({...p,trait:NAV_TRAITS[p.name]})),...CN_SNAPSHOT.map(p=>({...p,trait:NAV_TRAITS[p.name]}))];
 const key=p=>p.name+'-'+p.tier;
 const pool=cards.filter(p=>p.region==='CN');
 const packs=[pool.slice(0,10).map(key),[...pool.slice(10,18),pool[1],pool[3]].map(key),[...pool.slice(14),pool[0],pool[2],pool[5],pool[7]].slice(0,10).map(key)];
 const maps=[['ascent','亚海悬城',78,'#dbecf4'],['bind','源工重镇',72,'#f0e6d4'],['haven','隐世修所',84,'#dbece3'],['lotus','莲华古城',69,'#e1ead7'],['icebox','森寒冬港',65,'#dceaf0'],['sunset','日落之城',76,'#f3e3d8'],['pearl','深海明珠',71,'#d9e9f0']].map(([id,name,score,color],i)=>({id,name,score,color,index:i}));
 const phases=['启点赛','大师赛①','第一赛段常规赛','第一赛段季后赛','大师赛②','第二赛段常规赛','第二赛段季后赛','冠军赛'];
 const clubs=['EDG','BLG','FPX','TE','JDG','TEC','DRG','AG'];
 const tactics={attack:['爆弹强攻','默认控图','佯攻转点','分路渗透','接触反打'],defense:['前压争夺','分区控图','诱敌设伏','侧翼绕后','稳守反清']};
 const results=[{home:13,away:9,win:true},{home:8,away:13,win:false},{home:13,away:11,win:true}];
 // Each map's winner sequence is a fixture, independent of player choices.
 const rounds=results.map((r,map)=>{let h=r.home,a=r.away;const out=[];for(let i=0;i<r.home+r.away;i++){const home=h>0&&(a===0||((i+map)%5<3));out.push(home);home?h--:a--;}return out;});
 const events=[['交叉火力','队员补枪及时，拿下关键对枪。'],['包点突破','技能掩护进点，完成下包。'],['残局处理','守住时间优势，赢下残局。'],['中路争夺','对手控制中路，转点受到限制。'],['经济回合','保留长枪，为下一回合积蓄装备。']];
 const seed=()=>({version:1,club:'EDG',run:'active',phase:2,year:2,roster:team.map(key),unlocked:cards.map(key),history:true,seasons:[{year:1,club:'EDG',place:'大师赛亚军',roster:team.map(key)}],pack:0,opened:[0,0,0],lineup:[],reinforce:[],bp:[],pendingMap:'',sides:['attack','defense','attack'],agents:{},attack:[...tactics.attack],defense:[...tactics.defense],tacticSide:'attack',map:0,round:0,playing:false,speed:2,timeoutUsed:false,halftimeSeen:false,coachName:'新星教练',reducedMotion:false,largeText:false,positions:{},query:'',tier:'all',region:'all',sort:'default',teamSort:'default',teamQuery:'',archive:'album'});
 const shapes=[
  ['M44 46H117V86H204V45H273V144H209V119H119V146H44Z','M118 85V119 M203 85V120',[[52,48],[257,140]]],
  ['M47 47H91V86H142V138H269V89H225V47H180V103H92V144H47Z','M91 86V145 M179 48H225',[[48,45],[268,138]]],
  ['M43 43H96V94H147V49H191V96H252V48H282V139H197V152H108V138H43Z','M97 94V138 M192 96V152',[[47,43],[278,48],[146,152]]],
  ['M43 49H107V92H156V50H219V94H273V144H196V122H134V149H43Z','M107 91V149 M219 94V145',[[43,48],[273,143],[157,49]]],
  ['M39 46H120V68H204V45H275V105H246V144H175V116H92V145H39Z','M120 68V116 M204 45V145',[[40,45],[247,143]]],
  ['M48 40H130V81H209V43H273V136H226V151H125V124H48Z','M130 81V151 M209 81H273 M48 85H129',[[48,41],[272,134]]],
  ['M42 48H104V87H158V40H216V87H277V141H222V119H158V153H93V119H42Z','M104 87V119 M216 87V119',[[42,47],[276,139]]]
 ];
 function art(m,live=false,round=0){const [outline,cross,sites]=shapes[m.index];return `<svg class="map-art" viewBox="0 0 320 190" role="img" aria-label="${m.name}布局示意"><rect width="320" height="190" rx="16" fill="${m.color}"/><path d="${outline}" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="34" stroke-linejoin="round"/><path d="${outline}" fill="none" stroke="#a2bac6" stroke-width="16" stroke-linejoin="round"/><path d="${cross}" fill="none" stroke="#a2bac6" stroke-width="12"/>${sites.map(([x,y],i)=>`<rect x="${x-15}" y="${y-14}" width="30" height="28" rx="7" fill="${['#e3c588','#91bdd2','#c2d0a6'][i]}"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="14" font-weight="800" fill="${['#8b7046','#4c829b','#778556'][i]}">${'ABC'[i]}</text>`).join('')}${live?Array.from({length:10},(_,n)=>`<circle cx="${62+(n%5)*35+((round+n)%3)*7}" cy="${n<5?76+(round%4)*6:113-(round%3)*7}" r="6" fill="${n<5?'#25a4dc':'#caaa6e'}" stroke="#fff" stroke-width="2"/>`).join(''):''}</svg>`;}
 const resultsFor=s=>s.resultMode==='loss'?[{home:9,away:13,win:false},{home:10,away:13,win:false}]:s.resultMode==='sweep'?[{home:13,away:7,win:true},{home:13,away:9,win:true}]:results;
 const roundsFor=s=>s.resultMode&&s.resultMode!=='normal'?resultsFor(s).map((r,map)=>{let h=r.home,a=r.away;return Array.from({length:h+a},(_,i)=>{const win=h>0&&(a===0||(i+map)%5<3);win?h--:a--;return win;});}):rounds;
 window.DEMO={cards,pool,packs,key,maps,phases,clubs,tactics,results,rounds,resultsFor,roundsFor,events,seed,art};
})();
