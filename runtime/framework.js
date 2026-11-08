/* Shared local extension lifecycle. Modules register only their manifest-declared commands. */
(() => {
 'use strict';
 window.FigmaAssistant?.dispose();
 const modules=new Map(),errors={};
 const sections=new Map(),sectionHeadings=new Map(),sectionAnchors=new Map(),moduleOrder=[];
 const nativeQueue=[],nativePending=new Map(),nativePermissions=new Map(),nativeNamespace=Date.now().toString(36)+Math.random().toString(36).slice(2);let nativeSerial=0;
 let disposed=false,loading=null,sectionRoot=null,sectionObserver=null;
 function layoutSections(){
  if(!sectionRoot||disposed)return;
  const side=document.querySelector('[aria-label="Right sidebar"]');
  const label=el=>(el.getAttribute('aria-label')||el.textContent||'').trim();
  const nodes=side?[...side.querySelectorAll('button,[role="button"],h2,h3,div,span')].filter(el=>!sectionRoot.contains(el)):[];
  let anchor=side&&[...side.querySelectorAll('button,[role="button"],h2,h3')].find(el=>/^(Export|导出)$/.test(label(el)));
  const neighbors=nodes.filter(el=>/^(Effects|Stroke|Fill|Appearance|Layout|Position|Styles|Page|效果|描边|填充|外观|布局|位置|样式|页面)$/.test(label(el)));
  if(!anchor||!neighbors.length){sectionRoot.remove();return;}
  const control=anchor;
  while(anchor.parentElement&&anchor.parentElement!==side){if(neighbors.some(el=>anchor.parentElement.contains(el)))break;anchor=anchor.parentElement;}
  if(anchor===control){sectionRoot.remove();return;}
  if(sectionRoot.previousElementSibling!==anchor)anchor.after(sectionRoot);
  for(const [id,placement] of sectionAnchors){
   const element=sections.get(id);if(!element||element.style.display==='none')continue;
   let target=side&&[...side.querySelectorAll('button,[role="button"],h2,h3,div,span')].reverse().find(el=>!sectionRoot.contains(el)&&![...sections.values()].some(s=>s.contains(el))&&placement.labels.includes(label(el)));
   if(!target){element.remove();continue;}
   const first=target;
   // Fill headings may be plain spans nested in multiple wrappers with the same text.
   // Only a different section heading defines the boundary, never another Fill wrapper.
   while(target.parentElement&&target.parentElement!==side){if(neighbors.some(el=>!placement.labels.includes(label(el))&&target.parentElement.contains(el)))break;target=target.parentElement;}
   if(target===first){element.remove();continue;}
   if(placement.inside){if(element.parentElement!==target)target.appendChild(element);}
   else if(element.previousElementSibling!==target)target.after(element);
  }

 }
 function placeSection(id,element){
  if(disposed||(!modules.has(id)&&loading?.id!==id))throw Error('Extension is not registered');
  if(!sectionRoot){sectionRoot=document.createElement('div');sectionRoot.dataset.figmaExtensions='sections';Object.assign(sectionRoot.style,{display:'block',width:'100%',minWidth:'0',gridColumn:'1 / -1',flex:'0 0 auto'});sectionObserver=new MutationObserver(layoutSections);sectionObserver.observe(document.body,{childList:true,subtree:true});}
  sections.set(id,element);if(!sectionAnchors.has(id)&&element.parentElement!==sectionRoot)sectionRoot.appendChild(element);
  const active=moduleOrder.map(key=>sections.get(key)).filter(node=>node?.parentElement===sectionRoot);
  active.forEach((node,index)=>{if(sectionRoot.children[index]!==node)sectionRoot.insertBefore(node,sectionRoot.children[index]||null);});
  layoutSections();return element.isConnected;
 }
 const host={
  begin(id,commands,capabilities=[]){loading={id,commands};if(!moduleOrder.includes(id))moduleOrder.push(id);nativePermissions.set(id,new Set(capabilities));},end(){loading=null;},
  nativeRequest(id,operation,payload){
   if(disposed||!nativePermissions.get(id)?.has(operation))return Promise.reject(Error('该扩展未声明所需本地能力'));
   if(nativePending.size>=32)return Promise.reject(Error('本地请求过多，请稍后重试'));
   return new Promise((resolve,reject)=>{const requestId=nativeNamespace+':'+String(++nativeSerial);const timer=setTimeout(()=>{nativePending.delete(requestId);const index=nativeQueue.findIndex(x=>x.id===requestId);if(index>=0)nativeQueue.splice(index,1);reject(Error('本地操作超时'));},120000);nativePending.set(requestId,{resolve,reject,timer});nativeQueue.push({id:requestId,module:id,operation,payload});console.debug('[CanvasExtensions:native-request]');});
  },
  drainNativeRequests(){return nativeQueue.splice(0,1);},
  completeNativeRequest(response){const pending=nativePending.get(response.id);if(!pending)return;nativePending.delete(response.id);clearTimeout(pending.timer);if(response.ok)pending.resolve(response.result);else pending.reject(Error(response.error||'本地操作失败'));},
  register(id,module){
   if(!loading||loading.id!==id||modules.has(id)||!module||typeof module.dispose!=='function')throw Error('Invalid extension registration');
   const commands=module.commands??module.modules?.[id]?.commands??{};
   if(Object.keys(commands).some(key=>!loading.commands.includes(key)||typeof commands[key]!=='function'))throw Error('Undeclared command');
   modules.set(id,{module,commands});
   delete errors[id];
  },
  fail(id,error){errors[id]=error;const entry=modules.get(id);if(entry){try{entry.module.dispose();}catch(_){}modules.delete(id);}sections.get(id)?.remove();sections.delete(id);},
  placeSection,
  createSection(id,title,options={}){
   if(options.afterSection)sectionAnchors.set(id,{labels:options.afterSection,inside:options.insideSection===true});
   const root=document.createElement('section'),shadow=root.attachShadow({mode:'open'}),heading=document.createElement('div'),body=document.createElement('div');
   Object.assign(root.style,{display:'block',borderTop:'1px solid var(--color-border,#444)',background:'var(--color-bg,#2c2c2c)',color:'var(--color-text,#fff)',font:'11px Inter,Segoe UI,sans-serif'});
   heading.textContent=title;Object.assign(heading.style,{padding:'0 16px',height:'40px',display:'flex',alignItems:'center',fontWeight:'var(--font-weight-strong,550)'});Object.assign(body.style,{padding:'0 16px 12px'});shadow.append(heading,body);const releaseUi=host.ui?.install(shadow);
   let expanded=options.collapsed!==true,headerHovered=false;
   const updateHeadingColor=()=>{heading.style.color=expanded||headerHovered?'var(--color-text,#fff)':'var(--color-text-secondary,#b3b3b3)';};
   if(options.collapsible){heading.onpointerenter=()=>{headerHovered=true;updateHeadingColor();};heading.onpointerleave=()=>{headerHovered=false;updateHeadingColor();};}
   if(options.collapsible){const toggle=document.createElement('button');toggle.type='button';toggle.className='ce-section-toggle';toggle.style.cssText='margin-left:auto;margin-right:-8px;width:24px;height:24px;flex:0 0 24px;padding:0;border:0;background:transparent;color:var(--color-icon,#fff);font:20px Inter,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer';const apply=()=>{body.hidden=!expanded;updateHeadingColor();toggle.innerHTML='<svg width=16 height=16 viewBox="0 0 16 16" aria-hidden=true style="display:block;width:16px;height:16px;flex:none"><path d="M3 8h10'+(expanded?'':'M8 3v10')+'" fill=none stroke=currentColor stroke-width=1 stroke-linecap=round /></svg>';if(host.componentKit){toggle.replaceChildren(host.componentKit.icon(expanded?'minus':'plus'));}toggle.setAttribute('aria-label',expanded?'收起 '+title:'展开 '+title);toggle.setAttribute('aria-expanded',String(expanded));};toggle.onclick=()=>{expanded=!expanded;apply();};heading.append(toggle);apply();}
   sectionHeadings.set(id,heading);
   return {root,body,show(visible=true){if(visible)placeSection(id,root);else {sections.delete(id);root.remove();}},dispose(){releaseUi?.();root.remove();sections.delete(id);sectionHeadings.delete(id);sectionAnchors.delete(id);}};
  },
  status(){const statuses=[...modules].map(([id,{module}])=>{try{return {id,...(module.status?.()??{})};}catch(error){errors[id]=String(error);return {id,failed:true};}});return {version:'0.6.1',sidebarMounted:statuses.some(s=>s.sidebarMounted),extensions:statuses,errors};},
  isLive(){return !disposed&&[...modules.values()].every(({module})=>module.isLive?.()!==false);},
  async command(id,action){const entry=modules.get(id);if(!entry||!Object.hasOwn(entry.commands,action))throw Error('Unsupported extension command');return await entry.commands[action]();},
  dispose(){if(disposed)return;disposed=true;for(const {module} of modules.values()){try{module.dispose();}catch(_){}}modules.clear();host.ui?.dispose();sectionObserver?.disconnect();sectionRoot?.remove();sections.clear();sectionHeadings.clear();for(const p of nativePending.values()){clearTimeout(p.timer);p.reject(Error('扩展已卸载'));}nativePending.clear();nativeQueue.length=0;}
 };
 window.FigmaExtensions=host;window.FigmaAssistant=host;
})();
