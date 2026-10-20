import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeOutlines} from '../web/ink-outline.js';
import {normalizedGlyphMetrics} from '../web/handwriting-metrics.js';
const glyph=(x,y,w,h)=>({strokes:[[[x,y],[x+w,y+h],[x+w/2,y+h/2]]]});
test('small and large drawings of the same letter normalize to the same height and baseline',()=>{
 for(const ch of 'AaBbCcDdpqgyj'){
  const small=normalizedGlyphMetrics(ch,glyph(70,80,10,15),16),large=normalizedGlyphMetrics(ch,glyph(10,10,80,120),16);
  assert.ok(Math.abs(small.inkHeight-large.inkHeight)<1e-9,ch);assert.ok(Math.abs(small.top-large.top)<1e-9,ch);assert.ok(Math.abs(small.width-large.width)<1e-9,ch);
 }
});
test('normalization retains the raw six-sample library and keeps natural letter proportions',()=>{
 const sample=glyph(10,20,40,80),before=structuredClone(sample),a=normalizedGlyphMetrics('a',sample,20),A=normalizedGlyphMetrics('A',sample,20),g=normalizedGlyphMetrics('g',sample,20);
 assert.ok(A.inkHeight>a.inkHeight);assert.ok(g.descent>0);assert.equal(a.descent,0);assert.deepEqual(sample,before);
});
test('imported variants align visible bottoms despite uneven template positions',()=>{
 for(const ch of 'aAbBmnpqgyj.,\''){
  const variants=[glyph(10,10,30,50),glyph(70,80,30,50)].map(s=>({...s,outlineData:encodeOutlines([s.strokes[0].concat([s.strokes[0][0]])]),sourceBaseline:100}));
  const metrics=variants.map(s=>normalizedGlyphMetrics(ch,s,16,55));
  assert.equal(metrics[0].top,metrics[1].top,ch);assert.equal(metrics[0].top+metrics[0].inkHeight,metrics[1].top+metrics[1].inkHeight,ch);
  if(/[aAbBmn]/.test(ch))assert.equal(metrics[0].top+metrics[0].inkHeight,0,ch);
  if(/[pqgyj]/.test(ch))assert.ok(metrics[0].descent>0,ch);
 }
});
