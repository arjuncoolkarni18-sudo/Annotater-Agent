import {cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'dist-google');
await mkdir(out,{recursive:true});
await cp(path.join(root,'web'),out,{recursive:true});
console.log('Built the independent Google-login app. No ChatGPT hosting or sign-in is used.');
