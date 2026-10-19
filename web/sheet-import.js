import {outlineInk} from './ink-outline.js';
// Remove raster stair steps while retaining endpoints, pen lifts and distinct dots.
export function smoothInkStroke(points){
 if(points.length<4)return points;
 const reduced=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const a=reduced.at(-1),b=points[i],c=points[i+1];
  const distance=Math.abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))/Math.max(.001,Math.hypot(c[0]-a[0],c[1]-a[1]));
  if(distance>.3||Math.hypot(b[0]-a[0],b[1]-a[1])>3)reduced.push(b);
 }
 reduced.push(points.at(-1));
 const out=[reduced[0]];
 for(let i=0;i<reduced.length-1;i++){const a=reduced[i],b=reduced[i+1];out.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}
 out.push(reduced.at(-1));return out;
}
// Fixed geometry of Margin handwriting sheet v1 (US Letter, PDF points).
export const SHEET_PAGES=['abcdefgh','ijklmnop','qrstuvwx','yz','ABCDEFGH','IJKLMNOP','QRSTUVWX','YZ','01234567','89.,!?',"'-:;()/+"];
export function cellRect(row,col){return{x:96+col*78+3,y:792-(552-row*64+58)+3,width:60,height:52};}
// Thin the ink to centerlines, preserving separate dots and disconnected pen strokes.
export function inkToSample(rgba,width,height){return outlineInk(rgba,width,height);}
export function mergeSheet(profile, imported, replace=false){const next={...profile,samples:{...profile.samples}};for(const [ch,slots] of Object.entries(imported)){const current=[...(profile.samples[ch]||Array(6).fill(null))];for(let i=0;i<6;i++)if(slots[i]&&(replace||!current[i]))current[i]=slots[i];next.samples[ch]=current;}return next;}
export async function readSheet(file,pdfjs,onProgress=()=>{}){
 if(file.size>30*1024*1024)throw Error('Choose a template PDF under 30 MB.');
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 try{if(doc.numPages!==11)throw Error('Upload all 11 pages of the original Margin template, in order.');const samples={};
 for(let p=1;p<=11;p++){onProgress(p);const page=await doc.getPage(p),text=(await page.getTextContent()).items.map(i=>i.str||'').join(' ');if(!text.includes('MARGIN-HW-SHEET')||!text.includes('v1')||!new RegExp(`\\b${p}\\s*/\\s*11\\b`).test(text))throw Error('Use the original Margin template PDF with its text and page order preserved. Photos and flattened scans are not supported yet.');const viewport=page.getViewport({scale:6});if(Math.abs(viewport.width/viewport.height-612/792)>.005||page.rotate)throw Error('Export the template at its original size and orientation.');const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport}).promise;for(const [r,ch] of [...SHEET_PAGES[p-1]].entries()){const slots=Array(6).fill(null);for(let col=0;col<6;col++){const b=cellRect(r,col),data=ctx.getImageData(b.x*6,b.y*6,b.width*6,b.height*6);slots[col]=inkToSample(data.data,data.width,data.height);}samples[ch]=slots;}canvas.width=canvas.height=0;page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));}return samples;
 }finally{await doc.destroy();}
}
