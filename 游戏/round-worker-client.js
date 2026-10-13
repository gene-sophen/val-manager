(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ROUND_WORKER=factory();})(typeof window==='object'?window:globalThis,()=>{
 function create({spawn,timeout=60000}){
  let worker=null,pending=null,sequence=0;
  function cancel(message='已取消本分推演'){
   worker?.terminate();worker=null;
   if(pending){clearTimeout(pending.timer);pending.reject(Error(message));pending=null;}
  }
  function run(key,input,{operation='step',onProgress}={}){
   if(pending)return Promise.reject(Error('本分正在推演'));
   return new Promise((resolve,reject)=>{
    const id=++sequence;
    try{
     if(!worker){worker=spawn();worker.onmessage=({data})=>{if(!pending||data.id!==pending.id)return;const p=pending;if(data.progress){p.onProgress?.(data.progress);return;}clearTimeout(p.timer);pending=null;if(data.error){worker.terminate();worker=null;p.reject(Error(data.error));}else p.resolve(data);};worker.onerror=e=>{e.preventDefault?.();cancel('比赛后台计算失败，已完成比分保留，请重试');};}
     pending={id,resolve,reject,onProgress,timer:setTimeout(()=>cancel(operation==='replay'?'历史回放恢复超时，可看战报或重试；原比分保留':'比赛恢复或推演超时，请重试；已完成的比分保留'),timeout)};
     worker.postMessage({id,key,input,operation});
    }catch(error){cancel(error.message);reject(error);}
   });
  }
  return {run,cancel};
 }
 return {create};
});
