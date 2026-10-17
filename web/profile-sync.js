import {CHARACTERS,validateProfile,profileStats} from './core.js';
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export function mergeProfiles(base,local,remote){
 const result={version:1,name:base?(local.name!==base.name?local.name:remote.name):(local.name||remote.name),samples:{}};
 for(const ch of CHARACTERS){const values=[];for(let i=0;i<6;i++){
  const original=base?.samples[ch]?.[i]??null,left=local.samples[ch]?.[i]??null,right=remote.samples[ch]?.[i]??null;
  values.push(base?(!same(left,original)?left:right):(left||right));
 }while(values.length&&values.at(-1)===null)values.pop();if(values.length)result.samples[ch]=values;}
 return result;
}
export function createProfileSync({owner,readLocal,applyProfile,onStatus,fetcher=globalThis.fetch,storage=globalThis.localStorage}){
 let revision=0,base=null,ready=false,pending=false,timer,queue=Promise.resolve();const metaKey=`margin.handwriting.cloud.v1.${owner}`,recoveryKey=`margin.handwriting.recovery.v1.${owner}`;
 try{const saved=JSON.parse(storage.getItem(metaKey)||'null');if(saved&&Number.isInteger(saved.revision)){revision=saved.revision;base=validateProfile(saved.base);}}catch{}
 function metadata(){try{storage.setItem(metaKey,JSON.stringify({revision,base}));}catch{}}
 function recover(profile){try{if(!storage.getItem(recoveryKey))storage.setItem(recoveryKey,JSON.stringify(profile));}catch{}}
 async function push(){
  if(!ready){pending=true;return;}
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=validateProfile(readLocal());if(base&&same(snapshot,base)){pending=false;onStatus('saved');return;}
   onStatus('saving');
   const response=await fetcher('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:snapshot,expectedRevision:revision})});const result=await response.json();
   if(response.status===409&&result.profile){const remote=validateProfile(result.profile),local=validateProfile(readLocal());recover(local);const merged=mergeProfiles(base,local,remote);base=remote;revision=result.revision;metadata();applyProfile(merged);continue;}
   if(!response.ok)throw Error(result.error||'Account sync did not finish.');
   base=snapshot;revision=result.revision;metadata();if(same(readLocal(),snapshot)){pending=false;onStatus('saved');return;}
  }
  throw Error('The profile changed in another device. Your device copy is preserved; retry sync.');
 }
 function flush(){clearTimeout(timer);pending=true;queue=queue.catch(()=>{}).then(push).catch(error=>{pending=true;onStatus('offline',error.message);});return queue;}
 function changed(){pending=true;onStatus('saving');clearTimeout(timer);timer=setTimeout(flush,500);}
 async function start(){
  onStatus('loading');
  try{const response=await fetcher('/api/profile',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.error||'Account sync is unavailable.');
   const local=validateProfile(readLocal());
   if(result.profile){const remote=validateProfile(result.profile);if(profileStats(local).count||local.name)recover(local);const merged=mergeProfiles(base,local,remote);base=remote;revision=result.revision;metadata();applyProfile(merged);}
   else{base=null;revision=0;}
   ready=true;
   if(base&&!same(readLocal(),base)||!base&&(profileStats(readLocal()).count||readLocal().name)||pending)await flush();
   else onStatus(base?'saved':'empty');
  }catch(error){pending=true;onStatus('offline',error.message);}
 }
 async function retry(){if(!ready)return start();return flush();}
 return{start,changed,flush,retry,isPending:()=>pending};
}
