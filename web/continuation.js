import {PDFDocument,StandardFonts,rgb} from './assets/pdf-lib.js';
import {fitTextBox} from './auto-fit.js';
export async function appendAnswerPages(sourceBytes,answers,{size=12,measure}){
 const doc=await PDFDocument.load(sourceBytes),font=await doc.embedFont(StandardFonts.Helvetica),placements=[];
 for(const answer of answers){let remaining=answer.answer.trim(),part=0;
  while(remaining){const page=doc.addPage([612,792]),number=doc.getPageCount();part++;
   page.drawText(`Additional answer / worksheet page ${answer.page}${part>1?' / continued':''}`,{x:36,y:754,size:11,font,color:rgb(.2,.24,.22)});
   const words=(answer.question||'Worksheet answer').replace(/[^\x20-\x7e]/g,' ').split(/\s+/),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>86)lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
   for(const [i,line] of lines.entries())page.drawText(line,{x:36,y:734-i*12,size:9,font,color:rgb(.35,.35,.35)});
   const y=76+lines.length*12,maxHeight=792-36-y,preferred=Math.min(12,size),fit=text=>fitTextBox({x:36,y,width:540,maxHeight,size:preferred,measure:(s,w)=>measure(text,s,w,answer)});
   let text=remaining,result=fit(text);
   if(!result){let low=1,high=remaining.length,best=0;while(low<=high){const mid=Math.floor((low+high)/2);if(fit(remaining.slice(0,mid))){best=mid;low=mid+1;}else high=mid-1;}if(!best)throw Error('This handwriting cannot fit readably on an additional page. Use a smaller profile scale.');let end=best;const breakAt=remaining.lastIndexOf(' ',best);if(breakAt>best*.7)end=breakAt;text=remaining.slice(0,end).trim();result=fit(text);}
   if(!result)throw Error('The continuation answer could not be fitted safely.');
   page.drawText(`Margin / additional notes / page ${number}`,{x:36,y:20,size:8,font,color:rgb(.45,.45,.45)});
   placements.push({answer,text,page:number,x:36,y,width:540,height:result.height,size:result.size,part});remaining=remaining.slice(text.length).trimStart();
  }
 }
 return{bytes:await doc.save(),placements};
}
