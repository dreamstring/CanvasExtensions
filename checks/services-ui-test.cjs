const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={setProperty(){}};this.attributes={};this.classList={toggle(){}};this.listeners={};this.value='';}
 append(...nodes){for(const node of nodes){this.children.push(node);node.parentElement=this;}}attachShadow(){return this.shadowRoot=new Element('shadow');}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}get firstChild(){return this.children[0];}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];}addEventListener(e,f){this.listeners[e]=f;}removeEventListener(e){delete this.listeners[e];}
}
(async()=>{
 const host={createSection:()=>({root:{isConnected:true},body:new Element('body'),show(){},dispose(){}}),register:(id,m)=>modules.set(id,m),nativeRequest:async(id,op,payload)=>({directory:'chosen',cancelled:false})};
 const modules=new Map(),handlers=new Map(),values=new Map();let urls=0,revoked=0;
 const api={currentPage:{id:'page',selection:[{id:'one',fills:[{type:'IMAGE',imageHash:'gif'}]}]},on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);},getImageByHash:()=>({getBytesAsync:async()=>new Uint8Array([71,73,70,56,57,97])})};
 const c={console,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,Blob,Uint8Array,URL:{createObjectURL:()=>String(++urls),revokeObjectURL:()=>revoked++},figma:api,FigmaExtensions:host,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},document:{createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text})}};c.window=c;vm.createContext(c);
 for(const file of ['runtime/services.js','runtime/editor-services.js','runtime/sdk.js','runtime/component-reference.js','runtime/component-kit.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const ctx=host.sdk.compose({id:'controls',defaults:{enabled:false,directory:'',image:''},panel:{title:'Controls',content:[{type:'checkbox',key:'enabled',label:'Enabled'},{type:'path',key:'directory',label:'Directory',enabled:ctx=>ctx.state.enabled},{type:'imagePreview',key:'image-preview',source:ctx=>ctx.state.image}]}});
 const directory=ctx.controls.get('directory'),row=directory.wrapper.children[1],button=row.children[1];assert.equal(directory.control.disabled,true);assert.equal(button.disabled,true);
 ctx.state.enabled=true;ctx.refresh();await button.onclick();assert.equal(ctx.state.directory,'chosen');assert.equal(JSON.parse(values.get('canvasExtensions.controls')).directory,'chosen');
 const image=ctx.controls.get('image-preview').control;assert.equal(image.hidden,true);ctx.state.image='data:image/png;base64,example';ctx.refresh();assert.equal(image.getAttribute('src'),ctx.state.image);ctx.state.image='';ctx.refresh();assert.equal(image.getAttribute('src'),undefined);
 const life=host.sdk.scope(api);let fired=false;life.timeout(()=>fired=true,20);life.url(new Blob(['fixture']));life.dispose();await new Promise(r=>setTimeout(r,30));assert.equal(fired,false);assert.equal(revoked,1);ctx.scope.dispose();
 let chooseDone,updates=0;const field=host.sdk.components.directoryField({choose:()=>new Promise(r=>chooseDone=r),onChange:()=>updates++});const choosing=field.button.onclick();field.dispose();chooseDone({directory:'late'});await choosing;assert.equal(updates,0,'late native dialog cannot update disposed UI');
 vm.runInContext(fs.readFileSync('templates/services-example/main.js','utf8'),c);const example=modules.get('services-example');await example.commands.inspect();example.dispose();assert.ok([...handlers.values()].every(set=>set.size===0));
 console.log('PASS SDK components/reserve APIs: declared directory and preview, disabled linkage, persistence, disposed dialog, timer/URL cleanup and executable services template');
})().catch(e=>{console.error(e);process.exit(1);});
