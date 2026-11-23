/* Composable controls. Native tokens/icon geometry are source-bound; behavior is ours. */
(() => {
 'use strict';
 const host=window.FigmaExtensions,reference=host.componentReference;
 function icon(name){const data=reference?.icons[name];if(!data)throw Error('Unknown SDK icon: '+name);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',data.viewBox);svg.setAttribute('width',String(data.width||24));svg.setAttribute('height',String(data.height||24));svg.setAttribute('aria-hidden','true');svg.style.flex='none';for(const item of data.paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',item.d);path.setAttribute('fill',item.fill?.replace('var(--color-icon)','var(--color-icon,currentColor)')||'none');if(item.stroke)path.setAttribute('stroke',item.stroke);if(item.strokeWidth)path.setAttribute('stroke-width',item.strokeWidth);svg.append(path);}return svg;}
 const css=`
 :host{font-family:var(--text-body-medium-font-family,Inter,Segoe UI,sans-serif);font-size:var(--text-body-medium-font-size,11px);font-weight:var(--text-body-medium-font-weight,450);color:var(--color-text,#fff)}
 [hidden]{display:none!important}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button{cursor:pointer}button:disabled,input:disabled,select:disabled{cursor:default;color:var(--color-text-disabled,#777)}
 .row{display:grid;grid-template-columns:repeat(var(--columns,2),minmax(0,1fr));gap:8px}.column{display:flex;flex-direction:column;gap:12px}.label{font-size:var(--text-body-small-font-size,9px);line-height:16px;color:var(--color-text-secondary,#b3b3b3)}.field{display:flex;flex-direction:column;gap:4px;min-width:0}.field.disabled>.label{color:var(--color-text-disabled,#777)}
 .input,.select,.button{height:var(--spacer-4,24px);border-radius:var(--radius-medium,5px);min-width:0;width:100%}.input,.select{padding:0 8px;border:0;outline:1px solid transparent;outline-offset:-1px;background-color:var(--color-bg-secondary,#383838)}.input:hover:not(:disabled),.select:hover:not(:disabled){outline-color:var(--color-border,#444)}.input:focus,.select:focus{outline-color:var(--color-border-selected,#0d99ff)}.input:disabled,.select:disabled{background-color:var(--color-bg,#2c2c2c);outline-color:var(--color-border-disabled,#383838)}
 .button{border:0;padding:0 8px;background:var(--color-bg-secondary,#383838);display:flex;align-items:center;justify-content:center;gap:4px}.button:hover:not(:disabled){background:var(--color-bg-tertiary,#444)}.button:active:not(:disabled){background:var(--color-bg-pressed,#4a4a4a)}.button:focus-visible{outline:1px solid var(--color-border-selected,#0d99ff);outline-offset:1px}.button:disabled{opacity:.4}.button.primary{background:var(--color-bg-brand,#0d99ff);color:var(--color-text-onbrand,#fff)}.button.primary:hover:not(:disabled){background:var(--color-bg-brand-hover,#0b8de8)}.button.outline{background:transparent;outline:1px solid var(--color-border,#444);outline-offset:-1px}.button.icon{width:24px;flex:0 0 24px;padding:0;background:transparent}.button.icon:hover:not(:disabled){background:var(--color-bg-hover,#383838)}
 .select{appearance:none;padding-right:24px}.select-wrap{position:relative}.select-wrap>svg{position:absolute;right:0;top:0;pointer-events:none;color:var(--color-icon,#fff)}
 .check{display:flex;align-items:center;gap:4px;min-height:24px;cursor:pointer}.check input{width:14px;height:14px;accent-color:var(--color-bg-selected,#444);margin:0 4px;appearance:none;border:1px solid var(--color-border-strong,#888);border-radius:2px;background:transparent}.check input:checked{background-color:var(--color-bg-selected,#444);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='m2.5 6 2.5 2.5 4.5-5' fill='none' stroke='white' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}.check input:focus-visible{outline:1px solid var(--color-border-selected,#0d99ff);outline-offset:1px}.check.disabled{color:var(--color-text-disabled,#777)}
.range-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(48px,72px) auto;align-items:center;gap:8px}.group-title{font-weight:var(--font-weight-strong,550)}
 .segmented{display:flex;gap:1px;border-radius:var(--radius-medium,5px);overflow:hidden}.segmented>.button{border-radius:0;flex:1}.segmented>.button[aria-pressed=true]{background:var(--color-bg-selected,#394360)}
 details{border-top:1px solid var(--color-border,#444);padding-top:8px}summary{list-style:none;cursor:pointer;display:flex;align-items:center;font-weight:var(--font-weight-strong,550);color:var(--color-text-secondary,#b3b3b3);height:32px}summary::-webkit-details-marker{display:none}summary:hover,details[open]>summary{color:var(--color-text,#fff)}summary>svg{transform:none}details[open]>summary>svg{transform:rotate(90deg)}details>.column{padding-top:8px}.slider{width:100%;accent-color:var(--color-bg-brand,#0d99ff);height:24px;margin:0}.status{font-size:11px;line-height:16px;color:var(--color-text-secondary,#b3b3b3)}
 `;
 function mount(container){const root=document.createElement('div'),shadow=root.attachShadow({mode:'open'}),style=document.createElement('style'),body=document.createElement('div');style.textContent=css;shadow.append(style,body);container.append(root);return {root,body,dispose:()=>root.remove()};}
 // A popup can be replaced while an extension is active. Move only our own root.
 function targetSection(resolve,position){
  const root=document.createElement('div');
  let stop;
  try{
   stop=host.sdk.targets.insert({target:resolve,element:root,position});
  }catch(error){root.remove();throw error;}
  return {root,body:root,show(value){root.hidden=!value;},dispose(){stop();root.remove();}};
 }
 function compose(spec){
  const scope=host.sdk.scope(window.figma);
  try{return composeScoped(spec,scope);}
  catch(error){scope.dispose();throw error;}
 }
 function composeScoped(spec,scope){
  const sdk=host.sdk,id=spec.id,api=window.figma,store=sdk.settings(id,spec.defaults||{},spec.storageKey),section=spec.panel.target?targetSection(spec.panel.target,spec.panel.position):sdk.panel(id,spec.panel);
  scope.add(()=>section.dispose());
  const view=mount(section.body),bindings=new Map();
  scope.add(()=>view.dispose());
  if(spec.panel.nativeStyle)scope.add(host.ui.install(view.root.shadowRoot));
  let busy=0,ready=false,changing=0;
  const model=sdk.model.create(store.value,{onChange(){
   store.save();
   if(ready&&!changing)refresh();
  }});
  scope.add(model.dispose);
  const groups=new Map(),customMounts=[];
  function enabled(value){return typeof value==='function'?!!value(ctx):value!==false;}
  function register(key,binding){
   if(bindings.has(key))throw Error('Duplicate control key: '+String(key));
   bindings.set(key,binding);
  }
  const settings={...store,set(key,value){model.patch({[key]:value});}};
  const ctx={id,api,state:store.value,settings,scope,section,controls:bindings,model,patch:model.patch,selection:()=>sdk.capabilities.selection(api),native:(operation,payload)=>host.nativeRequest(id,operation,payload),refresh,status:text=>{status.textContent=text;}};
  function change(node,value){
   changing++;
   try{
    model.batch(()=>{
     model.patch({[node.key]:value});
     node.onChange?.(ctx,value);
     spec.onChange?.(ctx,node.key);
    });
   }finally{
    changing--;
    if(!changing)refresh();
   }
  }
  function bind(control,node,wrapper=control){
   if(!node.key)throw Error('A bound control needs a key');
   register(node.key,{control,wrapper,node});
   const event=['select','checkbox','segmented'].includes(node.type)?'change':'input';
   scope.listen(control,event,()=>{
    const value=node.type==='checkbox'?control.checked:['number','slider'].includes(node.type)?(control.value===''?null:Number(control.value)):control.value;
    change(node,value);
   });
  }
  function rangeField(node){
   if(!node.key)throw Error('A rangeField needs a key');
   const wrap=document.createElement('div'),caption=document.createElement('span'),row=document.createElement('div');
   const slider=document.createElement('input'),number=document.createElement('input');
   const min=Number(node.min??0),max=Number(node.max??100),step=node.step??1;
   if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min||step!=='any'&&(!Number.isFinite(Number(step))||Number(step)<=0))throw RangeError('Invalid rangeField limits for '+node.key);
   wrap.className='field';caption.className='label';caption.textContent=node.label||node.key;row.className='range-pair';
   slider.type='range';slider.className='slider';number.type='number';number.className='input';
   for(const input of [slider,number]){
    input.min=min;input.max=max;input.step=step;
    input.setAttribute('aria-label',caption.textContent+(node.unit?' ('+node.unit+')':''));
   }
   row.append(slider,number);if(node.unit)row.append(document.createTextNode(node.unit));wrap.append(caption,row);
   let draft=false;
   function commit(){
    if(!draft)return;
    draft=false;
    if(number.value!==''&&Number.isFinite(Number(number.value))){
     // The native range input clamps and snaps to its configured step.
     slider.value=number.value;
     change(node,Number(slider.value));
    }
    update();
   }
   function update(){
    slider.value=store.value[node.key]??min;
    if(!draft)number.value=slider.value;
   }
   scope.listen(number,'input',()=>{draft=true;});
   scope.listen(number,'blur',commit);
   scope.listen(number,'keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();commit();}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();draft=false;update();}
   });
   scope.listen(slider,'input',()=>{draft=false;change(node,Number(slider.value));update();});
   register(node.key,{node,control:slider,number,wrapper:wrap,update,setDisabled(value){number.disabled=value;if(value)draft=false;}});
   return wrap;
  }
  function build(node){
   if(typeof node==='function')return build(node(ctx));
   if(node.type==='rangeField')return rangeField(node);
   if(node.type==='custom'){
    if(!node.key||typeof node.mount!=='function')throw TypeError('A custom control needs a key and mount function');
    const wrapper=document.createElement('div'),container=document.createElement('div');
    wrapper.className='field';
    if(node.label){
     const caption=document.createElement('span');caption.className='label';caption.textContent=node.label;wrapper.append(caption);
     container.setAttribute('role','group');container.setAttribute('aria-label',node.label);
    }
    wrapper.append(container);
    register(node.key,{control:container,wrapper,node,setDisabled(disabled){
     if(container.inert!==disabled)container.inert=disabled;
    }});
    customMounts.push(()=>{
     const life=sdk.scope(api);scope.add(life.dispose);
     const cleanup=node.mount(container,ctx,life);
     if(cleanup!=null){
      if(typeof cleanup!=='function')throw TypeError('A custom mount must return a cleanup function or nothing');
      life.add(cleanup);
     }
    });
    return wrapper;
   }
   if(['row','column','group'].includes(node.type)){
    const el=document.createElement('div');el.className=node.type==='group'?'column':node.type;
    if(node.type==='row')el.style.setProperty('--columns',node.columns||node.children?.length||1);
    if(node.title){const heading=document.createElement('span');heading.className='group-title';heading.textContent=node.title;el.append(heading);}
    if(node.enabled!==undefined||node.visible!==undefined)groups.set(el,node);
    for(const child of node.children||[])el.append(build(child));
    return el;
   }
   if(node.type==='label'){
    const el=document.createElement('div');el.className='label';
    register(node.key??Symbol('label'),{control:el,wrapper:el,node,update(){
     const text=String((typeof node.text==='function'?node.text(ctx):node.text)??'');
     if(el.textContent!==text)el.textContent=text;
    }});
    return el;
   }
   if(node.type==='disclosure'){const el=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');summary.append(icon('chevronRight'),document.createTextNode(node.title));body.className='column';for(const child of node.children||[])body.append(build(child));el.append(summary,body);el.open=!!node.open;return el;}
   if(node.type==='path'){
    const field=directoryField({label:node.label,value:store.value[node.key]||'',placeholder:node.placeholder,choose:directory=>sdk.capabilities.local(id).chooseFolder(directory),onChange:value=>change(node,value),onError:error=>ctx.status(String(error.message||error))});
    register(node.key,{control:field.input,wrapper:field.root,node,setDisabled:value=>field.setDisabled(value)});scope.add(()=>field.dispose());return field.root;
   }
   if(node.type==='imagePreview'){
    const view=preview({title:node.label||'Preview',open:node.open}),image=stylePreview(document.createElement('img'));image.alt=node.alt||'Preview';view.body.append(image);
    register(node.key||'preview-'+bindings.size,{control:image,wrapper:view.root,node,update(){const source=typeof node.source==='function'?node.source(ctx):node.source;image.hidden=!source;if(source&&image.getAttribute('src')!==source)image.setAttribute('src',source);else if(!source)image.removeAttribute('src');}});scope.add(()=>view.dispose());return view.root;
   }
   if(node.type==='button'||node.type==='iconButton'){const el=document.createElement('button');el.type='button';el.className='button '+(node.variant||'')+(node.type==='iconButton'?' icon':'');if(node.icon)el.append(icon(node.icon));if(node.type==='button')el.append(document.createTextNode(node.label||''));el.setAttribute('aria-label',node.label||node.icon||'');if(node.tooltip)el.title=node.tooltip;el.onclick=async()=>{if(scope.disposed||el.disabled)return;busy++;refresh();try{await node.onClick?.(ctx);}catch(error){ctx.status(String(error.message||error));}finally{busy--;refresh();}};register(node.key||'action-'+bindings.size,{control:el,wrapper:el,node});return el;}
   if(node.type!=null&&!['select','segmented','checkbox','slider','number','text'].includes(node.type)){
    throw TypeError('Unknown panel control type "'+node.type+'"'+(node.key?' for '+node.key:''));
   }
   const wrap=document.createElement('label');wrap.className=node.type==='checkbox'?'check':'field';if(node.label&&node.type!=='checkbox'){const label=document.createElement('span');label.className='label';label.textContent=node.label;wrap.append(label);}
   let control;if(node.type==='select'){const holder=document.createElement('span');holder.className='select-wrap';control=document.createElement('select');control.className='select';for(const option of node.options||[]){const el=document.createElement('option');el.value=option.value;el.textContent=option.label;control.append(el);}holder.append(control,icon('chevronDown'));wrap.append(holder);}
   else if(node.type==='segmented'){const holder=document.createElement('div');holder.className='segmented';control=holder;control.value=store.value[node.key];for(const option of node.options||[]){const button=document.createElement('button');button.type='button';button.className='button';button.textContent=option.label;button.dataset.value=option.value;button.onclick=()=>{if(button.disabled)return;control.value=option.value;control.dispatchEvent(new Event('change'));};holder.append(button);}wrap.append(holder);}
   else {control=document.createElement('input');control.type=node.type==='checkbox'?'checkbox':node.type==='slider'?'range':node.type==='number'?'number':'text';control.className=node.type==='slider'?'slider':node.type==='checkbox'?'':'input';for(const prop of ['min','max','step','placeholder'])if(node[prop]!=null)control[prop]=node[prop];wrap.append(control);if(node.type==='checkbox')wrap.append(document.createTextNode(node.label||''));}
   control.setAttribute('aria-label',node.label||node.key);bind(control,node,wrap);return wrap;
  }
  const content=build({type:'column',children:spec.panel.content||[]}),status=document.createElement('div');status.className='status';status.setAttribute('role','status');view.body.append(content,status);
  function refresh(){if(scope.disposed)return;
   const inactiveGroups=new Set();
   for(const [element,group] of groups){
    element.hidden=!enabled(group.visible);
    if(element.hidden||!enabled(group.enabled))inactiveGroups.add(element);
   }
   function inactive(wrapper){
    for(let parent=wrapper.parentElement;parent;parent=parent.parentElement)if(inactiveGroups.has(parent))return true;
    return false;
   }
   for(const {control,wrapper,node,setDisabled,update}of bindings.values()){const disabled=busy>0||!enabled(node.enabled)||inactive(wrapper);control.disabled=disabled;setDisabled?.(disabled);update?.();wrapper.classList.toggle('disabled',disabled);wrapper.hidden=typeof node.visible==='function'?!node.visible(ctx):node.visible===false;if(node.type==='checkbox')control.checked=!!store.value[node.key];else if(node.type==='segmented'){control.value=store.value[node.key];for(const button of control.children){button.disabled=disabled;button.setAttribute('aria-pressed',String(button.dataset.value===String(control.value)));}}else if(!['button','iconButton','imagePreview','label','rangeField','custom'].includes(node.type))control.value=store.value[node.key]??'';}section.show(spec.panel.visible?!!spec.panel.visible(ctx):ctx.selection().length>0);spec.onRefresh?.(ctx);}
  scope.on('selectionchange',refresh);scope.on('currentpagechange',refresh);
  scope.add(()=>spec.dispose?.(ctx));
  for(const run of customMounts)run();
  spec.setup?.(ctx);ready=true;refresh();
  host.register(id,{commands:Object.fromEntries(Object.entries(spec.commands||{}).map(([name,fn])=>[name,()=>fn(ctx)])),status:()=>({sidebarMounted:section.root.isConnected,busy:busy>0,...spec.status?.(ctx)}),dispose(){scope.dispose();}});
  return ctx;
 }
 function directoryField({label='输出目录',value='',placeholder='',choose,onChange=()=>{},onError=()=>{}}={}){
  let disposed=false,busy=false,disabled=false;const root=document.createElement('label'),caption=document.createElement('span'),row=document.createElement('div'),input=document.createElement('input'),button=document.createElement('button');
  root.className='field';caption.className='label';caption.textContent=label;row.style.cssText='display:flex;gap:8px';input.className='input';input.type='text';input.value=value;input.placeholder=placeholder;input.setAttribute('aria-label',label);input.style.cssText='flex:1;width:0;min-width:0;margin:0';button.className='button';button.type='button';button.textContent='选择…';button.style.cssText='width:auto;flex:none';row.append(input,button);root.append(caption,row);
  function refresh(){input.disabled=disabled||busy;button.disabled=disabled||busy;}
  input.oninput=()=>{if(!disposed)onChange(input.value);};button.onclick=async()=>{if(disposed||busy||disabled)return;busy=true;refresh();try{const result=await choose(input.value);if(disposed||result.cancelled)return;input.value=result.directory;onChange(input.value);}catch(error){if(!disposed)onError(error);}finally{busy=false;if(!disposed)refresh();}};
  return {root,input,button,setDisabled(value){disabled=!!value;refresh();},dispose(){disposed=true;input.oninput=null;button.onclick=null;root.remove();}};
 }
 function stylePreview(image,{maxHeight=180}={}){image.style.cssText='display:block;max-width:100%;max-height:'+maxHeight+'px;object-fit:contain;background-color:#ddd;background-image:conic-gradient(#bbb 25%,transparent 0 50%,#bbb 0 75%,transparent 0);background-size:16px 16px';return image;}
 function preview({title='Preview',open=false}={}){const root=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');root.style.cssText='margin-top:4px;border:0;padding-top:0';summary.append(icon('chevronRight'),document.createTextNode(title));summary.style.cssText='margin-left:-8px;display:flex;align-items:center;gap:4px;list-style:none;cursor:pointer;font:600 11px Inter,Segoe UI,sans-serif;color:var(--color-text-secondary,#b3b3b3);min-height:24px';body.style.cssText='display:flex;justify-content:center;align-items:center;min-height:80px;margin-top:12px;flex-direction:column;gap:8px';root.append(summary,body);root.open=open;root.addEventListener('toggle',()=>{summary.firstChild.style.transform=root.open?'rotate(90deg)':'';});return {root,body,summary,dispose(){root.remove();}};}
 host.componentKit=Object.freeze({version:'0.3',compose,icon,mount,directoryField,preview,stylePreview,reference:reference?.evidence});
})();
