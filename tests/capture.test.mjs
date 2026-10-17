import test from 'node:test';
import assert from 'node:assert/strict';
import {capturePoint,replaceCaptureSample,nextCaptureCharacter} from '../lib/capture-state.mjs';
import {validateProfile,profileStats} from '../web/core.js';
const sample=n=>({strokes:[[[20,30],[40+n,110]]]});
test('stylus positions stay consistent across CSS sizes and clamp to the 160-point sample format',()=>{
 assert.deepEqual(capturePoint(90,100,{left:10,top:20,width:160,height:160}),[80,80]);assert.deepEqual(capturePoint(170,180,{left:10,top:20,width:320,height:320}),[80,80]);assert.deepEqual(capturePoint(-5,500,{left:0,top:0,width:160,height:160}),[0,160]);assert.throws(()=>capturePoint(1,1,{left:0,top:0,width:0,height:0}));
});
test('capture saves six distinct variants and exports a backup accepted by Margin without shifting empty slots',()=>{
 let profile={version:1,name:'Stylus',samples:{b:[sample(5)]}};const previous=structuredClone(profile);for(let i=0;i<6;i++)profile=replaceCaptureSample(profile,'a',i,sample(i));assert.deepEqual(previous.samples,{b:[sample(5)]});assert.equal(profileStats(profile).completed,1);assert.equal(profileStats(profile).count,7);
 profile=replaceCaptureSample(profile,'a',2,null);const imported=validateProfile(JSON.parse(JSON.stringify(profile)));assert.equal(imported.samples.a.length,6);assert.equal(imported.samples.a[2],null);assert.deepEqual(imported.samples.a[5],sample(5));assert.deepEqual(imported.samples.b[0],sample(5));assert.throws(()=>replaceCaptureSample(profile,'a',6,sample(1)));assert.throws(()=>replaceCaptureSample(profile,'invalid',0,sample(1)));
});
test('Next skips completed characters and wraps to the next incomplete character',()=>{
 const profile={version:1,name:'',samples:{a:Array.from({length:6},(_,i)=>sample(i)),b:Array.from({length:6},(_,i)=>sample(i))}};assert.equal(nextCaptureCharacter(profile,'a','abc'),'c');assert.equal(nextCaptureCharacter(profile,'c','abc'),'c');
});
