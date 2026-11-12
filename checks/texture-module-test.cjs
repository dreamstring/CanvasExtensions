const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={setProperty(){}};this.classList={toggle(){}};this.attributes={};this.listeners={};this.value='';}
 append(...nodes){for(const n of nodes){if(typeof n==='string')continue;this.children.push(n);n.parentElement=this;}}appendChild(n){this.append(n);return n;}
 replaceChildren(...n){this.children=[];this.append(...n);}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 get firstChild(){return this.children[0];}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];}addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(selector.split(',').includes(n.tagName)?[n]:[]),...(n.querySelectorAll?.(selector)||[])]);}
}
(async()=>{
 const folder=fs.mkdtempSync(path.join(path.resolve('checks'),'export-fixture-sdk-'));const owner={},backend=vm.runInNewContext(fs.readFileSync('runtime/native-export.cjs','utf8'),{Buffer})({fs,path,crypto,shell:{openPath:async()=>''},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[folder]})}});
 const body=new Element('body'),section={root:{isConnected:true},body,show(){},dispose(){}};let registered,closed=0;const calls=[],handlers=new Map(),timers=new Map();let timerId=0;
 const host={createSection:()=>section,nativeRequest:async(id,op,payload)=>{calls.push([id,op,payload.action]);return backend.handle(owner,id,op,payload);},register:(id,m)=>registered=m};
 const api={currentPage:{id:'page',selection:[{id:'a',width:63,height:65,exportAsync:async()=>fs.readFileSync('checks/export-source.png')}]},on:(e,fn)=>handlers.set(e,fn),off:e=>handlers.delete(e)};
 const context={console,Blob,Uint8Array,Map,Set,Promise,queueMicrotask,setTimeout,clearTimeout,setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),localStorage:{getItem:()=>JSON.stringify({directory:folder,middle:'sdk'}),setItem(){}},FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:image/png;base64,'+Buffer.from(bytes).toString('base64');this.onload();});}},createImageBitmap:async blob=>{const image=await loadImage(Buffer.from(await blob.arrayBuffer()));image.close=()=>closed++;return image;},document:{createTextNode:text=>({textContent:text}),createElementNS:(_,tag)=>new Element(tag),createElement:tag=>{if(tag!=='canvas')return new Element(tag);const canvas=createCanvas(1,1);canvas.toBlob=fn=>fn(new Blob([canvas.toBuffer('image/png')]));return canvas;}},figma:api,FigmaExtensions:host};context.window=context;vm.createContext(context);
 for(const file of ['runtime/services.js','runtime/editor-services.js','runtime/sdk.js','runtime/component-reference.js','runtime/component-kit.js','modules/texture-export/rules.js','modules/texture-export/main.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 await new Promise(r=>setImmediate(r));const result=await registered.commands.exportSelection();assert.equal(result.completed,1);assert.equal(result.error,'');
 const output=fs.readFileSync(path.join(folder,'T_UI_sdk_64x64_001.png'));assert.equal(output.readUInt32BE(16),64);assert.equal(output.readUInt32BE(20),64);assert.equal(api.currentPage.selection[0].width,63);assert.ok(closed>0);assert.equal(calls[0][2],'prepare');assert.equal(calls.at(-1)[2],'finish');
 const controls=body.querySelectorAll('input');assert.ok(controls.some(c=>c.getAttribute('aria-label')==='输出目录'),'module uses SDK directory field');
 registered.dispose();assert.equal(handlers.size,0);assert.equal(timers.size,0);
 console.log('PASS migrated texture module: real shared SDK, directory field, serial export session, real Skia resize/PNG, unchanged node and lifecycle cleanup');
})().catch(e=>{console.error(e);process.exit(1);});
