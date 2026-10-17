import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileSync,mergeProfiles} from '../web/profile-sync.js';
const sample=n=>({strokes:[[[20,30],[40+n,110]]]});
const empty=()=>({version:1,name:'',samples:{}});
function storage(){const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};}
function server(initial=null){let profile=initial,revision=initial?1:0;return{get profile(){return profile;},get revision(){return revision;},set(value){profile=structuredClone(value);revision++;},async fetch(_url,options={}){if(options.method!=='PUT')return Response.json({profile,revision});const request=JSON.parse(options.body);if(request.expectedRevision!==revision)return Response.json({profile,revision},{status:409});profile=request.profile;revision++;return Response.json({revision});}};}
test('a completed device alphabet migrates to account storage without losing a single sample',async()=>{
 let local={version:1,name:'My completed alphabet',samples:Object.fromEntries([...('abcdefghijklmnopqrstuvwxyz')].map(ch=>[ch,Array.from({length:6},(_,n)=>sample(n))]))};
 const original=structuredClone(local),remote=server(),statuses=[];
 const sync=createProfileSync({owner:'one',storage:storage(),readLocal:()=>local,applyProfile:p=>local=p,onStatus:s=>statuses.push(s),fetcher:remote.fetch});await sync.start();
 assert.deepEqual(remote.profile,original);assert.deepEqual(local,original);assert.equal(statuses.at(-1),'saved');assert.equal(sync.isPending(),false);
});
test('another device restores the profile, and a new site load preserves it',async()=>{
 const original={version:1,name:'My handwriting',samples:{a:[sample(1),sample(2)]}},remote=server(original),device=storage();let local=empty();
 for(let i=0;i<2;i++){const sync=createProfileSync({owner:'one',storage:device,readLocal:()=>local,applyProfile:p=>local=p,onStatus:()=>{},fetcher:remote.fetch});await sync.start();assert.equal(local.name,original.name);assert.deepEqual(local.samples.a.slice(0,2),original.samples.a);assert.equal(remote.revision,1);}
});
test('offline account sync never removes the browser-saved alphabet',async()=>{
 let local={version:1,name:'Saved locally',samples:{a:[sample(2)]}};const original=structuredClone(local),statuses=[];
 const sync=createProfileSync({owner:'one',storage:storage(),readLocal:()=>local,applyProfile:p=>local=p,onStatus:s=>statuses.push(s),fetcher:async()=>{throw Error('offline');}});await sync.start();assert.deepEqual(local,original);assert.equal(statuses.at(-1),'offline');assert.equal(sync.isPending(),true);
});
test('concurrent edits preserve a new local letter and a new cloud letter',async()=>{
 const initial={version:1,name:'Hand',samples:{a:[sample(1)]}},remote=server(initial);let local=structuredClone(initial);const device=storage();
 const sync=createProfileSync({owner:'one',storage:device,readLocal:()=>local,applyProfile:p=>local=p,onStatus:()=>{},fetcher:remote.fetch});await sync.start();
 local.samples.b=[sample(2)];remote.set({...initial,samples:{...initial.samples,c:[sample(3)]}});await sync.flush();assert.deepEqual(remote.profile.samples.b[0],sample(2));assert.deepEqual(remote.profile.samples.c[0],sample(3));assert.equal(sync.isPending(),false);
});
test('intentional clearing syncs while unrelated cloud changes are retained',()=>{
 const base={version:1,name:'x',samples:{a:[sample(1)],b:[sample(2)]}},local=structuredClone(base),remote=structuredClone(base);local.samples.a=[null];remote.samples.b=[sample(4)];const merged=mergeProfiles(base,local,remote);assert.equal(merged.samples.a,undefined);assert.deepEqual(merged.samples.b[0],sample(4));
});
