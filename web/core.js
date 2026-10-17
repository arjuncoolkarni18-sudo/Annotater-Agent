export const GROUPS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789.,!?;:\'"-()/%&',
};
export const CHARACTERS = [...Object.values(GROUPS).join('')];
export function simplify(text) {
  const replacements = [
    [/\bin order to\b/gi,'to'],[/\bdue to the fact that\b/gi,'because'],
    [/\bin spite of the fact that\b/gi,'although'],[/\bat this point in time\b/gi,'now'],
    [/\bit is (?:important|essential) to (?:note|understand) that\s*/gi,''],
    [/\bit (?:can be|should be) (?:noted|said|argued) that\s*/gi,''],
    [/\bin the event that\b/gi,'if'],[/\bfor the purpose of\b/gi,'for'],
    [/\ba large number of\b/gi,'many'],[/\ba majority of\b/gi,'most'],
    [/\ba small number of\b/gi,'a few'],[/\bhas the ability to\b/gi,'can'],
    [/\bhave the ability to\b/gi,'can'],[/\bprior to\b/gi,'before'],
    [/\bhad the ability to\b/gi,'could'],
    [/\bsubsequent to\b/gi,'after'],[/\bwith regard to\b/gi,'about'],
    [/\butiliz(?:e|es|ing|ed)\b/gi,m=>({utilize:'use',utilizes:'uses',utilizing:'using',utilized:'used'}[m.toLowerCase()])],
    [/\bapproximately\b/gi,'about'],[/\bnumerous\b/gi,'many'],
    [/\bnevertheless\b/gi,'still'],[/\bconsequently\b/gi,'as a result'],
    [/\bfurthermore\b/gi,'also'],[/\bmoreover\b/gi,'also'],
    [/\bcommence\b/gi,'start'],[/\bdemonstrates\b/gi,'shows'],
    [/\bfacilitate\b/gi,'help'],[/\bobtain\b/gi,'get'],
  ];
  let output=text.trim();
  for(const [pattern,replacement] of replacements) output=output.replace(pattern,replacement);
  return output.replace(/[ \t]+/g,' ').replace(/(^|[.!?]\s+)([a-z])/g,(_,a,b)=>a+b.toUpperCase());
}
export function hashSeed(text){let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
export function randomGenerator(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function chooseSample(samples, random, previous=-1){
  const available=samples.map((v,i)=>v?.strokes?.length?i:-1).filter(i=>i>=0);
  if(!available.length)return -1;
  const options=available.length>1?available.filter(i=>i!==previous):available;
  return options[Math.min(options.length-1,Math.floor(random()*options.length))];
}
export function glyphBounds(sample){
  const bounds={minX:160,maxX:0,minY:160,maxY:0};
  for(const stroke of sample.strokes)for(const [x,y] of stroke){bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);}
  return bounds;
}
export function validateProfile(value){
  if(!value||value.version!==1||typeof value.name!=='string'||!value.samples||typeof value.samples!=='object')throw Error('This is not a Margin handwriting backup.');
  const profile={version:1,name:value.name.slice(0,40),samples:{}};
  for(const ch of CHARACTERS){
    if(!Array.isArray(value.samples[ch]))continue;
    profile.samples[ch]=value.samples[ch].slice(0,6).map(sample=>{
      if(sample==null)return null;
      if(!Array.isArray(sample.strokes)||sample.strokes.length>80)throw Error('A handwriting sample is invalid.');
      const strokes=sample.strokes.map(stroke=>{
        if(!Array.isArray(stroke)||stroke.length>3000)throw Error('A handwriting stroke is invalid.');
        return stroke.map(point=>{
          if(!Array.isArray(point)||point.length!==2||point.some(v=>!Number.isFinite(v)||v<0||v>160))throw Error('A handwriting point is invalid.');
          return point;
        });
      }).filter(s=>s.length);
      return strokes.length?{strokes}:null;
    });
  }
  return profile;
}
export function profileStats(profile){let completed=0,started=0,count=0;for(const ch of CHARACTERS){const n=(profile.samples[ch]||[]).filter(s=>s?.strokes?.length).length;count+=n;if(n)started++;if(n===6)completed++;}return{completed,started,count,total:CHARACTERS.length};}
export function coverage(text,profile){const chars=[...text].filter(ch=>!(/\s/.test(ch)));const total=chars.length;const covered=chars.filter(ch=>(profile.samples[ch]||[]).some(s=>s?.strokes?.length)).length;return{total,covered,missing:[...new Set(chars.filter(ch=>!(profile.samples[ch]||[]).some(s=>s?.strokes?.length)))]};}
export function placeInBounds(x,y,w,h,pageW,pageH){return{x:Math.max(0,Math.min(x,pageW-w)),y:Math.max(0,Math.min(y,pageH-h))};}
export function exportPlacement(viewport,x,y,w,h){const p=viewport.convertToPdfPoint(x,y+h),right=viewport.convertToPdfPoint(x+1,y+h);return{x:p[0],y:p[1],width:w*Math.hypot(right[0]-p[0],right[1]-p[1]),height:h*Math.hypot(right[0]-p[0],right[1]-p[1]),angle:Math.atan2(right[1]-p[1],right[0]-p[0])*180/Math.PI};}
