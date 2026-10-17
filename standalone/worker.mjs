import {authConfigured,appOrigin,startGoogle,finishGoogle,getUser,logout,oauthCookie} from './auth.mjs';
import {validateProfile} from '../web/core.js';
import {ANSWER_SCHEMA,validateDraftRequest,normalizeAnswers,instructionsFor} from '../lib/drafting.mjs';

const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(data,status=200)=>Response.json(data,{status,headers:privateHeaders});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function screen(title,message,action='',status=200,extra={}){
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Margin · ${escape(title)}</title><style>body{margin:0;background:#f5f2ec;color:#303a35;font:17px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:440px;padding:40px}small{font-size:36px;font-family:Georgia,serif;color:#a6543c}h1{font:42px/1.15 Georgia,serif}p{color:#62685d}a,button{display:inline-block;padding:13px 22px;border:1px solid #334c40;border-radius:8px;background:#334c40;color:white;text-decoration:none;font:inherit;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #a6543c;outline-offset:4px}</style><main><small>m·</small><h1>${escape(title)}</h1><p>${escape(message)}</p>${action}</main></html>`,{status,headers:{...privateHeaders,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",...extra}});
}
async function readLimited(request,max){
 if(Number(request.headers.get('content-length')||0)>max)throw Object.assign(Error('This request is too large.'),{status:413});
 const reader=request.body?.getReader();if(!reader)return '';const parts=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw Object.assign(Error('This request is too large.'),{status:413});}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return new TextDecoder().decode(bytes);
}
export async function profileRoute(request,env,user){
 if(request.method==='GET'){
  const row=await env.DB.prepare('SELECT payload,revision,updated_at FROM handwriting_profiles WHERE owner_id = ?').bind(user.id).first();
  return json(row?{profile:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at}:{profile:null,revision:0});
 }
 if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
 const raw=await readLimited(request,2000000);let payload,revision;
 try{const input=JSON.parse(raw);payload=JSON.stringify(validateProfile(input.profile));revision=input.expectedRevision;if(!Number.isSafeInteger(revision)||revision<0)throw Error();}catch{return json({error:'The handwriting profile is invalid.'},400);}
 if(new TextEncoder().encode(payload).length>1900000)return json({error:'This handwriting profile is too large for account storage. Download a backup to keep every sample.'},413);
 const now=Date.now(),result=revision===0?await env.DB.prepare('INSERT INTO handwriting_profiles (owner_id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO NOTHING').bind(user.id,payload,now).run():await env.DB.prepare('UPDATE handwriting_profiles SET payload = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(payload,now,user.id,revision).run();
 if(result.meta.changes!==1){const current=await env.DB.prepare('SELECT payload,revision FROM handwriting_profiles WHERE owner_id = ?').bind(user.id).first();return json({error:'This profile changed on another device.',profile:current?JSON.parse(current.payload):null,revision:current?.revision||0},409);}
 return json({revision:revision+1,updatedAt:now});
}
async function draftRoute(request,env,user,fetcher){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!env.OPENAI_API_KEY)return json({error:'The worksheet assistant is not connected yet. You can still edit your PDF.'},503);
 const raw=await readLimited(request,900000);let input;
 try{input=validateDraftRequest(JSON.parse(raw));}catch(error){return json({error:error.message||'Invalid draft request.'},400);}
 const configured=Number(env.DAILY_AI_LIMIT||25),limit=Number.isInteger(configured)&&configured>0?Math.min(configured,500):25,day=new Date().toISOString().slice(0,10);
 const usage=await env.DB.prepare('INSERT INTO ai_daily_usage (owner_id,day,requests) VALUES (?,?,1) ON CONFLICT(owner_id,day) DO UPDATE SET requests = requests + 1 WHERE requests < ? RETURNING requests').bind(user.id,day,limit).first();
 if(!usage)return json({error:'Your daily drafting limit has been reached. You can continue editing and try drafting tomorrow.'},429);
 const model=env.OPENAI_MODEL||'gpt-5-mini',body={model,store:false,...(model==='gpt-5-mini'?{reasoning:{effort:'minimal'}}:{}),instructions:instructionsFor(input.mode),input:JSON.stringify(input),max_output_tokens:input.mode==='rewrite'?1200:6500,...(input.mode==='worksheet'?{text:{format:{type:'json_schema',name:'worksheet_draft',strict:true,schema:ANSWER_SCHEMA}}}:{})};
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 if(!response.ok){let code='';try{const failure=await response.json();code=failure.error?.code||failure.error?.type||'';}catch{}
  const quota=['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(code);return json({error:quota?'Your OpenAI API credits are exhausted. Add credits in OpenAI Platform billing, then try again.':response.status===429?'AI requests are temporarily rate-limited. Wait a little and try again.':'AI drafting could not complete. Your document is unchanged.',code:quota?'billing_required':'generation_failed'},quota?402:502);
 }
 const result=await response.json();if(result.status!=='completed')return json({error:'The draft was incomplete. Try fewer pages.'},502);
 const text=(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
 if(input.mode==='rewrite'){if(!text.trim()||text.length>1200)return json({error:'The revised text could not be read. Your original is unchanged.'},502);return json({text});}
 let normalized;try{normalized=normalizeAnswers(JSON.parse(text),input.pages);}catch{return json({error:'The drafted answers could not be read. Try again with fewer pages.'},502);}
 return json({...normalized,usage:{inputTokens:result.usage?.input_tokens||0,outputTokens:result.usage?.output_tokens||0,estimatedCostUsd:null}});
}
export async function handleRequest(request,env,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(!authConfigured(env))return path.startsWith('/api/')?json({authenticated:false,authProvider:'google',error:'Google sign-in and account storage have not been configured yet.'},503):screen('Almost ready.','The owner is connecting Google sign-in and account storage. Please come back when setup is complete.','',503);
  if(url.origin!==appOrigin(env))return json({error:'Use the configured app address.'},400);
  if(!['GET','HEAD','POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(['POST','PUT'].includes(request.method)&&request.headers.get('origin')!==env.APP_ORIGIN)return json({error:'Send this request from your signed-in workspace.'},403);
  if(path==='/auth/google'&&request.method==='GET')return await startGoogle(request,env);
  if(path==='/auth/callback'&&request.method==='GET'){
   try{return await finishGoogle(request,env,fetcher);}catch(error){return screen('Let’s try that again.',error.message,'<a href="/auth/google">Continue with Google</a>',400,{'Set-Cookie':oauthCookie('',0)});}
  }
  const user=await getUser(request,env);
  if(path==='/api/session'&&request.method==='GET')return user?json({authenticated:true,authProvider:'google',user,signOutUrl:'/auth/logout',aiConfigured:Boolean(env.OPENAI_API_KEY)}):json({authenticated:false,authProvider:'google',signInUrl:'/auth/google'},401);
  if(!user)return path.startsWith('/api/')?json({error:'Sign in with Google to open your workspace.'},401):screen('Your notes, in your own hand.','Sign in to open your PDFs and personal handwriting profile.','<a href="/auth/google">Continue with Google</a>');
  if(path==='/auth/logout')return request.method==='POST'?await logout(request,env):screen('Sign out of Margin?','Your saved handwriting will be here when you return.','<form action="/auth/logout" method="post"><button>Sign out</button></form>');
  if(path==='/api/profile')return await profileRoute(request,env,user);
  if(path==='/api/draft')return await draftRoute(request,env,user,fetcher);
  if(path.startsWith('/api/')||path.startsWith('/auth/'))return json({error:'Not found.'},404);
  if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
  // Let the assets router serve the canonical root. Fetching /index.html here
  // redirects back to / under Cloudflare's default HTML handling and loops.
  if(path==='/studio.html')url.pathname='/';
  const response=await env.ASSETS.fetch(new Request(url,request));
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');
  if(headers.get('content-type')?.includes('text/html'))headers.set('Cache-Control','private, no-store');
  return new Response(response.body,{status:response.status,headers});
 }catch(error){return json({error:error.status===413?error.message:'This request could not finish. Your saved work is unchanged.'},error.status===413?413:503);}
}
export default{fetch(request,env){return handleRequest(request,env);}};
