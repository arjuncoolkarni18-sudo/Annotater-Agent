import {cp,rename,rm} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
await cp(path.join(root,'web'),path.join(root,'public'),{recursive:true});
await rm(path.join(root,'public/studio.html'),{force:true});
await rename(path.join(root,'public/index.html'),path.join(root,'public/studio.html'));
