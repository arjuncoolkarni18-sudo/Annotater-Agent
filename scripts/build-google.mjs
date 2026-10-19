import {cp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function buildGoogle(root=process.cwd()){
 const out=path.join(root,'dist-google'),web=path.join(root,'web');await mkdir(out,{recursive:true});await cp(web,out,{recursive:true});
 const files=(await readdir(web)).filter(p=>/\.(js|css|html)$/.test(p)).sort();const hash=createHash('sha256');
 for(const file of files)hash.update(await readFile(path.join(web,file)));const revision=hash.digest('hex').slice(0,16);
 for(const file of files){const target=path.join(out,file);let source=await readFile(target,'utf8');
  // One revision on every app import prevents a new renderer loading old layout code.
  source=source.replace(/(['"])(\.\/[^'"?\s]+\.(?:js|mjs))\1/g,(_,quote,url)=>`${quote}${url}?v=${revision}${quote}`);
  if(file.endsWith('.html'))source=source.replace(/((?:src|href)=["'])(\.\/[^"'?]+\.css)(["'])/g,(_,prefix,url,suffix)=>`${prefix}${url}?v=${revision}${suffix}`);
  await writeFile(target,source);
 }
 await writeFile(path.join(out,'build-version.json'),JSON.stringify({revision}));return revision;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))console.log('Built independent Google-login app:',await buildGoogle());
