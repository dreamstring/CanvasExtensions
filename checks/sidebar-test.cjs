const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('modules/gif/sidebar.js','utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(anchorPresent=true){
 class Element{
  children=[];style={};dataset={};attributes={};textContent='';parentElement=null;
  constructor(tag){this.tag=tag;}
  append(...nodes){for(const n of nodes){n.remove();this.children.push(n);n.parentElement=this;}}
  remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
  after(n){n.remove();const p=this.parentElement;p.children.splice(p.children.indexOf(this)+1,0,n);n.parentElement=p;}
  contains(n){return this===n||this.children.some(c=>c.contains(n));}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}
  attachShadow(){return this.shadowRoot=new Element('#shadow-root');}
  addEventListener(){}matches(){return false;}
  get isConnected(){return body.contains(this);}get previousElementSibling(){if(!this.parentElement)return null;const a=this.parentElement.children;return a[a.indexOf(this)-1]||null;}
  querySelectorAll(selector){const result=[];const visit=n=>{for(const c of n.children){if(selector.split(',').map(t=>t.trim()).includes(c.tag))result.push(c);visit(c);}};visit(this);return result;}
 }
 const body=new Element('body'),side=new Element('aside'),stack=new Element('div'),effects=new Element('section'),effectsLabel=new Element('span'),section=new Element('section'),header=new Element('div'),exportButton=new Element('button');
 effectsLabel.textContent='Effects';exportButton.textContent=anchorPresent?'Export':'Unknown';body.append(side);side.append(stack);stack.append(effects,section);effects.append(effectsLabel);section.append(header);header.append(exportButton);
 let stops=0,scans=0,disposes=0,disconnects=0;const handlers=new Map(),timers=new Map();
 const engine={hasImageSelection:()=>true,gifCount:1,status:{loading:false,running:false,gifs:0,visible:0,skipped:0,errors:[]},async inspectSelection(){return{gifCount:this.gifCount};},selectedPlayingCount(){return this.status.running?1:0;},isLive:()=>true,async scan(){scans++;this.status.running=true;},stopSelected(){stops++;this.status.running=false;},reset(){stops++;this.status.running=false;},dispose(){disposes++;}};
 const context={document:{body,createElement:tag=>new Element(tag),querySelector:()=>side},MutationObserver:class{observe(){}disconnect(){disconnects++;}},queueMicrotask,setInterval:fn=>{timers.set(1,fn);return 1;},clearInterval:id=>timers.delete(id),figma:{currentPage:{id:'page',selection:[{id:'a'}]},on:(event,fn)=>handlers.set(event,fn),off:event=>handlers.delete(event)},FigmaCanvasGif:engine};context.window=context;vm.runInNewContext(source,context);
 return{context,engine,handlers,timers,section,header,stack,Element,getCounts:()=>({stops,scans,disposes,disconnects})};
}
(async()=>{
 const a=setup();await flush();assert.equal(a.context.FigmaAssistant.status().sidebarMounted,true);
 const panel=a.stack.children[2];assert.equal(panel.previousElementSibling,a.section,'panel follows the WHOLE Export section');assert.equal(a.section.contains(panel),false);
 a.context.figma.currentPage.selection=['a','b','c','d'].map(id=>({id}));a.engine.gifCount=3;a.timers.get(1)();await flush();
 assert.equal(a.context.FigmaAssistant.status().selectedGifs,3,'poll catches a missed selection event');
 const counts=panel.shadowRoot.children[1].children[1].children.map(x=>x.textContent);assert.equal(counts[0],'4 selected');assert.equal(counts[1],'3 GIF');assert.ok(counts.every(x=>!x.includes('·')),'counts have no dot separator');
 const expanded=new a.Element('div');expanded.textContent='Export options';a.section.append(expanded);assert.equal(panel.previousElementSibling,a.section,'expanded Export does not overlap module');
 await a.context.FigmaAssistant.command('gif','previewSelection');a.handlers.get('selectionchange')();await flush();assert.equal(a.engine.status.running,true,'selection switch preserves animation');
 a.engine.gifCount=0;a.handlers.get('selectionchange')();await flush();assert.equal(a.context.FigmaAssistant.status().sidebarMounted,false,'empty/non-GIF selection hides module');assert.equal(a.engine.status.running,true,'hidden module does not stop other GIFs');
 a.engine.gifCount=1;a.handlers.get('selectionchange')();await flush();assert.equal(a.context.FigmaAssistant.status().sidebarMounted,true);
 await a.context.FigmaAssistant.command('gif','stop');assert.equal(a.getCounts().stops,1,'Stop dispatches selected-only action');
 let oldResolve;a.engine.inspectSelection=()=>new Promise(resolve=>oldResolve=resolve);a.handlers.get('selectionchange')();a.engine.inspectSelection=async()=>({gifCount:0});a.handlers.get('selectionchange')();await flush();oldResolve({gifCount:1});await flush();assert.equal(a.context.FigmaAssistant.status().sidebarMounted,false,'late detection cannot resurrect stale selection');
 await a.context.FigmaAssistant.command('gif','previewSelection');a.handlers.get('currentpagechange')();assert.equal(a.engine.status.running,false,'page switch resets playback');
 await assert.rejects(()=>a.context.FigmaAssistant.command('gif','toString'),/Unsupported/);a.context.FigmaAssistant.dispose();assert.equal(a.handlers.size,0);assert.equal(a.timers.size,0);assert.equal(a.getCounts().disposes,1);assert.equal(a.getCounts().disconnects,1);
 const b=setup(false);await flush();assert.equal(b.context.FigmaAssistant.status().sidebarMounted,false,'unknown Export anchor fails closed');b.context.FigmaAssistant.dispose();
 const c=setup();await flush();let finishSlow;
 c.engine.inspectSelection=()=>new Promise(resolve=>finishSlow=resolve);c.handlers.get('selectionchange')();
 assert.equal(c.context.FigmaAssistant.status().sidebarMounted,true,'panel is mounted before slow image bytes resolve');assert.equal(c.context.FigmaAssistant.status().inspecting,true);
 const slowPanel=c.stack.children[2],slowBody=slowPanel.shadowRoot.children[1];assert.equal(slowBody.children[0].children[0].disabled,true,'Preview disabled during recognition');assert.match(slowBody.children[1].children[3].textContent,/正在识别/);
 finishSlow({gifCount:2});await flush();assert.equal(c.context.FigmaAssistant.status().inspecting,false);assert.equal(slowBody.children[0].children[0].disabled,false);
 c.engine.inspectSelection=()=>new Promise(resolve=>finishSlow=resolve);c.handlers.get('selectionchange')();c.engine.hasImageSelection=()=>false;c.context.figma.currentPage.selection=[];c.handlers.get('selectionchange')();finishSlow({gifCount:2});await flush();assert.equal(c.context.FigmaAssistant.status().sidebarMounted,false,'cancel selection hides pending panel and ignores late results');c.context.FigmaAssistant.dispose();
 console.log('PASS sidebar: whole Export boundary, expansion, GIF selection gating, persistence, selected Stop, async race, cleanup');
})();
