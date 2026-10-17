const SESSION_COOKIE='__Host-margin_session';
const OAUTH_COOKIE='__Host-margin_oauth';
export const SESSION_SECONDS=7*24*60*60;
export const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const sessionCookie=(value,maxAge=SESSION_SECONDS)=>cookie(SESSION_COOKIE,value,maxAge);
export const oauthCookie=(value,maxAge=600)=>cookie(OAUTH_COOKIE,value,maxAge);
export function readCookie(request,name){return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';}
export function randomToken(){return base64url(crypto.getRandomValues(new Uint8Array(32)));}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export async function digest(value){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export function allowedEmail(email,env){return typeof email==='string'&&(env.ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());}
export function appOrigin(env){try{const u=new URL(env.APP_ORIGIN);return u.protocol==='https:'&&u.origin===env.APP_ORIGIN?u.origin:null;}catch{return null;}}
export function authConfigured(env){return Boolean(appOrigin(env)&&env.DB&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&(env.ALLOWED_EMAILS||'').trim());}
export async function getUser(request,env){
 const token=readCookie(request,SESSION_COOKIE);if(!env.DB||!/^[\w-]{43}$/.test(token))return null;
 const row=await env.DB.prepare('SELECT owner_id,email,name FROM google_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token),Date.now()).first();
 return row&&allowedEmail(row.email,env)?{id:row.owner_id,email:row.email,name:row.name}:null;
}
export async function startGoogle(request,env){
 const state=randomToken(),browser=randomToken(),verifier=randomToken(),now=Date.now();
 await env.DB.prepare('DELETE FROM google_oauth_states WHERE expires_at <= ?').bind(now).run();
 await env.DB.prepare('INSERT INTO google_oauth_states (state_hash,browser_hash,verifier,expires_at) VALUES (?,?,?,?)').bind(await digest(state),await digest(browser),verifier,now+600000).run();
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${env.APP_ORIGIN}/auth/callback`,response_type:'code',scope:'openid email profile',state,code_challenge:await digest(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':oauthCookie(browser),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function finishGoogle(request,env,fetcher=fetch){
 const url=new URL(request.url),state=url.searchParams.get('state')||'',browser=readCookie(request,OAUTH_COOKIE);
 if(!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(browser))throw Error('The sign-in request expired. Start again.');
 const transaction=await env.DB.prepare('DELETE FROM google_oauth_states WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING verifier').bind(await digest(state),await digest(browser),Date.now()).first();
 if(!transaction)throw Error('The sign-in request expired or was already used. Start again.');
 const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))throw Error('Google sign-in was cancelled. You can try again.');
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${env.APP_ORIGIN}/auth/callback`,grant_type:'authorization_code',code_verifier:transaction.verifier}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Google could not complete sign-in. Start again.');
 const tokens=await response.json();if(typeof tokens.access_token!=='string')throw Error('Google did not return a sign-in token.');
 // Identity comes from Google's authenticated UserInfo endpoint, never a decoded, unverified ID token.
 const identity=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});
 if(!identity.ok)throw Error('Your Google account could not be verified.');
 const person=await identity.json();if(typeof person.sub!=='string'||!person.sub||person.sub.length>255||person.email_verified!==true||!allowedEmail(person.email,env))throw Error('This Google account has not been granted access to this workspace.');
 const token=randomToken(),owner=`google:${person.sub}`,name=typeof person.name==='string'?person.name.slice(0,150):person.email;
 await env.DB.prepare('DELETE FROM google_sessions WHERE expires_at <= ?').bind(Date.now()).run();
 await env.DB.prepare('INSERT INTO google_sessions (token_hash,owner_id,email,name,expires_at) VALUES (?,?,?,?,?)').bind(await digest(token),owner,person.email,name,Date.now()+SESSION_SECONDS*1000).run();
 const headers=new Headers({Location:'/', 'Cache-Control':'no-store'});headers.append('Set-Cookie',sessionCookie(token));headers.append('Set-Cookie',oauthCookie('',0));
 return new Response(null,{status:303,headers});
}
export async function logout(request,env){const token=readCookie(request,SESSION_COOKIE);if(token)await env.DB.prepare('DELETE FROM google_sessions WHERE token_hash = ?').bind(await digest(token)).run();return new Response(null,{status:303,headers:{Location:'/', 'Cache-Control':'no-store','Set-Cookie':sessionCookie('',0)}});}
