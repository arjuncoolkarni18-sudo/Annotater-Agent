// Fit actual measured glyphs, not a character-count estimate. Units are PDF points.
export function fitTextBox({x,y,width,maxHeight,size,minSize=8,measure}){
 if(width<20||maxHeight<1)return null;
 const fits=s=>{const result=measure(s,width);return !result.overflow&&result.height<=maxHeight+.01?result:null;};
 const full=fits(size);if(full)return{x,y,width,height:full.height,size,result:full};
 let low=Math.min(minSize,size),high=size,best=fits(low);if(!best)return null;
 for(let i=0;i<9;i++){const mid=(low+high)/2,r=fits(mid);if(r){low=mid;best=r;}else high=mid;}
 const actual=Math.floor(low*10)/10,result=fits(actual)||best;
 return{x,y,width,height:result.height,size:actual,result};
}
export function fitAnswer({x,y,width,pageWidth,pageHeight,size,obstacles=[],measure,margin=18}){
 const left=Math.max(margin,Math.min(pageWidth-margin-50,x)),w=Math.max(30,Math.min(width,pageWidth-margin-left));
 let top=Math.max(margin,y);const relevant=obstacles.filter(b=>b.x<left+w+3&&b.x+b.width>left-3);
 // If an estimated anchor intersects a prompt, move just below that prompt.
 for(let pass=0;pass<relevant.length+1;pass++){const hit=relevant.find(b=>b.y-3<=top&&b.y+b.height+3>top);if(!hit)break;top=hit.y+hit.height+4;}
 if(top>=pageHeight-margin)return null;
 const next=Math.min(pageHeight-margin,...relevant.filter(b=>b.y>=top).map(b=>b.y-4));
 return fitTextBox({x:left,y:top,width:w,maxHeight:next-top,size,measure});
}
export function textObstacles(items,viewport){
 return items.filter(i=>typeof i.str==='string'&&i.str.trim()&&!/^[_\-.\s]+$/.test(i.str)).map(i=>{
  const t=i.transform,advance=Math.hypot(t[0],t[1])||1,h=Math.max(3,Math.hypot(t[2],t[3])),dx=t[0]/advance*i.width,dy=t[1]/advance*i.width,hx=t[2]/(Math.hypot(t[2],t[3])||1)*h,hy=t[3]/(Math.hypot(t[2],t[3])||1)*h;
  const points=[[t[4],t[5]],[t[4]+dx,t[5]+dy],[t[4]+hx,t[5]+hy],[t[4]+dx+hx,t[5]+dy+hy]].map(p=>viewport.convertToViewportPoint(...p));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-1,y=Math.min(...ys)-1;
  return{x:Math.max(0,x),y:Math.max(0,y),width:Math.max(2,Math.max(...xs)-x+1),height:Math.max(2,Math.max(...ys)-y+2)};
 });
}
