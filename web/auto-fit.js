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
export function fitAnswer({x,y,width,pageWidth,pageHeight,size,obstacles=[],raster,measure,margin=18}){
 const left=Math.max(margin,Math.min(pageWidth-margin-50,x)),w=Math.max(30,Math.min(width,pageWidth-margin-left)),preferred=Math.min(size,14);
 let top=Math.max(margin,y);const relevant=obstacles.filter(b=>b.x<left+w+3&&b.x+b.width>left-3);
 for(let pass=0;pass<relevant.length+1;pass++){const hit=relevant.find(b=>b.y-3<=top&&b.y+b.height+3>top);if(!hit)break;top=hit.y+hit.height+4;}
 if(top>=pageHeight-margin)return null;
 const candidates=[];
 function add(b){
  b.x=Math.max(margin,b.x);b.width=Math.min(b.width,pageWidth-margin-b.x);b.maxHeight=Math.min(b.maxHeight,pageHeight-margin-b.y);
  for(const o of obstacles){if(o.x<b.x+b.width+2&&o.x+o.width>b.x-2){if(o.y<b.y&&o.y+o.height+2>b.y)return;if(o.y>=b.y)b.maxHeight=Math.min(b.maxHeight,o.y-b.y-4);}}
  if(raster)b.maxHeight=Math.min(b.maxHeight,raster.availableHeight(b.x,b.y,b.width,b.maxHeight));
  if(b.width>=30&&b.maxHeight>=16)candidates.push(b);
 }
 // Use a wider safe region before reducing handwriting size.
 for(const width of new Set([w,Math.min(pageWidth-margin-left,w*1.3),pageWidth-margin-left]))add({x:left,y:top,width,maxHeight:pageHeight-margin-top});
 // Search only near the question anchor and before its next substantial prompt.
 const questionEnd=Math.min(pageHeight-margin,...relevant.filter(b=>b.y>top+12&&b.width>Math.min(w*.5,100)).map(b=>b.y-4));
 for(const region of raster?.blankRegions?.(left,top,w,questionEnd)||[])add(region);
 let best=null,bestScore=-Infinity;const cache=new Map(),cachedMeasure=(s,w)=>{const key=`${s.toFixed(3)}:${w.toFixed(2)}`;if(!cache.has(key))cache.set(key,measure(s,w));return cache.get(key);};
 for(const region of candidates){const fit=fitTextBox({...region,size:preferred,measure:cachedMeasure});if(!fit)continue;
  if(obstacles.some(b=>fit.x<b.x+b.width+1&&fit.x+fit.width+1>b.x&&fit.y<b.y+b.height+1&&fit.y+fit.height+1>b.y)||raster?.collides(fit))continue;
  const score=fit.size*100-Math.abs(fit.x-left)*.2-Math.abs(fit.y-top)*.8-Math.max(0,fit.width-w)*.015;
  if(score>bestScore){best=fit;bestScore=score;}
 }
 return best?{...best,autoFit:{preferredSize:preferred,actualSize:best.size,reduced:best.size<preferred-.1}}:null;
}
export function textObstacles(items,viewport){
 return items.filter(i=>typeof i.str==='string'&&i.str.trim()&&!/^[_\-.\s]+$/.test(i.str)).map(i=>{
  const t=i.transform,advance=Math.hypot(t[0],t[1])||1,h=Math.max(3,Math.hypot(t[2],t[3])),dx=t[0]/advance*i.width,dy=t[1]/advance*i.width,hx=t[2]/(Math.hypot(t[2],t[3])||1)*h,hy=t[3]/(Math.hypot(t[2],t[3])||1)*h;
  const points=[[t[4],t[5]],[t[4]+dx,t[5]+dy],[t[4]+hx,t[5]+hy],[t[4]+dx+hx,t[5]+dy+hy]].map(p=>viewport.convertToViewportPoint(...p));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-1,y=Math.min(...ys)-1;
  return{x:Math.max(0,x),y:Math.max(0,y),width:Math.max(2,Math.max(...xs)-x+1),height:Math.max(2,Math.max(...ys)-y+2)};
 });
}
