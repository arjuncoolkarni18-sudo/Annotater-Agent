import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ANSWER_SCHEMA,validateDraftRequest,normalizeAnswers,instructionsFor} from '../../../lib/drafting.mjs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to use worksheet drafting.'},{status:401,headers:privateHeaders});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Use this workspace to request a draft.'},{status:403,headers:privateHeaders});
 const configuration=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
 if(!configuration.OPENAI_API_KEY)return Response.json({error:'AI drafting needs an approved API connection. The document editor is ready to use.'},{status:503,headers:privateHeaders});
 if(Number(request.headers.get('content-length')||0)>1500000)return Response.json({error:'This request is too large.'},{status:413,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>900000)return Response.json({error:'Use fewer pages or a shorter source excerpt.'},{status:413,headers:privateHeaders});
  let input;try{input=validateDraftRequest(JSON.parse(raw));}catch(err){return Response.json({error:err instanceof Error?err.message:'Invalid request.'},{status:400,headers:privateHeaders});}
  const model=configuration.OPENAI_MODEL||'gpt-5-mini';
  const body={model,store:false,...(model==='gpt-5-mini'?{reasoning:{effort:'minimal'}}:{}),instructions:instructionsFor(input.mode),input:JSON.stringify(input),max_output_tokens:input.mode==='rewrite'?1200:6500,...(input.mode==='worksheet'?{text:{format:{type:'json_schema',name:'worksheet_draft',strict:true,schema:ANSWER_SCHEMA}}}:{})};
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${configuration.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  if(!response.ok){let code='';try{const failure=await response.json() as {error?:{code?:string;type?:string}};code=failure.error?.code||failure.error?.type||'';}catch{}
   const quota=['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(code);
   return Response.json({error:quota?'Your OpenAI API credits are exhausted. Add credits in OpenAI Platform billing, then try again. ChatGPT Plus does not include API credits.':response.status===429?'AI requests are temporarily rate-limited. Wait a little and try again.':'AI drafting could not complete. Your document is unchanged.',code:quota?'billing_required':'generation_failed'},{status:quota?402:502,headers:privateHeaders});}
  const result=await response.json() as {status?:string;usage?:{input_tokens:number;output_tokens:number};output?:Array<{type?:string;content?:Array<{type:string;text?:string}>}>};
  if(result.status!=='completed')return Response.json({error:'The AI draft was incomplete. Try fewer pages or a shorter excerpt.'},{status:502,headers:privateHeaders});
  const text=(result.output||[]).flatMap(item=>item.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
  if(input.mode==='rewrite'){if(!text.trim()||text.length>1200)throw Error('Invalid revised text.');return Response.json({text},{headers:privateHeaders});}
  const inputTokens=result.usage?.input_tokens||0,outputTokens=result.usage?.output_tokens||0;
  return Response.json({...normalizeAnswers(JSON.parse(text),input.pages),usage:{inputTokens,outputTokens,estimatedCostUsd:model==='gpt-5-mini'?(inputTokens*.25+outputTokens*2)/1000000:null}},{headers:privateHeaders});
 }catch{return Response.json({error:'The AI request could not finish. Try again with fewer pages; your edits are still saved.'},{status:502,headers:privateHeaders});}
}
