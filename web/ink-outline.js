// Trace the outside and inside edges of the ink, never a replacement centerline.
// Coordinates remain vectors; the source is sampled at its native PDF render scale.
export function outlineInk(rgba,width,height){
 const level=new Float32Array(width*height);let ink=0;
 for(let i=0;i<level.length;i++){const j=i*4,r=rgba[j],g=rgba[j+1],b=rgba[j+2];level[i]=rgba[j+3]>100?165-(.2126*r+.7152*g+.0722*b):-90;if(level[i]>0)ink++;}
 if(ink<3)return null;
 // Subpixel marching squares follows the antialiased PDF ink edge. Thresholded
 // pixel rectangles would make even a vector export visibly stair-stepped.
 const vertices=new Map(),edges=new Map(),scale=150/Math.max(width,height),value=(x,y)=>x<0||y<0||x>=width||y>=height?-90:level[y*width+x];
 const connect=(a,b)=>{if(!edges.has(a))edges.set(a,[]);if(!edges.has(b))edges.set(b,[]);edges.get(a).push(b);edges.get(b).push(a);};
 const cases={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],11:[[2,1]],12:[[1,3]],13:[[1,0]],14:[[0,3]]};
 for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
  const v=[value(x,y),value(x+1,y),value(x+1,y+1),value(x,y+1)],code=v.reduce((n,z,i)=>n+(z>0?1<<i:0),0);if(!code||code===15)continue;
  const center=v.reduce((a,b)=>a+b,0)>0,pairs=code===5?(center?[[0,1],[2,3]]:[[3,0],[1,2]]):code===10?(center?[[3,0],[1,2]]:[[0,1],[2,3]]):cases[code];
  const endpoint=e=>{const keys=[`h${x},${y}`,`v${x+1},${y}`,`h${x},${y+1}`,`v${x},${y}`],key=keys[e];if(!vertices.has(key)){const ends=[[0,1],[1,2],[3,2],[0,3]][e],coords=[[x+.5,y+.5],[x+1.5,y+.5],[x+1.5,y+1.5],[x+.5,y+1.5]],a=ends[0],b=ends[1],t=v[a]/(v[a]-v[b]);vertices.set(key,[5+(coords[a][0]+t*(coords[b][0]-coords[a][0]))*scale,5+(coords[a][1]+t*(coords[b][1]-coords[a][1]))*scale]);}return key;};
  for(const [a,b] of pairs)connect(endpoint(a),endpoint(b));
 }
 const outlines=[];
 while(edges.size){const start=edges.keys().next().value,loop=[vertices.get(start)];let at=start,guard=0;
  do{const nexts=edges.get(at);if(!nexts?.length)throw Error('Ink contour could not be read.');const next=nexts.pop();if(!nexts.length)edges.delete(at);const back=edges.get(next);if(back){const i=back.indexOf(at);if(i>=0)back.splice(i,1);if(!back.length)edges.delete(next);}at=next;loop.push(vertices.get(at));if(++guard>width*height*4)throw Error('Ink contour is too complex.');}while(at!==start);
  if(loop.length<5)continue;const simple=reduceContour(loop,.025);if(simple.length>=4)outlines.push(simple);
 }
 if(outlines.length>256||outlines.reduce((n,p)=>n+p.length,0)>16000)throw Error('Too much detail in a sample box. Remove background marks and try again.');
 if(!outlines.length)return null;
 const strokes=outlines.slice(0,80).map(p=>[p[0]]);
 return{strokes,outlineData:encodeOutlines(outlines),inkVersion:2};
}
export function reduceContour(points,tolerance){
 // Iterative RDP, bounded to less than a fifth of a source pixel at 432 dpi.
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;let far=-1,best=tolerance*tolerance;
  for(let i=a+1;i<b;i++){const r=points[i],t=den?Math.max(0,Math.min(1,((r[0]-p[0])*dx+(r[1]-p[1])*dy)/den)):0,d=(r[0]-p[0]-t*dx)**2+(r[1]-p[1]-t*dy)**2;if(d>best){best=d;far=i;}}
  if(far>=0){keep[far]=1;stack.push([a,far],[far,b]);}}
 return points.filter((_,i)=>keep[i]).map(p=>p.map(v=>Math.round(v*1000)/1000));
}
export function paintOutline(ctx,sample,transform=p=>p){
 ctx.beginPath();for(const loop of getInkOutlines(sample)){loop.forEach((point,i)=>{const p=transform(point);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();}ctx.fill('evenodd');
}
export function outlinePdf(sample,metrics,x,y,rotation=0){
 const f=n=>Number(n.toFixed(4)),c=f(Math.cos(rotation)),s=f(Math.sin(rotation));
 const commands=[`q ${c} ${s} ${-s} ${c} ${f(x)} ${f(y)} cm`];
 for(const loop of getInkOutlines(sample)){loop.forEach((p,i)=>commands.push(`${f((p[0]-metrics.bounds.minX)*metrics.scaleX)} ${f((p[1]-metrics.bounds.minY)*metrics.scaleY+metrics.top)} ${i?'l':'m'}`));commands.push('h');}
 commands.push('f* Q');return commands.join('\n');
}

const outlineCache=new WeakMap();
export function encodeOutlines(outlines){
 const bytes=[],put=n=>{do{let b=n&127;n>>>=7;if(n)b|=128;bytes.push(b);}while(n);};
 put(outlines.length);
 for(const loop of outlines){put(loop.length);let x=0,y=0;for(const p of loop){const xx=Math.round(p[0]*128),yy=Math.round(p[1]*128);for(const d of [xx-x,yy-y])put((d<<1)^(d>>31));x=xx;y=yy;}}
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);
}
export function getInkOutlines(sample){
 if(Array.isArray(sample.outlines))return sample.outlines;
 if(!sample.outlineData)return null;if(outlineCache.has(sample))return outlineCache.get(sample);
 if(typeof sample.outlineData!=='string'||sample.outlineData.length>150000)throw Error('Invalid handwriting outline encoding.');
 let data;try{data=atob(sample.outlineData);}catch{throw Error('Invalid handwriting outline encoding.');}let pos=0,total=0;
 const get=()=>{let n=0;for(let i=0;i<5;i++){if(pos>=data.length)throw Error('Truncated handwriting outline.');const b=data.charCodeAt(pos++);n|=(b&127)<<(i*7);if(!(b&128))return n>>>0;}throw Error('Invalid handwriting outline integer.');};
 const count=get();if(count<1||count>256)throw Error('Invalid handwriting contour count.');const outlines=[];
 for(let l=0;l<count;l++){const n=get();if(n<4||(total+=n)>16000)throw Error('Invalid handwriting contour size.');let x=0,y=0;const loop=[];for(let i=0;i<n;i++){let d=get();x+=(d>>>1)^-(d&1);d=get();y+=(d>>>1)^-(d&1);if(x<0||y<0||x>20480||y>20480)throw Error('Invalid handwriting contour point.');loop.push([x/128,y/128]);}outlines.push(loop);}
 if(pos!==data.length)throw Error('Unexpected handwriting outline data.');outlineCache.set(sample,outlines);return outlines;
}
