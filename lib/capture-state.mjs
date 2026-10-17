import {CHARACTERS,validateProfile} from '../web/core.js';
export function capturePoint(x,y,rect){
 if(!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)throw Error('The drawing area is not ready.');
 return[Math.max(0,Math.min(160,(x-rect.left)*160/rect.width)),Math.max(0,Math.min(160,(y-rect.top)*160/rect.height))].map(v=>Math.round(v*100)/100);
}
export function replaceCaptureSample(profile,char,slot,sample){
 if(!CHARACTERS.includes(char)||!Number.isInteger(slot)||slot<0||slot>=6)throw Error('Choose a valid character and sample slot.');
 const next={version:1,name:profile.name,samples:{...profile.samples,[char]:Array.from({length:6},(_,i)=>profile.samples[char]?.[i]||null)}};
 next.samples[char][slot]=sample;return validateProfile(next);
}
export function nextCaptureCharacter(profile,current,characters){
 const start=characters.indexOf(current);for(let offset=1;offset<=characters.length;offset++){const ch=characters[(start+offset)%characters.length];if((profile.samples[ch]||[]).filter(s=>s?.strokes?.length).length<6)return ch;}
 return characters[(start+1)%characters.length];
}
