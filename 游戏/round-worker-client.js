(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ROUND_WORKER=factory();})(typeof window==='object'?window:globalThis,()=>{
 function create({spawn,timeout=60000}){
  let worker=null,pending=null,sequence=0;
  function cancel(message='已取消本分推演'){
   worker?.terminate();worker=null;
   if(pending){clearTimeout(pending.timer);pending.reject(Error(message));pending=null;}
  }
  function run(key,input){
   if(pending)return Promise.reject(Error('本分正在推演'));
   return new Promise((resolve,reject)=>{
    const id=++sequence;
    try{
     if(!worker){worker=spawn();worker.onmessage=({data})=>{if(!pending||data.id!==pending.id)return;const p=pending;clearTimeout(p.timer);pending=null;if(data.error){worker.terminate();worker=null;p.reject(Error(data.error));}else p.resolve(data);};worker.onerror=e=>{e.preventDefault?.();cancel('比赛推演失败，请重试本分');};}
     pending={id,resolve,reject,timer:setTimeout(()=>cancel('本分推演超时，请重试；已完成的比分保留'),timeout)};
     worker.postMessage({id,key,input});
    }catch(error){cancel(error.message);reject(error);}
   });
  }
  return {run,cancel};
 }
 return {create};
});
