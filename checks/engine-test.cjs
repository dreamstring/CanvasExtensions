const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('modules/gif/engine.js', 'utf8');
function setup() {
  const revoked = [], elements = [], callbacks = new Map(); let urlId = 0, rafId = 0;
  class Element {
    style = {}; dataset = {}; children = []; attrs = {}; removed = false;
    clientWidth = 1000; clientHeight = 800; offsetLeft = 0; offsetTop = 0;
    constructor(type) { this.type = type; elements.push(this); }
    appendChild(el) { this.children.push(el); el.parentElement = this; return el; }
    append(...els) { els.forEach(el => this.appendChild(el)); }
    replaceChildren() { this.children = []; }
    setAttribute(k,v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    srcWrites = 0;
    get src() { return this.attrs.src || ''; } set src(value) { this.attrs.src = value; this.srcWrites++; }
    addEventListener() {} removeEventListener() {}
    getBoundingClientRect() { return { x: 0, y: 0, width: 1000, height: 800 }; }
    remove() { this.removed = true; }
  }
  const host = new Element('host'), canvas = new Element('canvas'); host.appendChild(canvas);
  const page = Object.freeze({ id: 'page', type: 'PAGE' });
  const nodes = ['gif1','png','gif2'].map((hash,i) => Object.freeze({ id: String(i), type: 'RECTANGLE',
    visible: true, opacity: 1, blendMode: 'NORMAL', parent: page, width: 100, height: 50,
    absoluteTransform: [[1,0,150],[0,1,250]], absoluteBoundingBox: {x:150,y:250,width:100,height:50},
    fills: Object.freeze([Object.freeze({type:'IMAGE',imageHash:hash,scaleMode:'FILL',visible:true})]) }));
  const gif = Uint8Array.from([71,73,70,56,57,97]);
  const context = {console:{log(){}}, Uint8Array, Set, Map, Blob,
    URL:{createObjectURL(){return 'blob:'+(++urlId)},revokeObjectURL(u){revoked.push(u)}},
    performance:{now:()=>1000}, requestAnimationFrame(fn){callbacks.set(++rafId,fn);return rafId;},
    cancelAnimationFrame(id){callbacks.delete(id)},
    document:{querySelectorAll:()=>[canvas],createElement:type=>new Element(type)},
    figma:{currentPage:{id:'page',selection:nodes},viewport:{bounds:{x:100,y:200,width:1000,height:800},zoom:1},
      getImageByHash:h=>({getBytesAsync:async()=>h==='png'?Uint8Array.from([137,80,78,71]):gif})},
    addEventListener(){},removeEventListener(){} };
  context.window=context; vm.runInNewContext(source,context);
  return {context,elements,callbacks,revoked,nodes};
}
(async()=>{
  const a=setup(), before=JSON.stringify(a.nodes);
  await a.context.FigmaCanvasGif.scan();
  assert.equal(a.context.FigmaCanvasGif.status.gifs,2,'PNG must not be mounted as GIF');
  assert.equal(a.context.FigmaCanvasGif.status.visible,2);
  assert.ok(a.elements.some(e=>e.style.transform==='matrix(1,0,0,1,50,50)'),'viewport mapping');
  assert.ok(a.elements.filter(e=>e.type==='img').every(e=>e.style.pointerEvents==='none'),'click through');
  a.context.FigmaCanvasGif.stop();
  assert.ok(a.elements.filter(e=>e.type==='img').every(e=>!e.src),'stop releases image decoders');
  assert.equal(a.callbacks.size,0);
  a.context.FigmaCanvasGif.play(); assert.equal(a.context.FigmaCanvasGif.status.running,true);
  a.context.FigmaCanvasGif.dispose(); assert.equal(a.revoked.length,2);
  assert.equal(JSON.stringify(a.nodes),before,'design nodes stay unchanged');

  const b=setup();let finish;
  b.context.figma.getImageByHash=()=>({getBytesAsync:()=>new Promise(r=>{finish=r})});
  const pending=b.context.FigmaCanvasGif.scan(); b.context.FigmaCanvasGif.dispose();
  finish(Uint8Array.from([71,73,70,56,57,97]));await pending;
  assert.equal(b.context.FigmaCanvasGif.status.running,false);
  assert.equal(b.callbacks.size,0,'dispose cancels async mounting');
  const c=setup();c.context.figma.currentPage.selection=[c.nodes[0]];
  await c.context.FigmaCanvasGif.scan();assert.equal(c.context.FigmaCanvasGif.status.gifs,1,'only selection is scanned');c.context.FigmaCanvasGif.dispose();
  const d=setup();let release;d.context.figma.getImageByHash=()=>({getBytesAsync:()=>new Promise(r=>release=r)});
  const loading=d.context.FigmaCanvasGif.scan();d.context.FigmaCanvasGif.stop();release(Uint8Array.from([71,73,70,56,57,97]));await loading;
  assert.equal(d.context.FigmaCanvasGif.status.gifs,0,'stop cancels pending scan');assert.equal(d.context.FigmaCanvasGif.status.running,false);d.context.FigmaCanvasGif.dispose();
  const e=setup();e.context.figma.currentPage.selection=[e.nodes[0]];
  await e.context.FigmaCanvasGif.scan();const imageA=e.elements.find(x=>x.type==='img');const sourceA=imageA.src;
  e.context.figma.currentPage.selection=[e.nodes[2]];await e.context.FigmaCanvasGif.scan();
  assert.equal(e.context.FigmaCanvasGif.status.gifs,2,'adding B retains A');assert.equal(imageA.src,sourceA);assert.equal(imageA.srcWrites,1,'A decoder is never restarted while B is added');
  e.context.FigmaCanvasGif.stopSelected();assert.equal(e.context.FigmaCanvasGif.status.gifs,1,'Stop B removes only B');assert.equal(imageA.src,sourceA);assert.equal(e.context.FigmaCanvasGif.status.running,true);
  e.context.figma.currentPage.selection=[e.nodes[0]];await e.context.FigmaCanvasGif.scan();assert.equal(e.context.FigmaCanvasGif.status.gifs,1,'Preview A twice is idempotent');assert.equal(imageA.srcWrites,1);
  e.context.FigmaCanvasGif.stopSelected();assert.equal(e.context.FigmaCanvasGif.status.gifs,0);assert.equal(e.context.FigmaCanvasGif.status.running,false);assert.equal(e.revoked.length,2,'selected Stop revokes selected image URLs');e.context.FigmaCanvasGif.dispose();
  const f=setup();f.context.figma.currentPage.selection=[f.nodes[0]];await f.context.FigmaCanvasGif.scan();
  f.context.figma.currentPage.selection=[f.nodes[2]];let resolveB;f.context.figma.getImageByHash=()=>({getBytesAsync:()=>new Promise(r=>resolveB=r)});
  const pendingB=f.context.FigmaCanvasGif.scan();f.context.FigmaCanvasGif.stopSelected();resolveB(Uint8Array.from([71,73,70,56,57,97]));await pendingB;
  assert.equal(f.context.FigmaCanvasGif.status.gifs,1,'Stop cancels selected pending B without stopping A');assert.equal(f.context.FigmaCanvasGif.status.running,true);f.context.FigmaCanvasGif.reset();assert.equal(f.context.FigmaCanvasGif.status.gifs,0,'page reset clears everything');f.context.FigmaCanvasGif.dispose();
  const g=setup();let reads=0;const getImage=g.context.figma.getImageByHash;
  g.context.figma.getImageByHash=h=>{reads++;return getImage(h)};
  assert.equal((await g.context.FigmaCanvasGif.inspectSelection()).gifCount,2);
  await g.context.FigmaCanvasGif.inspectSelection();assert.equal(reads,3,'signature checks are cached');
  g.context.figma.currentPage.selection=[g.nodes[1]];assert.equal((await g.context.FigmaCanvasGif.inspectSelection()).gifCount,0,'PNG hides controls');
  g.context.figma.currentPage.selection=[];assert.equal((await g.context.FigmaCanvasGif.inspectSelection()).gifCount,0,'empty selection hides controls');
  g.context.figma.currentPage.selection=[{id:'group',children:[g.nodes[0],g.nodes[2]]}];assert.equal((await g.context.FigmaCanvasGif.inspectSelection()).gifCount,2,'group descendants are inspected');
  assert.equal(g.context.FigmaCanvasGif.status.gifs,0,'inspection never starts playback');g.context.FigmaCanvasGif.dispose();
  const h=setup();h.context.figma.currentPage.selection=[{...h.nodes[0],fills:[h.nodes[0].fills[0],h.nodes[2].fills[0]]}];
  assert.equal((await h.context.FigmaCanvasGif.inspectSelection()).gifCount,1,'multiple GIF fills count as one GIF object');
  await h.context.FigmaCanvasGif.scan();assert.equal(h.context.FigmaCanvasGif.selectedPlayingCount(),1,'playing count uses distinct objects');h.context.FigmaCanvasGif.stop();assert.equal(h.context.FigmaCanvasGif.selectedPlayingCount(),0);h.context.FigmaCanvasGif.dispose();
  const parallel=setup();parallel.context.figma.currentPage.selection=Array.from({length:8},(_,i)=>({...parallel.nodes[0],id:'p'+i,fills:[{...parallel.nodes[0].fills[0],imageHash:'parallel'+i}]}));
  let active=0,maxActive=0,readsStarted=0;const releases=[];
  parallel.context.figma.getImageByHash=()=>({getBytesAsync:()=>{active++;readsStarted++;maxActive=Math.max(maxActive,active);return new Promise(resolve=>releases.push(()=>{active--;resolve(Uint8Array.from([71,73,70,56,57,97]));}));}});
  const recognizing=parallel.context.FigmaCanvasGif.inspectSelection();await new Promise(r=>setImmediate(r));assert.equal(readsStarted,4,'recognition reads begin concurrently');
  for(let i=0;i<8;i++){await new Promise(r=>setImmediate(r));releases.shift()();}
  assert.equal((await recognizing).gifCount,8);assert.equal(maxActive,4,'recognition concurrency is bounded');assert.equal(parallel.context.FigmaCanvasGif.status.gifs,0,'parallel recognition does not mount decoders');parallel.context.FigmaCanvasGif.dispose();
  console.log('PASS: bounded parallel recognition, signature selection/cache, additive playback, selected Stop, viewport mapping, cleanup, unchanged design nodes');
})();

