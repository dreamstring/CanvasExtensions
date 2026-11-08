const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{constructor(){this.children=[];this.style={setProperty(){}};this.classList={toggle(){}};this.events={};}append(...nodes){this.children.push(...nodes);}setAttribute(){}addEventListener(event,fn){this.events[event]=fn;}}
const values=new Map(),listeners=new Map();let registered,shown,disposed=0;
const host={createSection(){return {body:new Element(),root:{isConnected:true},show(v){shown=v;},dispose(){disposed++;}};},register(id,m){registered=m;}};
const context={window:{FigmaExtensions:host,figma:{currentPage:{selection:[{id:'1'}]},on(e,f){listeners.set(e,f);},off(e){listeners.delete(e);}}},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},document:{createElement:()=>new Element()},setInterval,clearInterval};
vm.createContext(context);vm.runInContext(fs.readFileSync('runtime/sdk.js','utf8'),context);
vm.runInContext(fs.readFileSync('templates/sdk-example/main.js','utf8'),context);
assert.equal(shown,true);assert.equal(listeners.size,2);
// Capture a second panel so test can inspect its fields through the public context.
const ctx=host.sdk.define({id:'fixture',defaults:{enabled:false,width:64},panel:{title:'Fixture',rows:[[{key:'enabled',type:'checkbox'}],[{key:'width',type:'number',enabled:c=>c.state.enabled}]]}});
assert.equal(ctx.controls.get('width').control.disabled,true);
const toggle=ctx.controls.get('enabled').control;toggle.checked=true;toggle.events.change();assert.equal(ctx.controls.get('width').control.disabled,false);assert.equal(JSON.parse(values.get('canvasExtensions.fixture')).enabled,true);
ctx.scope.dispose();ctx.scope.dispose();assert.equal(disposed,1);assert.equal(listeners.size,0);
assert.equal(host.sdk.settings('fixture',{}).value.enabled,true);
console.log('PASS SDK: declarative controls, checkbox-dependent enable state, persisted settings, selection lifecycle and idempotent cleanup');

assert.equal(host.sdk.capabilities.inspect()['selection.read'].available,true);assert.equal(host.sdk.capabilities.inspect()['nodes.export.png'].available,false);context.window.figma.currentPage.selection=[];assert.equal(host.sdk.capabilities.inspect()['nodes.export.png'].available,null);assert.throws(()=>host.sdk.capabilities.require('unknown'));assert.throws(()=>host.sdk.capabilities.require('fonts.load'));
