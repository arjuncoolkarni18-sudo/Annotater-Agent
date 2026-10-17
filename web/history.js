const DB_NAME='margin-projects-v1';
let databasePromise;
export function openDatabase(){
 if(!globalThis.indexedDB)return Promise.reject(Error('Device storage is unavailable. Enable browser storage to save projects.'));
 databasePromise??=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('projects')){const store=db.createObjectStore('projects',{keyPath:'key'});store.createIndex('owner','owner');}if(!db.objectStoreNames.contains('summaries')){const summaries=db.createObjectStore('summaries',{keyPath:'key'});summaries.createIndex('owner','owner');request.transaction.objectStore('projects').openCursor().onsuccess=e=>{const cursor=e.target.result;if(cursor){summaries.put(summary(cursor.value));cursor.continue();}};}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{databasePromise=null;reject(request.error);};request.onblocked=()=>reject(Error('Close another Margin tab to update storage.'));});return databasePromise;
}
function key(owner,id){return JSON.stringify([owner,id]);}
async function transaction(mode,operation){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(['projects','summaries'],mode);let result;try{result=operation(tx.objectStore('projects'),tx.objectStore('summaries'));}catch(err){tx.abort();reject(err);return;}tx.oncomplete=()=>resolve(result?.result);tx.onabort=()=>reject(tx.error||Error('Device storage could not finish.'));tx.onerror=()=>reject(tx.error||Error('Device storage failed.'));});}
function summary({bytes,annotations,...record}){return{...record,noteCount:(annotations||[]).filter(n=>n.kind==='note').length};}
export async function saveProject(owner,project){if(!owner||!project.id||!project.bytes)throw Error('A signed-in user and PDF are required to save.');const record={...project,owner,key:key(owner,project.id)};await transaction('readwrite',(projects,summaries)=>{projects.put(record);summaries.put(summary(record));});}
export async function getProject(owner,id){const record=await transaction('readonly',store=>store.get(key(owner,id)));return record?.owner===owner?record:null;}
export async function listProjects(owner){const records=await transaction('readonly',(_,summaries)=>summaries.index('owner').getAll(owner));return records.sort((a,b)=>b.updatedAt-a.updatedAt);}
export async function deleteProject(owner,id){await transaction('readwrite',(projects,summaries)=>{projects.delete(key(owner,id));summaries.delete(key(owner,id));});}
