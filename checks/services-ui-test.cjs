const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={setProperty(){}};this.attributes={};this.classList={toggle(){}};this.listeners={};this.value='';}
 append(...nodes){for(const node of nodes){this.children.push(node);node.parentElement=this;}}attachShadow(){return this.shadowRoot=new Element('shadow');}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}get firstChild(){return this.children[0];}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];}addEventListener(e,f){this.listeners[e]=f;}removeEventListener(e){delete this.listeners[e];}
}
(async()=>{
 const host={createSection:()=>({root:{isConnected:true},body:new Element('body'),show(){},dispose(){}}),register:(id,m)=>modules.set(id,m),nativeRequest:async(id,op,payload)=>({directory:'chosen',cancelled:false})};
 const modules=new Map(),handlers=new Map(),values=new Map();let urls=0,revoked=0,writes=0;
 const api={currentPage:{id:'page',selection:[{id:'one',fills:[{type:'IMAGE',imageHash:'gif'}]}]},on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);},getImageByHash:()=>({getBytesAsync:async()=>new Uint8Array([71,73,70,56,57,97])})};
 const c={console,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,Blob,Uint8Array,URL:{createObjectURL:()=>String(++urls),revokeObjectURL:()=>revoked++},figma:api,FigmaExtensions:host,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>{writes++;values.set(k,v);}},document:{createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text})}};c.window=c;vm.createContext(c);
 for(const file of ['runtime/services.js','runtime/editor-services.js','runtime/ui-model.js','runtime/ui-targets.js','runtime/sdk.js','runtime/component-reference.js','runtime/component-kit.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const ctx=host.sdk.compose({id:'controls',defaults:{enabled:false,directory:'',image:''},panel:{title:'Controls',content:[{type:'checkbox',key:'enabled',label:'Enabled'},{type:'path',key:'directory',label:'Directory',enabled:ctx=>ctx.state.enabled},{type:'imagePreview',key:'image-preview',source:ctx=>ctx.state.image}]}});
 const directory=ctx.controls.get('directory'),row=directory.wrapper.children[1],button=row.children[1];assert.equal(directory.control.disabled,true);assert.equal(button.disabled,true);
 ctx.state.enabled=true;ctx.refresh();await button.onclick();assert.equal(ctx.state.directory,'chosen');assert.equal(JSON.parse(values.get('canvasExtensions.controls')).directory,'chosen');
 const image=ctx.controls.get('image-preview').control;assert.equal(image.hidden,true);ctx.state.image='data:image/png;base64,example';ctx.refresh();assert.equal(image.getAttribute('src'),ctx.state.image);ctx.state.image='';ctx.refresh();assert.equal(image.getAttribute('src'),undefined);
 let sync,disconnected=false,target=null;
 c.MutationObserver=class{constructor(fn){sync=fn;}observe(){}disconnect(){disconnected=true;}};
 const panel=host.sdk.compose({id:'linked',defaults:{manual:false,scale:100},panel:{target:()=>target,content:[
  {type:'checkbox',key:'manual'},{type:'slider',key:'scale',enabled:ctx=>ctx.state.manual},
  {type:'label',text:ctx=>ctx.state.scale+'%'}]}});
 target=new Element('popup');sync();assert.equal(target.firstChild,panel.section.root);
 const manual=panel.controls.get('manual').control,slider=panel.controls.get('scale').control;
 const label=[...panel.controls.values()].find(binding=>binding.node.type==='label').control;
 assert.equal(slider.disabled,true);manual.checked=true;manual.listeners.change();assert.equal(slider.disabled,false);
 slider.value='75';slider.listeners.input();assert.equal(label.textContent,'75%');
 target=null;sync();target=new Element('replacement');sync();assert.equal(target.firstChild,panel.section.root);
 const beforePatch=writes;
 panel.patch({manual:false,scale:100});
 assert.equal(writes,beforePatch+1,'batch persists both fields in one write');
 assert.deepEqual(JSON.parse(values.get('canvasExtensions.linked')),{manual:false,scale:100});
 assert.equal(manual.checked,false);assert.equal(Number(slider.value),100);
 assert.equal(slider.disabled,true);assert.equal(label.textContent,'100%');
 panel.scope.dispose();assert.ok(disconnected);assert.equal(target.children.length,0);
 panel.patch({scale:50});assert.equal(writes,beforePatch+1,'disposed callbacks cannot persist a patch');
 disconnected=false;let failedDisposals=0;
 assert.throws(()=>host.sdk.compose({id:'broken-panel',panel:{target:()=>target,content:[]},
  setup(){throw Error('setup failed');},dispose(){failedDisposals++;}}),/setup failed/);
 assert.equal(target.children.length,0);assert.equal(disconnected,true);
 assert.equal(modules.has('broken-panel'),false);assert.equal(failedDisposals,1);
 let nativeInstalls=0;
 host.ui={install(shadow){assert.equal(shadow.tagName,'shadow');nativeInstalls++;return ()=>nativeInstalls--;}};
 const amountField=()=>({type:'rangeField',key:'amount',label:'Amount',unit:'%',min:0,max:100,step:1});
 const grouped=host.sdk.compose({id:'grouped',defaults:{manual:false,show:true,amount:50},
  panel:{nativeStyle:true,content:[{type:'group',title:'Settings',visible:ctx=>ctx.state.show,
   enabled:ctx=>ctx.state.manual,children:[amountField]}]}});
 const amount=grouped.controls.get('amount'),group=amount.wrapper.parentElement;
 assert.equal(nativeInstalls,1);assert.equal(amount.number.disabled,true);assert.equal(amount.control.disabled,true);
 grouped.model.patch({manual:true});
 assert.equal(amount.number.disabled,false);
 const seen=[];grouped.model.subscribe(s=>s.amount,value=>seen.push(value));
 amount.number.value='';amount.number.listeners.input();grouped.refresh();assert.equal(amount.number.value,'');
 amount.number.listeners.blur();assert.equal(Number(amount.number.value),50);assert.deepEqual(seen,[]);
 amount.number.value='82';amount.number.listeners.input();
 amount.number.listeners.keydown({key:'Enter',preventDefault(){}});assert.equal(grouped.state.amount,82);
 amount.number.value='90';amount.number.listeners.input();
 amount.number.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(Number(amount.number.value),82);
 amount.control.value='74';amount.control.listeners.input();assert.equal(Number(amount.number.value),74);
 grouped.patch({show:false});assert.equal(group.hidden,true);assert.equal(amount.control.disabled,true);
 grouped.settings.set('amount',60);assert.equal(Number(amount.control.value),60);
 assert.deepEqual(seen,[82,74,60]);grouped.scope.dispose();assert.equal(nativeInstalls,0);
 assert.throws(()=>host.sdk.compose({id:'typo',panel:{content:[{type:'slidr',key:'width'}]}}),/Unknown panel control type "slidr" for width/);
 assert.equal(modules.has('typo'),false);
 const implicit=host.sdk.compose({id:'implicit',panel:{content:[{key:'title'}]}});
 assert.equal(implicit.controls.get('title').control.type,'text');implicit.scope.dispose();
 const presetPanel=host.sdk.compose({id:'presets',defaults:{fast:false,width:64},panel:{content:[
  {type:'checkbox',key:'fast',onChange:(ctx,fast)=>ctx.patch({width:fast?32:64})}]}});
 const presetHistory=[];presetPanel.model.subscribe(s=>s.fast+':'+s.width,v=>presetHistory.push(v));
 const preset=presetPanel.controls.get('fast').control,beforePreset=writes;
 preset.checked=true;preset.listeners.change();
 assert.equal(writes,beforePreset+1);assert.deepEqual(presetHistory,['true:32']);
 presetPanel.scope.dispose();
 let customCleanups=0,childScope=null;
 const custom=host.sdk.compose({id:'custom-controls',defaults:{locked:true,show:true},
  panel:{content:[{type:'group',enabled:ctx=>!ctx.state.locked,visible:ctx=>ctx.state.show,children:[
   {type:'custom',key:'gallery',label:'Gallery',mount(container,ctx,life){
    childScope=life;life.add(()=>customCleanups++);container.append(new Element('canvas'));ctx.status('ready');
    return ()=>customCleanups++;
   }}]}]}});
 const gallery=custom.controls.get('gallery').control;
 assert.equal(gallery.inert,true);assert.equal(gallery.firstChild.tagName,'canvas');
 custom.patch({locked:false});assert.equal(gallery.inert,false);
 custom.patch({show:false});assert.equal(gallery.inert,true);assert.equal(gallery.parentElement.parentElement.hidden,true);
 custom.scope.dispose();custom.scope.dispose();assert.equal(customCleanups,2);assert.equal(childScope.disposed,true);
 assert.throws(()=>host.sdk.compose({id:'bad-custom',panel:{content:[{type:'custom',key:'bad',mount(container,ctx,life){
  life.add(()=>customCleanups++);throw Error('widget failed');
 }}]}}),/widget failed/);
 assert.equal(customCleanups,3);assert.equal(modules.has('bad-custom'),false);
 const life=host.sdk.scope(api);let fired=false;life.timeout(()=>fired=true,20);life.url(new Blob(['fixture']));life.dispose();await new Promise(r=>setTimeout(r,30));assert.equal(fired,false);assert.equal(revoked,1);ctx.scope.dispose();
 let chooseDone,updates=0;const field=host.sdk.components.directoryField({choose:()=>new Promise(r=>chooseDone=r),onChange:()=>updates++});const choosing=field.button.onclick();field.dispose();chooseDone({directory:'late'});await choosing;assert.equal(updates,0,'late native dialog cannot update disposed UI');
 vm.runInContext(fs.readFileSync('templates/services-example/main.js','utf8'),c);const example=modules.get('services-example');await example.commands.inspect();example.dispose();assert.ok([...handlers.values()].every(set=>set.size===0));
 console.log('PASS SDK components/reserve APIs: declared directory and preview, disabled linkage, persistence, disposed dialog, timer/URL cleanup and executable services template');
})().catch(e=>{console.error(e);process.exit(1);});
