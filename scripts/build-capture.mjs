import {readFile,writeFile,mkdir} from 'node:fs/promises';
const inputs=['web/core.js','web/handwriting-metrics.js','web/handwriting.js','lib/capture-state.mjs','web/capture.js'];
const chunks=[];for(const file of inputs){const source=await readFile(file,'utf8');chunks.push(source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport (?=(?:const|function)\b)/g,''));}
const template=await readFile('web/capture.html','utf8');
const html=template.replace('/* MARGIN_CAPTURE_SOURCE */',()=>chunks.join('\n').replace(/<\/script/gi,'<\\/script'));
await mkdir('docs',{recursive:true});await writeFile('docs/index.html',html);await writeFile('docs/.nojekyll','');console.log('Built a self-contained handwriting capture page in docs/index.html.');
