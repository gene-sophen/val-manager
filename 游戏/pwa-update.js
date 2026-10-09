// A requested update waits for installation; activation waits for durable progress.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PWA_UPDATE=factory();})(typeof window==='object'?window:globalThis,()=>{
 async function check(registration,pending=()=>{}){
  await registration.update();if(registration.waiting)return 'ready';const worker=registration.installing;if(!worker)return 'current';pending();
  await new Promise((resolve,reject)=>{const changed=()=>{if(worker.state==='installed'||worker.state==='redundant'){worker.removeEventListener('statechange',changed);worker.state==='installed'?resolve():reject(Error('更新未能完成，当前版本仍可使用'));}};worker.addEventListener('statechange',changed);changed();});
  return registration.waiting?'ready':'current';
 }
 async function activate(registration,flush){await flush();const worker=registration?.waiting;if(!worker)throw Error('暂无待安装更新');worker.postMessage({type:'ACTIVATE'});return true;}
 return {check,activate};
});
