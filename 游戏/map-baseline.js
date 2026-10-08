(function(root,factory){const api=factory(typeof module==='object'?require('./content/map-side-stats-2026-10-07.json'):()=>root.CN_CONTENT?.mapSideData);if(typeof module==='object')module.exports=api;else root.MAP_BASELINE=api;})(typeof window==='object'?window:globalThis,data=>{
 'use strict';
 const read=typeof data==='function'?data:()=>data;
 function attackRate(id,source=read()){if(source?.status!=='verified'||!['attack-defense','defense-attack'].includes(source.columnOrder))return .5;const row=source.rows.find(r=>r.id===id),value=source.columnOrder==='attack-defense'?row?.firstPercent:row?.secondPercent;if(!Number.isFinite(value)||value<=0||value>=100)return .5;return value/100;}
 // A coarse model uses a side intercept. A physical engine uses these as audit
 // targets only; geometry already supplies its map's attack/defense tendency.
 function advantage(id,isAttack,source=read()){const p=attackRate(id,source),v=12*Math.log(p/(1-p));return isAttack?v:-v;}
 return {get data(){return read();},attackRate,advantage};
});
