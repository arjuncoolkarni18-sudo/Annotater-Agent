import {paintOutline,outlinePdf} from './ink-outline.js';
import {chooseSample,glyphBounds,randomGenerator,coverage} from './core.js';
import {normalizedGlyphMetrics,profileInkCalibration} from './handwriting-metrics.js';
export function renderNote(text,{style='hand',fontFamily='sans',size=16,color='#303a50',variation=.35,seed=1,width=220,profile={samples:{}},handwriting,resolution=3,measureOnly=false}={}){
  profile=handwriting||profile;
  const calibration=profileInkCalibration(profile);
  const random=randomGenerator(seed),last={},canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const padding=5,usable=width-padding*2,lines=[[]];let lineWidth=0;
  ctx.font=style==='hand'?`${size*1.18}px StarterHand`:`${size}px ${{sans:'MarginSans',serif:'MarginSerif',mono:'MarginMono'}[fontFamily]||'MarginSans'}`;
  const font=ctx.font;
  function makeGlyph(ch){
    if(ch===' ')return{ch,width:size*(style==='hand'?.5:.29)};
    const variants=style==='hand'?(profile.samples[ch]||[]):[],idx=chooseSample(variants,random,last[ch]);last[ch]=idx;
    const sample=idx<0?null:variants[idx];
    if(sample){return{ch,sample,...normalizedGlyphMetrics(ch,sample,size,calibration),rotation:0,jitter:0};}
    return{ch,width:ctx.measureText(ch).width+(style==='hand'?size*.02:0),rotation:0,jitter:0};
  }
  const words=text.replace(/\r\n?/g,'\n').replace(/[^\S\n]/gu,' ').split(/(\n| +)/);
  function newline(){lines.push([]);lineWidth=0;}
  for(const word of words){
    if(word==='\n'){newline();continue;}
    const glyphs=[...word].map(makeGlyph),wordWidth=glyphs.reduce((s,g)=>s+g.width,0);
    if(/^ +$/.test(word)&&lineWidth===0)continue;
    if(lineWidth>0&&lineWidth+wordWidth>usable){newline();if(/^ +$/.test(word))continue;}
    for(const glyph of glyphs){if(lineWidth+glyph.width>usable&&lineWidth>0)newline();lines.at(-1).push(glyph);lineWidth+=glyph.width;}
  }
  const allGlyphs=lines.flat(),ascent=Math.max(size*1.15,...allGlyphs.filter(g=>g.sample).map(g=>g.ascent+size*.08)),descent=Math.max(size*.3,...allGlyphs.filter(g=>g.sample).map(g=>g.descent+size*.08));
  const lineHeight=Math.max(size*1.5,ascent+descent+size*.1),height=padding*2+ascent+descent+Math.max(0,lines.length-1)*lineHeight;
  if(measureOnly)return{width,height,overflow:allGlyphs.some(g=>g.width>usable),coverage:coverage(text,profile)};
  const ratio=Math.max(1,Math.min(6,resolution));canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);ctx.scale(ratio,ratio);ctx.font=font;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  const vector=[];let vectorComplete=style==='hand';let y=padding+ascent;
  for(const line of lines){let x=padding+(style==='digital'?(random()-.5)*variation*1.1:0),lineJitter=style==='digital'?(random()-.5)*variation*.7:0;for(const g of line){
    if(g.ch!==' '){ctx.save();ctx.translate(x,y+(g.jitter||0)+lineJitter);ctx.rotate(g.rotation||0);
      if((g.sample?.outlineData||g.sample?.outlines)){vector.push(outlinePdf(g.sample,g,x,y+(g.jitter||0)+lineJitter,g.rotation||0));paintOutline(ctx,g.sample,p=>[(p[0]-g.bounds.minX)*g.scaleX,(p[1]-g.bounds.minY)*g.scaleY+g.top]);}
      else if(g.sample){vectorComplete=false;ctx.lineWidth=Math.max(.65,size*.06);const points=g.sample.strokes;for(const stroke of points){ctx.beginPath();for(let i=0;i<stroke.length;i++){const p=stroke[i],px=(p[0]-g.bounds.minX)*g.scaleX,py=(p[1]-g.bounds.minY)*g.scaleY+g.top;if(i===0)ctx.moveTo(px,py);else if(i<stroke.length-1){const next=stroke[i+1];ctx.quadraticCurveTo(px,py,((p[0]+next[0])/2-g.bounds.minX)*g.scaleX,((p[1]+next[1])/2-g.bounds.minY)*g.scaleY+g.top);}else ctx.lineTo(px,py);}if(stroke.length===1){const p=stroke[0];ctx.lineTo((p[0]-g.bounds.minX)*g.scaleX+.1,(p[1]-g.bounds.minY)*g.scaleY+g.top+.1);}ctx.stroke();}}
      else{vectorComplete=false;ctx.fillText(g.ch,0,0);}
      ctx.restore();
    }x+=g.width;}y+=lineHeight;}
  return{canvas,width,height,overflow:allGlyphs.some(g=>g.width>usable),vector:vectorComplete?vector.join('\n'):null,coverage:coverage(text,profile)};
}
