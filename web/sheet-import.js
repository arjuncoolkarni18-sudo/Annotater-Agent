// Fixed geometry of Margin handwriting sheet v1 (US Letter, PDF points).
export const SHEET_PAGES=['abcdefgh','ijklmnop','qrstuvwx','yz','ABCDEFGH','IJKLMNOP','QRSTUVWX','YZ','01234567','89.,!?',"'-:;()/+"];
export function cellRect(row,col){return{x:96+col*78+3,y:792-(552-row*64+58)+3,width:60,height:52};}
// Thin the ink to centerlines, preserving separate dots and disconnected pen strokes.
export function inkToSample(rgba,width,height){
 const n=80,a=new Uint8Array(n*n);
 for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const sx=Math.floor(x/n*width),sy=Math.floor(y/n*height),i=(sy*width+sx)*4;a[y*n+x]=rgba[i+3]>100&&Math.max(rgba[i],rgba[i+1],rgba[i+2])<155?1:0;}
 if(a.reduce((s,v)=>s+v,0)<3)return null;
 for(let pass=0;pass<80;pass++){let changed=false;for(let phase=0;phase<2;phase++){const remove=[];for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(!a[i])continue;const p=[a[i-n],a[i-n+1],a[i+1],a[i+n+1],a[i+n],a[i+n-1],a[i-1],a[i-n-1]],b=p.reduce((s,v)=>s+v,0),t=p.reduce((s,v,k)=>s+(!v&&p[(k+1)%8]?1:0),0);if(b<2||b>6||t!==1)continue;if(phase===0?(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]):(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;remove.push(i);}for(const i of remove)a[i]=0;if(remove.length)changed=true;}if(!changed)break;}
 const neighbors=i=>[-n,-n+1,1,n+1,n,n-1,-1,-n-1].filter(d=>{if(!a[i+d])return false;const diagonal=Math.abs(d)!==1&&Math.abs(d)!==n;if(!diagonal)return true;const dy=d>0?n:-n,dx=d-dy;return !a[i+dy]&&!a[i+dx];}).map(d=>i+d);
 const edges=new Set(),strokes=[],key=(i,j)=>i<j?`${i}:${j}`:`${j}:${i}`;
 const point=i=>[(i%n)*2,Math.floor(i/n)*2];
 for(const start of Array.from(a.keys()).filter(i=>a[i]).sort((i,j)=>(neighbors(i).length===2)-(neighbors(j).length===2))){const ns=neighbors(start);if(!ns.length){strokes.push([point(start)]);continue;}for(const first of ns){if(edges.has(key(start,first)))continue;let prev=start,at=first;const line=[point(start)];edges.add(key(prev,at));while(true){line.push(point(at));const next=neighbors(at).filter(j=>!edges.has(key(at,j)));if(neighbors(at).length!==2||!next.length)break;const j=next[0];edges.add(key(at,j));prev=at;at=j;}strokes.push(line);}}
 const filtered=strokes.filter(s=>s.length>1||strokes.length<10);if(filtered.length>80)throw Error('A box contains too much detail. Use a plain pen and keep writing inside each box.');return filtered.length?{strokes:filtered}:null;
}
export function mergeSheet(profile, imported, replace=false){const next={...profile,samples:{...profile.samples}};for(const [ch,slots] of Object.entries(imported)){const current=[...(profile.samples[ch]||Array(6).fill(null))];for(let i=0;i<6;i++)if(slots[i]&&(replace||!current[i]))current[i]=slots[i];next.samples[ch]=current;}return next;}
export async function readSheet(file,pdfjs,onProgress=()=>{}){
 if(file.size>30*1024*1024)throw Error('Choose a template PDF under 30 MB.');
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 try{if(doc.numPages!==11)throw Error('Upload all 11 pages of the original Margin template, in order.');const samples={};
 for(let p=1;p<=11;p++){onProgress(p);const page=await doc.getPage(p),text=(await page.getTextContent()).items.map(i=>i.str||'').join(' ');if(!text.includes('MARGIN-HW-SHEET')||!text.includes('v1')||!new RegExp(`\\b${p}\\s*/\\s*11\\b`).test(text))throw Error('Use the original Margin template PDF with its text and page order preserved. Photos and flattened scans are not supported yet.');const viewport=page.getViewport({scale:2});if(Math.abs(viewport.width/viewport.height-612/792)>.005||page.rotate)throw Error('Export the template at its original size and orientation.');const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport}).promise;for(const [r,ch] of [...SHEET_PAGES[p-1]].entries()){const slots=Array(6).fill(null);for(let col=0;col<6;col++){const b=cellRect(r,col),data=ctx.getImageData(b.x*2,b.y*2,b.width*2,b.height*2);slots[col]=inkToSample(data.data,data.width,data.height);}samples[ch]=slots;}canvas.width=canvas.height=0;page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));}return samples;
 }finally{await doc.destroy();}
}
