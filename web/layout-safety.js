export const overlaps=(a,b,gap=1)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
export function rasterSafety(rgba,width,height,pageWidth,pageHeight){
 // Keep the original page's visible ink, including scans, table borders and images.
 const cell=2,cols=Math.ceil(pageWidth/cell),rows=Math.ceil(pageHeight/cell),mask=new Uint8Array(cols*rows);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(rgba[i+3]>100&&.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]<205){const col=Math.min(cols-1,Math.floor(x/width*pageWidth/cell)),row=Math.min(rows-1,Math.floor(y/height*pageHeight/cell));mask[row*cols+col]=1;}}
 const range=b=>({x0:Math.max(0,Math.floor(b.x/cell)),y0:Math.max(0,Math.floor(b.y/cell)),x1:Math.min(cols,Math.ceil((b.x+b.width)/cell)),y1:Math.min(rows,Math.ceil((b.y+b.height)/cell))});
 return{collides(b){const r=range(b);for(let y=r.y0;y<r.y1;y++)for(let x=r.x0;x<r.x1;x++)if(mask[y*cols+x])return true;return false;},availableHeight(x,y,w,max){const r=range({x,y,width:w,height:max});for(let row=r.y0;row<r.y1;row++)for(let col=r.x0;col<r.x1;col++)if(mask[row*cols+col])return Math.max(0,row*cell-y-2);return max;}};
}
export function validateNoteLayout(notes,{pageWidth,pageHeight,obstacles=[],raster,margin=8}){
 const issues=[];for(let i=0;i<notes.length;i++){const n=notes[i];if(n.kind!=='note')continue;
  const reasons=[];if(![n.x,n.y,n.width,n.height,n.size].every(Number.isFinite)||n.x<margin||n.y<margin||n.x+n.width>pageWidth-margin||n.y+n.height>pageHeight-margin)reasons.push('outside page margins');
  if(n.size>18)reasons.push('oversized worksheet text');if(n.size<8)reasons.push('text too small');
  if(obstacles.some(b=>overlaps(n,b,0))||raster?.collides(n))reasons.push('covers original worksheet content');
  if(notes.some((b,j)=>j!==i&&b.kind==='note'&&overlaps(n,b,2)))reasons.push('overlaps another answer');
  if(reasons.length)issues.push({id:n.id,reasons});
 }return issues;
}
