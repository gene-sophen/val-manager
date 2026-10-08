// Render the reviewed spatial footprint; no gameplay, save or engine changes.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'引擎/maps/layouts/ascent-v2.json'),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const contourPath=contours=>contours.map(({points})=>'M'+points.map(p=>p.join(' ')).join('L')+'Z').join(' ');
const footprint=contourPath(data.footprintContours),lines=contourPath(data.structureLineContours),marks=contourPath(data.surfaceMarkContours),zones=contourPath(data.plantZoneContours);
// Region overlays use the same footprint clip, never replace its boundaries.
const labelSpecs=[
 ['attacker-side-spawn',552,212,18],['defender-side-spawn',438,839,18],
 ['a-lobby',285,399,17],['a-main',284,498,17],['a-wine',119,491,13],
 ['mid-top',418,337,16],['mid-catwalk',427,442,14],['mid-courtyard',491,482,16],
 ['mid-bottom',490,571,15],['mid-pizza',448,609,13],['mid-link',581,462,13],
 ['a-tree',322,576,15],['a-garden',359,665,14],['a-rafters',202,704,14],
 ['b-lobby',675,437,17],['b-main',670,570,16],['mid-market',541,658,16],['b-boat-house',822,702,14]
];
const labels=labelSpecs.map(([id,x,y,size])=>{
 const landmark=data.landmarks.find(l=>l.id===id);if(!landmark)throw Error('Missing landmark '+id);
 return `<text data-landmark="${id}" x="${x}" y="${y}" font-size="${size}">${esc(landmark.name)}</text>`;
}).join('');
const siteLabels=`<g class="site-badge" transform="translate(188 672)"><rect x="-16" y="-18" width="32" height="32" rx="9"/><text y="5">A</text></g><g class="site-badge b" transform="translate(782 695)"><rect x="-16" y="-18" width="32" height="32" rx="9"/><text y="5">B</text></g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 52 840 840" data-layout-version="${data.layoutVersion}">
<title>亚海悬城 Ascent · 柔色地图样板</title><desc>按保存的小地图轮廓与官方概览核对绘制，保留内墙、箱体、包点和二楼。当前为地图视觉样板，尚未作为战斗碰撞数据接入。</desc>
<defs><pattern id="paper" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r=".8" fill="#ccdbe2" opacity=".44"/></pattern><pattern id="tile" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#dfddd3" stroke-width=".55"/></pattern><pattern id="raised" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#b6c9cd" stroke-width=".8" opacity=".48"/></pattern><clipPath id="ascent-floor"><path d="${footprint}" clip-rule="evenodd"/></clipPath><filter id="wall-lift" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="3" stdDeviation="1" flood-color="#728d9b" flood-opacity=".18"/></filter>
<style>.map-labels text{font-family:'Noto Sans SC',sans-serif;fill:#57747d;text-anchor:middle;font-weight:600;paint-order:stroke;stroke:#f9f8ef;stroke-width:4;stroke-linejoin:round}.site-badge rect{fill:#faf2cc;stroke:#c2a95b;stroke-width:1.5}.site-badge text{font-family:sans-serif;fill:#8b7638;font-size:23px;font-weight:700;text-anchor:middle}.site-badge.b rect{fill:#dcebe7;stroke:#7babaa}.site-badge.b text{fill:#527d79}.structure-lines{fill:#93aab3;stroke:#93aab3;stroke-width:.45;stroke-linejoin:round}.detail-lines{fill:none;stroke:#b7c6c5;stroke-width:1.1}</style></defs>
<rect x="0" y="0" width="960" height="960" fill="#eef4f5"/><rect x="0" y="0" width="960" height="960" fill="url(#paper)"/>
<g id="map-ground"><path d="${footprint}" fill-rule="evenodd" fill="#d0dee2" transform="translate(0 5)"/><path d="${footprint}" fill-rule="evenodd" fill="#faf8ed" stroke="#91aab5" stroke-width="3.2" stroke-linejoin="round"/>
<g clip-path="url(#ascent-floor)"><rect width="960" height="960" fill="url(#tile)" opacity=".38"/><path d="M120 598H255V685H120Z" fill="#f0dfad" opacity=".66"/><path d="M690 620H805V741H690Z" fill="#d3e5df" opacity=".7"/><path d="M425 445H538V590H425Z" fill="#e5eff0" opacity=".65"/><path d="M118 683H326V721H118Z M277 677H324V719H277Z" fill="#dbe7eb"/><path d="M118 683H326V721H118Z M277 677H324V719H277Z" fill="url(#raised)"/><path d="M699 693H804V740H699Z" fill="#e1e5d8" opacity=".48"/>
<path d="${zones}" fill-rule="evenodd" fill="none" stroke="#bbaa74" stroke-width=".9" stroke-dasharray="4 4" opacity=".72"/>
<path d="${marks}" fill-rule="evenodd" fill="#d6ddd8" stroke="#adbfbd" stroke-width=".65"/>
</g></g>
<g id="map-details" clip-path="url(#ascent-floor)">
<g fill="#a4b5ac" stroke="#768f85" stroke-width="1"><path d="M216 621H228V656H216Z"/><path d="M157 637H166V646H157Z M168 644H177V653H168Z"/></g>
<g fill="#c4ba96" stroke="#a29876" stroke-width="1"><path d="M748 655H756V675H748Z M728 624H739V635H728Z"/></g>
<g class="detail-lines"><path d="M685 632H696 M685 637H696 M685 642H696 M685 647H696 M685 652H696 M685 657H696"/><path d="M286 687H310 M286 693H310 M286 699H310"/></g>
<g fill="#d4e3d4" stroke="#9db7a2" stroke-width="1"><circle cx="350" cy="673" r="7"/><circle cx="354" cy="686" r="6"/><circle cx="368" cy="676" r="5"/></g>
<g stroke="#879c93" stroke-width="1" fill="#ded6bd"><circle cx="112" cy="492" r="4"/><circle cx="122" cy="492" r="4"/><circle cx="112" cy="503" r="4"/></g>
</g>
<g id="map-structures" class="structure-lines" filter="url(#wall-lift)"><path d="${lines}" fill-rule="evenodd"/></g>
<g id="map-doors" stroke="#9b956f" stroke-width="3" stroke-linecap="round"><path d="M246 573H262"/><path d="M578 636V653"/></g>
<g id="map-labels" class="map-labels">${labels}${siteLabels}</g>
</svg>`;
fs.writeFileSync(path.join(root,'素材库/地图风格/ascent-v2.svg'),svg+'\n');
console.log('Rendered ascent-v2.svg from '+data.layoutVersion+'; old assets and battle data unchanged.');
