import {glyphBounds} from './core.js';
export function characterProportions(ch){
 if(ch==='.')return{height:.07,bottom:0,maxWidth:.18};
 if(ch===',')return{height:.2,bottom:.15,maxWidth:.25};
 if(ch==='\''||ch==='"')return{height:.22,bottom:-.65,maxWidth:.5};
 if(ch==='-')return{height:.07,bottom:-.3,maxWidth:.6,targetWidth:.45};
 if(ch===':')return{height:.43,bottom:-.05,maxWidth:.2};
 if(ch===';')return{height:.58,bottom:.12,maxWidth:.25};
 if(ch==='j')return{height:1.08,bottom:.24,maxWidth:.65};
 if(/[gpqy]/.test(ch))return{height:.86,bottom:.24,maxWidth:1};
 if(/[bdfhiklt]/.test(ch))return{height:.9,bottom:0,maxWidth:.95};
 if(/[a-z]/.test(ch))return{height:.62,bottom:0,maxWidth:/[mw]/.test(ch)?1.25:1};
 return{height:.9,bottom:0,maxWidth:/[MW%&]/.test(ch)?1.35:1.1};
}
export function profileInkCalibration(profile){
 const heights=[];for(const ch of 'aceimnorsuvwxz')for(const s of profile.samples[ch]||[]){if(s?.outlineData&&s.sourceBaseline!==undefined){const b=glyphBounds(s),h=b.maxY-b.minY;if(h>5)heights.push(h);}}
 heights.sort((a,b)=>a-b);return heights.length?heights[Math.floor(heights.length/2)]:55;
}
export function normalizedGlyphMetrics(ch,sample,size,bodyHeight=55){
 const bounds=glyphBounds(sample),rawH=bounds.maxY-bounds.minY,rawW=bounds.maxX-bounds.minX,p=characterProportions(ch);
 if(sample.outlineData&&sample.sourceBaseline!==undefined){
  const scale=size*.62/Math.max(5,bodyHeight),inkWidth=rawW*scale,inkHeight=rawH*scale,top=(bounds.minY-sample.sourceBaseline)*scale;
  return{bounds,scaleX:scale,scaleY:scale,inkWidth,inkHeight,top,ascent:Math.max(0,-top),descent:Math.max(0,top+inkHeight),width:Math.max(size*.12,inkWidth)+size*.1};
 }
 let scaleY=size*p.height/Math.max(1,rawH),scaleX=scaleY;
 if(p.targetWidth&&rawW>0){scaleX=size*p.targetWidth/rawW;scaleY=Math.min(scaleX,scaleY);}
 scaleX=Math.min(scaleX,size*p.maxWidth/Math.max(1,rawW));
 // Preserve the original ink aspect ratio instead of squeezing wide letters.
 scaleY=Math.min(scaleY,scaleX);
 const inkWidth=rawW*scaleX,inkHeight=rawH*scaleY,top=size*p.bottom-inkHeight;
 return{bounds,scaleX,scaleY,inkWidth,inkHeight,top,ascent:Math.max(0,-top),descent:Math.max(0,top+inkHeight),width:Math.max(size*.12,inkWidth)+size*.1};
}
