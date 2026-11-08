/* Canvas Extensions SDK 1.0. Plain local modules, no framework dependency. */
(() => {
 'use strict';
 const host=window.FigmaExtensions;
 function settings(id,defaults,key='canvasExtensions.'+id){
  let value={...defaults};try{value={...value,...JSON.parse(localStorage.getItem(key)||'{}')};}catch(_){}
  return {value,save(){localStorage.setItem(key,JSON.stringify(value));},set(name,next){value[name]=next;this.save();}};
 }
 function scope(api=window.figma){
  const cleanups=[];let disposed=false;
  return {add(fn){if(disposed)fn();else cleanups.push(fn);return fn;},on(event,fn){api.on?.(event,fn);this.add(()=>api.off?.(event,fn));},interval(fn,ms){const timer=setInterval(fn,ms);this.add(()=>clearInterval(timer));return timer;},dispose(){if(disposed)return;disposed=true;for(const fn of cleanups.reverse())try{fn();}catch(_){}},get disposed(){return disposed;}};
 }
 function panel(id,options){return host.createSection(id,options.title,options);}
 function define(spec){
  const id=spec.id,api=window.figma,life=scope(api),store=settings(id,spec.defaults||{},spec.storageKey),section=panel(id,spec.panel),controls=new Map();
  const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}.row{display:grid;grid-template-columns:repeat(var(--columns,1),minmax(0,1fr));gap:8px;margin-bottom:12px}label{display:flex;flex-direction:column;gap:6px;color:var(--color-text-secondary,#aaa);font:11px Inter,Segoe UI,sans-serif}input,select,button{font:12px Inter,Segoe UI,sans-serif;color:var(--color-text,#fff);height:28px;min-width:0;width:100%;border:1px solid transparent;border-radius:5px;background:var(--color-bg-secondary,#383838);padding:0 8px}input:focus,select:focus{outline:1px solid var(--color-border-selected,#0d99ff)}input[type=checkbox]{width:14px;height:14px;accent-color:var(--color-bg-brand,#0d99ff)}label.check{flex-direction:row;align-items:center}button{cursor:pointer;background:transparent;border-color:var(--color-border,#444)}button:hover{background:var(--color-bg-hover,#383838)}button:disabled,input:disabled,select:disabled,label.disabled{opacity:.4}button:focus-visible{outline:2px solid var(--color-border-selected,#0d99ff)}`;section.body.append(style);
  const ctx={id,api,state:store.value,settings:store,scope:life,section,controls,native:(operation,payload)=>host.nativeRequest(id,operation,payload),selection:()=>[...api.currentPage.selection],refresh};
  function enabled(field){return typeof field.enabled==='function'?field.enabled(ctx):field.enabled!==false;}
  for(const rowSpec of spec.panel.rows||[]){const row=document.createElement('div');row.className='row';row.style.setProperty('--columns',rowSpec.length);section.body.append(row);
   for(const field of rowSpec){const wrap=document.createElement('label');wrap.textContent=field.label||'';let control;
    if(field.type==='button'){control=document.createElement('button');control.textContent=field.label;wrap.textContent='';control.onclick=async()=>{control.disabled=true;try{await field.onClick?.(ctx);}catch(error){status.textContent=String(error.message||error);}finally{refresh();}};}
    else if(field.type==='select'){control=document.createElement('select');for(const option of field.options||[]){const el=document.createElement('option');el.value=option.value;el.textContent=option.label;control.append(el);}}
    else {control=document.createElement('input');control.type=field.type==='checkbox'?'checkbox':field.type==='slider'?'range':field.type==='number'?'number':'text';if(field.min!=null)control.min=field.min;if(field.max!=null)control.max=field.max;if(field.step!=null)control.step=field.step;if(field.placeholder)control.placeholder=field.placeholder;}
    if(field.type==='checkbox')wrap.className='check';wrap.append(control);row.append(wrap);controls.set(field.key,{control,wrap,field});
    if(field.type!=='button'){const change=()=>{store.set(field.key,field.type==='checkbox'?control.checked:['number','slider'].includes(field.type)?Number(control.value):control.value);field.onChange?.(ctx);spec.onChange?.(ctx,field.key);refresh();};control.addEventListener(field.type==='select'||field.type==='checkbox'?'change':'input',change);}
   }
  }
  const status=document.createElement('div');status.setAttribute('role','status');status.style.cssText='font:11px Inter,Segoe UI,sans-serif;color:var(--color-text-secondary,#aaa)';section.body.append(status);ctx.status=text=>status.textContent=text;
  function refresh(){if(life.disposed)return;for(const {control,wrap,field} of controls.values()){control.disabled=!enabled(field);wrap.classList.toggle('disabled',control.disabled);if(field.type==='checkbox')control.checked=!!store.value[field.key];else if(field.type!=='button')control.value=store.value[field.key]??'';}section.show(spec.panel.visible?!!spec.panel.visible(ctx):ctx.selection().length>0);spec.onRefresh?.(ctx);}
  life.on('selectionchange',refresh);life.on('currentpagechange',refresh);life.add(()=>section.dispose());
  host.register(id,{commands:Object.fromEntries(Object.entries(spec.commands||{}).map(([name,fn])=>[name,()=>fn(ctx)])),status:()=>({sidebarMounted:section.root.isConnected,...spec.status?.(ctx)}),dispose(){spec.dispose?.(ctx);life.dispose();}});
  spec.setup?.(ctx);refresh();return ctx;
 }
 const capabilities={
  inspect(api=window.figma){
   const selection=api?.currentPage?.selection,nodes=selection?[...selection]:[];
   return {
    'selection.read':{available:!!selection,evidence:'runtime-shape'},
    'events.selection':{available:typeof api?.on==='function'&&typeof api?.off==='function',evidence:'runtime-shape'},
    'viewport.read':{available:!!api?.viewport?.bounds&&Number.isFinite(api?.viewport?.zoom),evidence:'runtime-shape'},
    'images.read':{available:typeof api?.getImageByHash==='function',evidence:'runtime-shape'},
    'nodes.export.png':{available:nodes.length?nodes.every(n=>typeof n.exportAsync==='function'):null,evidence:nodes.length?'runtime-shape':'needs-selection'},
    'fonts.load':{available:typeof api?.loadFontAsync==='function',evidence:'runtime-shape-only'},
    'history.commit':{available:typeof api?.commitUndo==='function',evidence:'runtime-shape-only'}
   };
  },
  require(name,api=window.figma){const entry=this.inspect(api)[name];if(!entry||entry.available!==true)throw Error('当前环境尚不可用或未验证所需能力：'+name);},
  selection(api=window.figma){this.require('selection.read',api);return [...api.currentPage.selection];},
  viewport(api=window.figma){this.require('viewport.read',api);return {bounds:{...api.viewport.bounds},zoom:api.viewport.zoom};},
  async imageBytes(hash,api=window.figma){this.require('images.read',api);const image=api.getImageByHash(hash);if(!image)throw Error('图片不存在');return await image.getBytesAsync();},
  async exportPng(node){if(typeof node?.exportAsync!=='function')throw Error('对象不支持 PNG 导出');return await node.exportAsync({format:'PNG',constraint:{type:'SCALE',value:1}});},
  local(id){return Object.freeze({chooseFolder:directory=>host.nativeRequest(id,'choose-export-folder',{directory}),openFolder:directory=>host.nativeRequest(id,'open-export-folder',{directory})});}
 };
 host.sdk=Object.freeze({version:'2.0',compose:spec=>host.componentKit.compose(spec),ui:host.ui,settings,scope,panel,define,capabilities:Object.freeze(capabilities)});
})();
