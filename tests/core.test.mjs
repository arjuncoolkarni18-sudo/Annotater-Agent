import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSample,randomGenerator,simplify,validateProfile,profileStats,coverage,placeInBounds,exportPlacement} from '../web/core.js';

const sample={strokes:[[[40,50],[80,114],[110,50]]]};
test('handwriting uses all six versions and avoids immediately repeating a letter variant',()=>{
 const samples=Array.from({length:6},()=>structuredClone(sample)),rng=randomGenerator(2181),seen=new Set();let previous=-1;
 for(let i=0;i<200;i++){const next=chooseSample(samples,rng,previous);assert.notEqual(next,previous);seen.add(next);previous=next;}assert.equal(seen.size,6);
});
test('partial character libraries use available slots or a clear fallback',()=>{assert.equal(chooseSample([],()=>.9),-1);assert.equal(chooseSample([null,sample,null],()=>.4,1),1);});
test('a handwriting backup round-trips and counts complete characters',()=>{const profile=validateProfile({version:1,name:'My hand',samples:{a:Array(6).fill(sample),b:[sample]}});assert.equal(profileStats(profile).completed,1);assert.equal(profileStats(profile).count,7);assert.deepEqual(coverage('a b x',profile),{total:3,covered:2,missing:['x']});assert.equal(validateProfile(JSON.parse(JSON.stringify(profile))).name,'My hand');});
test('malformed handwriting data cannot enter the profile',()=>{for(const v of [{},null,{version:1,name:'x',samples:{a:[{strokes:[[[Infinity,0]]]}]}},{version:1,name:'x',samples:{a:[{strokes:[[[0,-1]]]}]}}])assert.throws(()=>validateProfile(v));});
test('wording simplification preserves named details, numbers, negation and paragraphs',()=>{
 const input='It is important to note that Wilson did not utilize 200 bonds in order to obtain food.\nFurthermore, women had the ability to work.';
 assert.equal(simplify(input),'Wilson did not use 200 bonds to get food.\nAlso, women could work.');
 assert.equal(simplify('The draft began in 1917.'),'The draft began in 1917.');
});
test('notes remain on the page when placed or dragged near an edge',()=>{assert.deepEqual(placeInBounds(500,-8,220,80,540,710),{x:320,y:0});});
test('export coordinates preserve correct placement at all four PDF rotations',()=>{
 const cases=[
  {convertToPdfPoint:(x,y)=>[x,710-y],expected:{x:30,y:620,width:120,height:50,angle:0}},
  {convertToPdfPoint:(x,y)=>[y,x],expected:{x:90,y:30,width:120,height:50,angle:90}},
  {convertToPdfPoint:(x,y)=>[540-x,y],expected:{x:510,y:90,width:120,height:50,angle:180}},
  {convertToPdfPoint:(x,y)=>[540-y,710-x],expected:{x:450,y:680,width:120,height:50,angle:-90}},
 ];for(const c of cases)assert.deepEqual(exportPlacement(c,30,40,120,50),c.expected);
});
