import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {validateProfile} from '../../../web/core.js';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to load handwriting.'},{status:401,headers});
 if(!env.DB)return Response.json({error:'Account storage is not available yet.'},{status:503,headers});
 try{const record=await env.DB.prepare('SELECT payload, revision, updated_at FROM handwriting_profiles WHERE owner_id = ?').bind(user.userId).first<{payload:string;revision:number;updated_at:number}>();
 return Response.json(record?{profile:JSON.parse(record.payload),revision:record.revision,updatedAt:record.updated_at}:{profile:null,revision:0},{headers});
 }catch{return Response.json({error:'Could not load account handwriting. The device copy is unchanged.'},{status:503,headers});}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save handwriting.'},{status:401,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Use your signed-in workspace to save handwriting.'},{status:403,headers});
 if(!env.DB)return Response.json({error:'Account storage is not available yet.'},{status:503,headers});
 try{if(Number(request.headers.get('content-length')||0)>8388608)return Response.json({error:'This handwriting profile is too large.'},{status:413,headers});
 const raw=await request.text();if(raw.length>8388608)return Response.json({error:'This handwriting profile is too large.'},{status:413,headers});
 let payload,revision;try{const input=JSON.parse(raw);payload=JSON.stringify(validateProfile(input.profile));revision=input.expectedRevision;if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid revision.');}catch{return Response.json({error:'The handwriting profile is invalid.'},{status:400,headers});}
 const now=Date.now();const result=revision===0?await env.DB.prepare('INSERT INTO handwriting_profiles (owner_id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO NOTHING').bind(user.userId,payload,now).run():await env.DB.prepare('UPDATE handwriting_profiles SET payload = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(payload,now,user.userId,revision).run();
 if(result.meta.changes!==1){const current=await env.DB.prepare('SELECT payload,revision FROM handwriting_profiles WHERE owner_id = ?').bind(user.userId).first<{payload:string;revision:number}>();return Response.json({error:'This profile changed in another tab or device.',profile:current?JSON.parse(current.payload):null,revision:current?.revision||0},{status:409,headers});}
 return Response.json({revision:revision+1,updatedAt:now},{headers});
 }catch{return Response.json({error:'Could not save account handwriting. The device copy is unchanged.'},{status:503,headers});}
}
