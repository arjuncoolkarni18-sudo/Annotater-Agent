import test from 'node:test';
import {validateProfile} from '../web/core.js';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFDict,PDFArray,decodePDFRawStream,degrees} from '../web/assets/pdf-lib.js';
import {exportEditablePdf,parseProject,serializeProject,removeProjectAnnotations} from '../web/pdf-project.js';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
const sample={strokes:[[[20,20],[80,100]]]};
const note={kind:'note',id:'one',page:1,x:40,y:60,width:180,height:45,text:'A clear idea.',style:'hand',size:16,color:'#303a50',variation:.2,seed:22,handwriting:{version:1,name:'Private profile',samples:{A:[sample,sample],z:[sample]}}};
const settings={style:'hand',size:16,color:'#303a50',fontFamily:'sans',variation:.2,noteWidth:180};
function embedded(doc){const entries=doc.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);const spec=doc.context.lookup(entries.get(1),PDFDict),stream=spec.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'));return{bytes:decodePDFRawStream(stream).decode(),entries};}
test('editable PDF keeps real annotation objects, text, appearance and reopenable project data',async()=>{
 const source=await PDFDocument.create(),page=source.addPage([612,792]);page.drawText('Original worksheet');page.node.addAnnot(source.context.register(source.context.obj({Type:'Annot',Subtype:'Text',Rect:[10,10,20,20],NM:'original-note',Contents:'Existing note'})));
 const bytes=await exportEditablePdf({sourceBytes:await source.save(),annotations:[note,{kind:'highlight',id:'two',page:1,x:30,y:90,width:80,height:15}],settings,pageNumber:1,getViewport:async()=>({convertToPdfPoint:(x,y)=>[x,792-y]}),renderImage:async()=>({data:png,height:45})});
 const doc=await PDFDocument.load(bytes),annots=doc.getPages()[0].node.Annots();assert.equal(annots.size(),3);
 const text=doc.context.lookup(annots.get(1),PDFDict);assert.equal(text.lookup(PDFName.of('Subtype')).toString(),'/FreeText');assert.equal(text.lookup(PDFName.of('Contents')).decodeText(),note.text);assert.ok(text.lookup(PDFName.of('AP'),PDFDict).get(PDFName.of('N')));
 const project=parseProject(embedded(doc).bytes,1);assert.equal(project.annotations[0].text,note.text);assert.deepEqual(project.annotations[0].handwriting.samples.A,note.handwriting.samples.A);assert.equal(project.annotations[0].handwriting.samples.z,undefined);
 const cleaned=await PDFDocument.load(await removeProjectAnnotations(bytes,project.annotations));assert.equal(cleaned.getPages()[0].node.Annots().size(),1);assert.equal(cleaned.context.lookup(cleaned.getPages()[0].node.Annots().get(0),PDFDict).lookup(PDFName.of('Contents')).decodeText(),'Existing note');
 const revised=project.annotations.map(n=>n.kind==='note'?{...n,text:'A revised thought.',x:100}:n);
 const second=await PDFDocument.load(await exportEditablePdf({sourceBytes:await cleaned.save(),annotations:revised,settings,pageNumber:1,getViewport:async()=>({convertToPdfPoint:(x,y)=>[x,792-y]}),renderImage:async()=>({data:png,height:45})}));
 assert.equal(second.getPages()[0].node.Annots().size(),3);assert.equal(embedded(second).entries.size(),2);assert.equal(parseProject(embedded(second).bytes,1).annotations[0].text,'A revised thought.');
});
test('project import validates styles and page references before making text boxes',()=>{
 const value=serializeProject([note],settings,1);assert.equal(parseProject(new TextEncoder().encode(JSON.stringify(value)),1).annotations.length,1);
 const invalid=structuredClone(value);invalid.annotations[0].page=20;assert.throws(()=>parseProject(new TextEncoder().encode(JSON.stringify(invalid)),1));
 invalid.annotations[0].page=1;invalid.annotations[0].size=-4;assert.throws(()=>parseProject(new TextEncoder().encode(JSON.stringify(invalid)),1));
});
test('outline handwriting exports as filled PDF paths and reopens with all contour data',async()=>{
 const shape={strokes:[[[10,10],[20,10],[20,30],[10,30],[10,10]]],outlines:[[[10,10],[20,10],[20,30],[10,30],[10,10]]],inkVersion:2};
 const source=await PDFDocument.create();source.addPage([612,792]);const n={...note,text:'A',handwriting:{version:1,name:'Ink',samples:{A:Array(6).fill(shape)}}};
 const data=await exportEditablePdf({sourceBytes:await source.save(),annotations:[n],settings,pageNumber:1,getViewport:async()=>({convertToPdfPoint:(x,y)=>[x,792-y]}),renderImage:async()=>({height:45,vector:'q 0 0 m 10 0 l 10 20 l 0 20 l h f* Q'})});
 const doc=await PDFDocument.load(data),a=doc.context.lookup(doc.getPages()[0].node.Annots().get(0),PDFDict),appearance=a.lookup(PDFName.of('AP'),PDFDict).lookup(PDFName.of('N'));
 const content=new TextDecoder().decode(decodePDFRawStream(appearance).decode());assert.match(content,/f\*/);assert.doesNotMatch(content,/\/Ink Do/);assert.equal(appearance.dict.lookup(PDFName.of('Resources'),PDFDict).get(PDFName.of('XObject')),undefined);assert.deepEqual(parseProject(embedded(doc).bytes,1).annotations[0].handwriting.samples.A,validateProfile(n.handwriting).samples.A);
});
