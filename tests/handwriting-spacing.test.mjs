import test from 'node:test';import assert from 'node:assert/strict';import {renderNote} from '../web/handwriting.js';
test('handwriting reserves a visible half-em word gap, recognizes Unicode spaces and wraps full words',()=>{
 const previous=globalThis.document;const positions=[];const ctx={font:'',measureText:()=>({width:8}),scale(){},save(){},restore(){},translate(x,y){positions.push([x,y]);},rotate(){},fillText(){}};globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{const options={size:16,width:200,variation:1};renderNote('a a',options);const gap=positions[1][0]-positions[0][0];assert.equal(gap,8+.32+8);assert.equal(positions[0][1],positions[1][1]);positions.length=0;renderNote('a\u00a0a',options);assert.equal(positions[1][0]-positions[0][0],gap);positions.length=0;renderNote('aa aa',{...options,width:36});assert.equal(positions[0][1],positions[1][1]);assert.ok(positions[2][1]>positions[1][1]);assert.equal(positions[2][0],5);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
