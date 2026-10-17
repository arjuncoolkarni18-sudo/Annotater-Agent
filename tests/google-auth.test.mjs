import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleRequest} from '../standalone/worker.mjs';
import {digest,randomToken,sessionCookie} from '../standalone/auth.mjs';

const origin='https://margin.example.com';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../standalone/migrations/0001_google_accounts.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return{bind(...values){return{async first(){return sql.prepare(query).get(...values)||null;},async run(){const result=sql.prepare(query).run(...values);return{meta:{changes:Number(result.changes)}};}};}};}};
 return{env:{DB,APP_ORIGIN:origin,ALLOWED_EMAILS:'owner@example.com',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',OPENAI_API_KEY:'test-api-key',DAILY_AI_LIMIT:'1',ASSETS:{fetch:async()=>new Response('editor',{headers:{'content-type':'text/html'}})}},sql};
}
function request(path,options={}){return new Request(origin+path,options);}
async function addSession(env,id='one',email='owner@example.com',expired=false){const token=randomToken();await env.DB.prepare('INSERT INTO google_sessions (token_hash,owner_id,email,name,expires_at) VALUES (?,?,?,?,?)').bind(await digest(token),`google:${id}`,email,'Owner',Date.now()+(expired?-1000:60000)).run();return sessionCookie(token).split(';')[0];}
const withCookie=(cookie,extra={})=>({headers:{cookie,...extra}});

test('independent app requires Google, ignores forged ChatGPT identity, and fails closed before setup',async()=>{
 const {env}=setup();let response=await handleRequest(request('/api/session',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'}}),env);
 assert.equal(response.status,401);assert.equal((await response.json()).authProvider,'google');
 response=await handleRequest(request('/'),env);assert.match(await response.text(),/Continue with Google/);
 response=await handleRequest(request('/api/session'),{...env,ALLOWED_EMAILS:''});assert.equal(response.status,503);
 response=await handleRequest(new Request('https://other.example.com/auth/google'),env);assert.equal(response.status,400);
});

test('Google code flow uses state, browser binding and PKCE; consumes state once; issues an opaque secure session',async()=>{
 const {env,sql}=setup(),start=await handleRequest(request('/auth/google'),env),google=new URL(start.headers.get('location')),browser=start.headers.get('set-cookie').split(';')[0];
 assert.equal(google.hostname,'accounts.google.com');assert.equal(google.searchParams.get('code_challenge_method'),'S256');assert.match(start.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 let exchanged;const fetcher=async(url,options)=>{if(url.endsWith('/token')){exchanged=new URLSearchParams(options.body);return Response.json({access_token:'google-test-access'});}assert.equal(options.headers.Authorization,'Bearer google-test-access');return Response.json({sub:'stable-google-subject',email:'owner@example.com',email_verified:true,name:'Owner'});};
 const path='/auth/callback?state='+google.searchParams.get('state')+'&code=one-use-code';
 let response=await handleRequest(request(path,withCookie('__Host-margin_oauth='+randomToken())),env,fetcher);assert.equal(response.status,400);assert.equal(sql.prepare('SELECT count(*) AS n FROM google_oauth_states').get().n,1);
 response=await handleRequest(request(path,withCookie(browser)),env,fetcher);assert.equal(response.status,303);assert.equal(await digest(exchanged.get('code_verifier')),google.searchParams.get('code_challenge'));assert.equal(exchanged.get('redirect_uri'),origin+'/auth/callback');
 const cookie=response.headers.getSetCookie().find(v=>v.startsWith('__Host-margin_session=')).split(';')[0];assert.doesNotMatch(cookie,/stable-google-subject|owner@example.com/);
 response=await handleRequest(request('/api/session',withCookie(cookie)),env);const session=await response.json();assert.equal(session.user.id,'google:stable-google-subject');assert.equal(session.user.email,'owner@example.com');
 response=await handleRequest(request(path,withCookie(browser)),env,fetcher);assert.equal(response.status,400);
});

test('unapproved or unverified Google accounts cannot create sessions',async()=>{
 for(const person of [{sub:'x',email:'stranger@example.com',email_verified:true},{sub:'x',email:'owner@example.com',email_verified:false}]){
  const {env,sql}=setup(),start=await handleRequest(request('/auth/google'),env),url=new URL(start.headers.get('location')),cookie=start.headers.get('set-cookie').split(';')[0];
  const response=await handleRequest(request('/auth/callback?state='+url.searchParams.get('state')+'&code=code',withCookie(cookie)),env,async endpoint=>Response.json(endpoint.endsWith('/token')?{access_token:'x'}:person));
  assert.equal(response.status,400);assert.equal(sql.prepare('SELECT count(*) AS n FROM google_sessions').get().n,0);
 }
});

test('expired sessions are rejected; logout is confirmed and revokes the server session',async()=>{
 const {env}=setup(),expired=await addSession(env,'expired','owner@example.com',true);assert.equal((await handleRequest(request('/api/session',withCookie(expired)),env)).status,401);
 const cookie=await addSession(env);assert.equal((await handleRequest(request('/auth/logout',withCookie(cookie)),env)).status,200);assert.equal((await handleRequest(request('/api/session',withCookie(cookie)),env)).status,200);
 assert.equal((await handleRequest(request('/auth/logout',{method:'POST',headers:{cookie,origin:'https://untrusted.example'}}),env)).status,403);
 const response=await handleRequest(request('/auth/logout',{method:'POST',headers:{cookie,origin}}),env);assert.equal(response.status,303);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await handleRequest(request('/api/session',withCookie(cookie)),env)).status,401);
});

test('all six alphabet samples save to Google account storage with conflict checks and user isolation',async()=>{
 const {env}=setup(),cookie=await addSession(env),other=await addSession(env,'two');
 const profile={version:1,name:'Full alphabet',samples:Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map(ch=>[ch,Array.from({length:6},(_,n)=>({strokes:[[[20,30],[40+n,110]]]}))]))};
 const put=revision=>request('/api/profile',{method:'PUT',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({profile,expectedRevision:revision})});
 assert.equal((await handleRequest(put(0),env)).status,200);const read=await (await handleRequest(request('/api/profile',withCookie(cookie)),env)).json();assert.deepEqual(read.profile,profile);assert.equal(read.revision,1);
 const conflicting=await handleRequest(put(0),env);assert.equal(conflicting.status,409);assert.deepEqual((await conflicting.json()).profile,profile);
 assert.equal((await (await handleRequest(request('/api/profile',withCookie(other)),env)).json()).profile,null);
 assert.equal((await handleRequest(request('/api/profile',{method:'PUT',headers:{cookie},body:JSON.stringify({profile,expectedRevision:1})}),env)).status,403);
});

test('AI uses server credentials, enforces daily limits and accepts drafting without a reference text',async()=>{
 const {env}=setup(),cookie=await addSession(env),input={mode:'worksheet',pages:[{page:1,width:500,height:700,text:'What is 2+2?',lines:[]}],source:''};let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-api-key');const body=JSON.parse(options.body);assert.equal(JSON.parse(body.input).source,'');assert.equal(body.reasoning.effort,'minimal');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answers:[{page:1,question:'What is 2+2?',answer:'4',source:'General knowledge; verify',x:30,y:60,width:100}],warnings:[]})}]}],usage:{input_tokens:10,output_tokens:20}});};
 const send=()=>handleRequest(request('/api/draft',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify(input)}),env,fetcher);
 let response=await send();assert.equal(response.status,200);assert.equal((await response.json()).answers[0].answer,'4');response=await send();assert.equal(response.status,429);assert.equal(calls,1);
});

test('oversized requests are refused and database failures do not escape the handler',async()=>{
 const {env}=setup(),cookie=await addSession(env);let response=await handleRequest(request('/api/profile',{method:'PUT',headers:{cookie,origin,'content-length':'9000000'},body:'{}'}),env);assert.equal(response.status,413);
 const broken={...env,DB:{prepare(){throw Error('internal-secret-detail');}}};response=await handleRequest(request('/api/session',withCookie(cookie)),broken);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/internal-secret-detail/);
});
