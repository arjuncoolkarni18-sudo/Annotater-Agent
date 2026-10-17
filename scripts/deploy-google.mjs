import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function runWrangler(args,{capture=false}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.platform==='win32'?'wrangler.cmd':'wrangler',args,{stdio:['ignore',capture?'pipe':'inherit','inherit'],env:{...process.env,CI:'true'}});let output='';
  if(capture)child.stdout.setEncoding('utf8').on('data',chunk=>output+=chunk);
  child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(Error(`Wrangler ${args.slice(0,2).join(' ')} failed (${code}). Deployment stopped.`)));
 });
}
export async function deployGoogle({configPath='wrangler.google.jsonc',run=runWrangler}={}){
 const config=JSON.parse(await readFile(configPath,'utf8')),binding=config.d1_databases?.find(db=>db.binding==='DB');
 if(!binding?.database_name)throw Error('The Google deployment needs a named DB binding.');
 const list=async()=>{const rows=JSON.parse(await run(['d1','list','--json','--config',configPath],{capture:true}));if(!Array.isArray(rows))throw Error('Cloudflare returned an invalid database list.');return rows;};
 let databases=await list(),database=databases.find(db=>binding.database_id?db.uuid===binding.database_id:db.name===binding.database_name);
 if(!database){
  if(binding.database_id)throw Error('The configured database was not found. Deployment stopped to preserve account data.');
  await run(['d1','create',binding.database_name,'--config',configPath]);
  databases=await list();database=databases.find(db=>db.name===binding.database_name);
 }
 if(!database?.uuid||database.name!==binding.database_name)throw Error('The account database could not be identified safely.');
 // Provisioning in CI may leave the checked-in config without an ID. Resolve it
 // explicitly before the remote migration command, which requires database_id.
 binding.database_id=database.uuid;
 await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
 await run(['d1','migrations','apply','DB','--remote','--config',configPath]);
 await run(['deploy','--config',configPath]);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 deployGoogle().catch(error=>{console.error(error.message);process.exitCode=1;});
}
