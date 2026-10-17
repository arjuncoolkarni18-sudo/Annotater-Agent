import {PDFDocument,PDFName,PDFDict,PDFArray,PDFHexString,PDFString,StandardFonts} from './assets/pdf-lib.js';
import {validateProfile,exportPlacement} from './core.js';
export const PROJECT_FILENAME='margin-project.json';
const named=PDFName.of;
export function serializeProject(annotations,settings,pageNumber){
 const libraries=new Map(),profiles={};
 const notes=annotations.map(note=>{const copy={...note};delete copy.profile;if(note.kind==='note'&&note.style==='hand'&&note.handwriting){const key=JSON.stringify(note.handwriting);let library=libraries.get(key);if(!library){library={id:`hand${libraries.size+1}`,profile:note.handwriting,characters:new Set()};libraries.set(key,library);}for(const char of note.text)library.characters.add(char);copy.handwritingProfileId=library.id;delete copy.handwriting;}return copy;});
 for(const library of libraries.values()){const samples={};for(const ch of library.characters)if(library.profile.samples[ch])samples[ch]=library.profile.samples[ch];profiles[library.id]={version:1,name:'Document handwriting',samples};}
 return{format:'margin-editable-pdf',version:1,annotations:notes,profiles,settings,pageNumber};
}
export function parseProject(bytes,pageCount){
 if(bytes.byteLength>8388608)throw Error('This editable project is too large to reopen.');
 const value=JSON.parse(new TextDecoder().decode(bytes));if(value?.format!=='margin-editable-pdf'||value.version!==1||!Array.isArray(value.annotations)||value.annotations.length>2000)throw Error('Invalid editable Margin project.');
 const profiles={};for(const [id,profile] of Object.entries(value.profiles||{})){if(Object.keys(profiles).length>=50)throw Error('Too many document handwriting profiles.');profiles[id]=validateProfile(profile);}
 const annotations=value.annotations.map(note=>{
  if(!note||!['note','highlight'].includes(note.kind)||typeof note.id!=='string'||note.id.length>100||!Number.isInteger(note.page)||note.page<1||note.page>pageCount||![note.x,note.y,note.width,note.height].every(Number.isFinite)||note.x<0||note.y<0||note.width<1||note.width>6000||note.height<1||note.height>6000)throw Error('An editable annotation is invalid.');
  const result={kind:note.kind,id:note.id,page:note.page,x:note.x,y:note.y,width:note.width,height:note.height};
  if(note.kind==='note'){
   if(typeof note.text!=='string'||note.text.length>1200||!['hand','digital'].includes(note.style)||!Number.isFinite(note.size)||note.size<8||note.size>36||!/^#[0-9a-f]{6}$/i.test(note.color)||!Number.isFinite(note.variation)||note.variation<0||note.variation>1||!Number.isFinite(note.seed))throw Error('The editable text style is invalid.');
   Object.assign(result,{text:note.text,style:note.style,size:note.size,color:note.color,variation:note.variation,seed:note.seed,fontFamily:['sans','serif','mono'].includes(note.fontFamily)?note.fontFamily:'sans',generated:note.generated===true,question:typeof note.question==='string'?note.question.slice(0,400):'',source:typeof note.source==='string'?note.source.slice(0,500):''});
   if(note.handwritingProfileId){if(!profiles[note.handwritingProfileId])throw Error('Document handwriting is missing.');result.handwriting=profiles[note.handwritingProfileId];}
  }return result;
 });
 const settings=value.settings||{};
 return{annotations,pageNumber:Number.isInteger(value.pageNumber)?Math.max(1,Math.min(pageCount,value.pageNumber)):1,settings:{style:['hand','digital'].includes(settings.style)?settings.style:'digital',size:Number.isFinite(settings.size)?Math.max(8,Math.min(36,settings.size)):12,color:/^#[0-9a-f]{6}$/i.test(settings.color)?settings.color:'#303a50',fontFamily:['sans','serif','mono'].includes(settings.fontFamily)?settings.fontFamily:'sans',variation:Number.isFinite(settings.variation)?Math.max(0,Math.min(1,settings.variation)):.15,noteWidth:Number.isFinite(settings.noteWidth)?Math.max(50,Math.min(2000,settings.noteWidth)):220}};
}
function annotationName(dict){const value=dict.get(named('NM'));return typeof value?.decodeText==='function'?value.decodeText():'';}
export async function removeProjectAnnotations(bytes,annotations){
 const doc=await PDFDocument.load(bytes),ids=new Set(annotations.map(note=>`margin:${note.id}`));
 for(const page of doc.getPages()){const annots=page.node.Annots();if(!annots)continue;for(let i=annots.size()-1;i>=0;i--){const dict=doc.context.lookup(annots.get(i));if(dict instanceof PDFDict&&ids.has(annotationName(dict)))annots.remove(i);}}
 removeProjectAttachment(doc);return doc.save();
}
function removeProjectAttachment(doc){
 const names=doc.catalog.lookupMaybe(named('Names'),PDFDict),files=names?.lookupMaybe(named('EmbeddedFiles'),PDFDict),entries=files?.lookupMaybe(named('Names'),PDFArray);
 if(entries)for(let i=entries.size()-2;i>=0;i-=2){const name=entries.lookup(i);if(typeof name?.decodeText==='function'&&name.decodeText()===PROJECT_FILENAME){const ref=entries.get(i+1),associated=doc.catalog.lookupMaybe(named('AF'),PDFArray);if(associated)for(let j=associated.size()-1;j>=0;j--)if(associated.get(j).toString()===ref.toString())associated.remove(j);entries.remove(i+1);entries.remove(i);}}
}
export async function exportEditablePdf({sourceBytes,annotations,settings,pageNumber,getViewport,renderImage}){
 const doc=await PDFDocument.load(sourceBytes),font=await doc.embedFont(StandardFonts.Helvetica),normalized=[];
 for(const original of annotations){const note={...original},page=doc.getPages()[note.page-1],viewport=await getViewport(note.page);let image;
  if(note.kind==='note'){const rendered=await renderImage(note);note.height=rendered.height;image=await doc.embedPng(rendered.data);}
  const p=exportPlacement(viewport,note.x,note.y,note.width,note.height),r=p.angle*Math.PI/180,c=Math.round(Math.cos(r)),s=Math.round(Math.sin(r));
  const corners=[[0,0],[p.width,0],[0,p.height],[p.width,p.height]].map(([x,y])=>[p.x+c*x-s*y,p.y+s*x+c*y]),xs=corners.map(v=>v[0]),ys=corners.map(v=>v[1]),rect=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  const color=note.kind==='note'?[1,3,5].map(i=>parseInt(note.color.slice(i,i+2),16)/255):[.95,.81,.25];
  const resources=note.kind==='note'?{XObject:{Ink:image.ref},Font:{Helv:font.ref}}:{ExtGState:{InkState:doc.context.obj({Type:'ExtGState',ca:.28,BM:'Multiply'})}};
  const content=note.kind==='note'?`q\n${p.width} 0 0 ${p.height} 0 0 cm\n/Ink Do\nQ`:`q\n/InkState gs\n${color.join(' ')} rg\n0 0 ${p.width} ${p.height} re f\nQ`;
  const appearance=doc.context.register(doc.context.flateStream(content,{Type:'XObject',Subtype:'Form',FormType:1,BBox:[0,0,p.width,p.height],Matrix:[c,s,-s,c,0,0],Resources:resources}));
  const dict=doc.context.obj({Type:'Annot',Subtype:note.kind==='note'?'FreeText':'Highlight',Rect:rect,NM:PDFHexString.fromText(`margin:${note.id}`),T:PDFHexString.fromText('Margin'),M:PDFString.fromDate(new Date()),F:4,AP:{N:appearance},C:color,Border:[0,0,0],BS:{W:0},...(note.kind==='note'?{Contents:PDFHexString.fromText(note.text),DA:PDFString.of(`/Helv ${note.size} Tf ${color.join(' ')} rg`),Q:0}:{CA:.28,QuadPoints:[...corners[2],...corners[3],...corners[0],...corners[1]]})});
  page.node.addAnnot(doc.context.register(dict));normalized.push(note);
 }
 removeProjectAttachment(doc);const metadata=new TextEncoder().encode(JSON.stringify(serializeProject(normalized,settings,pageNumber)));if(metadata.length>8388608)throw Error('This editable project is too large. Use fewer text boxes in one document.');
 await doc.attach(metadata,PROJECT_FILENAME,{mimeType:'application/json',description:'Editable Margin notes, layout settings, and document handwriting samples',creationDate:new Date()});
 return doc.save();
}
