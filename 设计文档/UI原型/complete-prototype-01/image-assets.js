// URLs retain the original paths in frozen cards; only the presentation chooses a derivative.
(() => {
 const root='../../../素材库/',table=()=>window.VM_IMAGE_MANIFEST?.assets||{};
 const asset=(value,kind='full')=>{if(!value)return '';const item=table()[value];return root+encodeURI(item?.[kind]||item?.full||value);};
 window.VM_IMAGES={asset,original:value=>root+encodeURI(value)};
 if(typeof document!=='undefined')document.addEventListener('error',e=>{const el=e.target;if(el.tagName!=='IMG'||el.dataset.assetFallback)return;const match=Object.entries(table()).find(([,v])=>[v.full,v.thumb].some(p=>el.getAttribute('src')===root+encodeURI(p)));if(match){el.dataset.assetFallback='true';el.src=root+encodeURI(match[0]);}},true);
})();
