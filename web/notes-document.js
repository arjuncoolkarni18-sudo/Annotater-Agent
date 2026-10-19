import {PDFDocument,StandardFonts,rgb} from './assets/pdf-lib.js';
export async function createNotesDocument(plan){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),title=(plan.title||'New notes').replace(/[^\x20-\x7e\xa0-\xff]/g,' ').slice(0,85);
 for(let i=0;i<plan.pages;i++){const p=doc.addPage([612,792]);p.drawText(title,{x:36,y:754,size:Math.min(18,540/Math.max(1,bold.widthOfTextAtSize(title,1))),font:bold,color:rgb(.18,.23,.2)});p.drawText(`Notes / ${i+1}`,{x:36,y:22,size:8,font,color:rgb(.5,.5,.5)});
  if(plan.layout==='cornell'){const color=rgb(.65,.68,.65);p.drawLine({start:{x:166,y:142},end:{x:166,y:710},thickness:.6,color});p.drawLine({start:{x:36,y:142},end:{x:576,y:142},thickness:.6,color});for(const [text,x,y] of [[plan.language==='es'?'Preguntas / claves':'Cues / questions',42,716],[plan.language==='es'?'Notas':'Notes',182,716],[plan.language==='es'?'Resumen':'Summary',42,128]])p.drawText(text,{x,y,size:9,font:bold,color:rgb(.35,.4,.35)});}
 }return doc.save();
}
export async function imageWorksheet(data){const doc=await PDFDocument.create(),image=await doc.embedJpg(data),p=doc.addPage([612,792]),scale=Math.min(576/image.width,756/image.height),width=image.width*scale,height=image.height*scale;p.drawImage(image,{x:(612-width)/2,y:(792-height)/2,width,height});return doc.save();}
