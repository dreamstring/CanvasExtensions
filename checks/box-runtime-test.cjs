const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{constructor(){this.style={};this.children=[];this.value='';this.listeners={};}append(...v){this.children.push(...v);}setAttribute(){} addEventListener(type,fn){this.listeners[type]=fn;} removeEventListener(type){delete this.listeners[type];} getRootNode(){return this;} }
(async()=>{
 const data={},original={type:'IMAGE',imageHash:'source',scaleMode:'TILE',opacity:.8};
 const node={id:'one',width:100,height:80,fills:[original,{type:'SOLID'}],getSharedPluginData:(namespace,k)=>data[namespace+':'+k]||'',setSharedPluginData:(namespace,k,v)=>data[namespace+':'+k]=v,getPluginData(){throw Error('private plugin data requires manifest ID');}};
 let registered,interval,pickerOptions,now=1000,hash=0,draws=0,undo=0,canvases=0;
 const section={body:new Element(),root:{isConnected:true,style:{}},show(){},dispose(){}};
 const api={currentPage:{selection:[node]},createImage:()=>({hash:'generated'+(++hash)}),getImageByHash:()=>({getBytesAsync:async()=>new Uint8Array([1])}),commitUndo:()=>undo++};
 const host={sdk:{panel:()=>section,scope:()=>({on(){},listen(target,event,fn){target.addEventListener(event,fn);},interval:fn=>interval=fn,add(){},dispose(){}})},register:(id,mod)=>registered=mod};
 const context={Blob,Uint8Array,console,CanvasBoxPicker:{create:options=>{pickerOptions=options;return {update(){},dispose(){}};}},createImageBitmap:async()=>({width:32,height:32,close(){}}),queueMicrotask,Date:{now:()=>now},addEventListener(){},removeEventListener(){},document:{addEventListener(){},removeEventListener(){},createElement:tag=>tag==='canvas'?{style:{},preview:++canvases===1,getContext(){const isPreview=this.preview;return {scale(){},drawImage(){if(!isPreview)draws++;}};},toBlob:cb=>cb(new Blob(['png']))}:new Element()},figma:api,FigmaExtensions:host};context.window=context;context.setTimeout=setTimeout;context.clearTimeout=clearTimeout;vm.createContext(context);vm.runInContext(fs.readFileSync("runtime/services.js","utf8"),context);vm.runInContext(fs.readFileSync("runtime/editor-services.js","utf8"),context);host.sdk.services=context.CanvasExtensionServices;vm.runInContext(fs.readFileSync("runtime/component-kit.js","utf8"),context);host.sdk.components=host.componentKit;
 for(const name of ['rules','renderer','main'])vm.runInContext(fs.readFileSync('modules/box/'+name+'.js','utf8'),context);
 await registered.commands.apply();assert.equal(node.fills[0].imageHash,'generated1');assert.equal(node.fills[1].type,'SOLID');assert.equal(draws,9);assert.equal(undo,1);
 assert.equal(node.fills.length,3);assert.equal(node.fills[2].imageHash,'source');assert.equal(node.fills[2].visible,false,'a native hidden paint keeps the source asset referenced');
 node.width=200;await interval();assert.equal(node.fills[0].imageHash,'generated2');assert.equal(draws,18);
 registered.commands.restore();assert.equal(node.fills[0].imageHash,'source');assert.equal(node.fills[0].scaleMode,'TILE');assert.equal(node.fills[0].opacity,.8);
 assert.equal(node.fills.length,2,'restore removes only the untouched retained source paint');
 // Choosing Box automatically applies once; rapid inputs coalesce into one write.
 const count=hash;pickerOptions.onChoose();await interval();assert.equal(hash,count);now+=121;await interval();assert.equal(hash,count+1);
 const grid=section.body.children.find(el=>el.className==='grid'),left=grid.children[0].children[1];
 assert.equal(left.type,'text','decimal text input avoids native browser spin buttons');
 let stopped=false,prevented=false;section.body.listeners.keydown({stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});assert(stopped);assert(!prevented,'editor shortcuts are isolated without cancelling text insertion');
 left.value='12';left.oninput();left.value='16';left.oninput();section.body.activeElement=left;now+=121;await interval();assert.equal(hash,count+1,'typing must not trigger a document write that can destroy focus');section.body.activeElement=null;left.onblur();await interval();assert.equal(hash,count+2);assert.equal(JSON.parse(data['canvasExtensions:box']).margins.left,16);
 const unit=section.body.children[1];unit.value='pixels';unit.onchange();now+=121;await interval();assert.equal(hash,count+3);assert.equal(JSON.parse(data['canvasExtensions:box']).unit,'pixels');assert.equal(JSON.parse(data['canvasExtensions:box']).margins.left,5.12);
 // Switching away before the debounce expires cancels the pending write.
 left.value='8';left.oninput();pickerOptions.onNativeMode();now+=121;await interval();assert.equal(hash,count+3);assert.equal(node.fills[0].imageHash,'source');
 await registered.commands.apply();node.fills=[{...node.fills[0],imageHash:'external'},node.fills[1]];assert.throws(()=>registered.commands.restore(),/已被修改/);registered.dispose();
 console.log('PASS Box runtime mock: apply, resize, other paints preserved, restore, external edit protection');
})().catch(e=>{console.error(e);process.exit(1);});
