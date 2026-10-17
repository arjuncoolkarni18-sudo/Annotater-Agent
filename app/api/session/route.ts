import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getChatGPTUser();
 const headers={'Cache-Control':'private, no-store'};
 if(!user)return Response.json({authenticated:false,signInUrl:chatGPTSignInPath('/')},{status:401,headers});
 const configuration=env as unknown as {OPENAI_API_KEY?:string};
 return Response.json({authenticated:true,user:{id:user.userId,name:user.fullName||user.displayName,email:user.email},signOutUrl:chatGPTSignOutPath('/'),aiConfigured:Boolean(configuration.OPENAI_API_KEY)},{headers});
}
