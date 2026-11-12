/* Figma capability adapters; runtime-shape checks are not cross-version acceptance. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./services.js'));else root.CanvasExtensionServices=factory(root.CanvasExtensionServices);})(typeof window==='undefined'?globalThis:window,base=>{
 'use strict';
 const {scope,latestTask,imageResources}=base;
 function editorImages(api,options={}){return imageResources({...options,read:async hash=>{if(typeof api?.getImageByHash!=='function')throw Error('images.read unavailable');const image=api.getImageByHash(hash);if(!image||typeof image.getBytesAsync!=='function')throw Error('图片不存在 / Image unavailable');return image.getBytesAsync();}});}
 async function selectionNodes(api,{deep=false,current=()=>true,yieldEvery=64}={}){const result=[],seen=new Set(),stack=[...(api?.currentPage?.selection||[])].reverse();let n=0;while(stack.length&&current()){const node=stack.pop();if(!node||seen.has(node.id)||node.removed||node.visible===false)continue;seen.add(node.id);result.push(node);if(deep)for(let i=(node.children?.length||0)-1;i>=0;i--)stack.push(node.children[i]);if(++n%yieldEvery===0)await new Promise(resolve=>setTimeout(resolve,0));}return current()?result:[];}
 function watchSelection(api,{run,onStart=()=>{},onError=()=>{},delay=250,deep=false,poll=400,geometry=false,initial=true}={}){
  if(typeof run!=='function'||!api?.currentPage?.selection)throw Error('selection.read or run callback unavailable');
  const queue=latestTask(),life=scope();let last='',revision=0;
  const key=()=>String(api?.currentPage?.id||'')+':'+[...(api?.currentPage?.selection||[])].map(n=>n.id+(geometry?':'+n.width+'x'+n.height:'')).join(',');
  function refresh({immediate=false}={}){const snapshot=key(),request=++revision;last=snapshot;onStart();return queue.run('selection',async task=>{
   const current=()=>task.current()&&snapshot===key();
   const token={current,check(){if(!current())throw Object.assign(Error('Selection superseded'),{code:'STALE_TASK'});},commit(fn){this.check();return fn();}};
   const nodes=await selectionNodes(api,{deep,current});if(!current())return;return run({nodes,pageId:api.currentPage.id},token);
  },{delay:immediate?0:delay}).catch(error=>{if(!life.disposed&&request===revision&&snapshot===key()&&error.code!=='STALE_TASK')onError(error);return {status:'error',error};});}
  const changed=()=>{refresh();};for(const event of ['selectionchange','currentpagechange']){api.on?.(event,changed);life.add(()=>api.off?.(event,changed));}
  if(poll>0){const timer=setInterval(()=>{if(key()!==last)refresh();},poll);life.add(()=>clearInterval(timer));}
  life.add(()=>queue.dispose());if(initial)refresh();return {refresh,dispose:()=>life.dispose()};
 }
 const clone=value=>JSON.parse(JSON.stringify(value));
 function paintSnapshot(node,{namespace='canvasExtensions',key}={}){if(node.removed)throw Error('Node removed');return {node,id:node.id,width:node.width,height:node.height,fills:clone([...node.fills]),namespace,key,data:key?node.getSharedPluginData(namespace,key):undefined};}
 function writePaints(snapshot,{fills,data=snapshot.data,api,commit=false,current=()=>true}={}){
  const {node}=snapshot;
  if(!current()||node.removed||node.id!==snapshot.id||node.width!==snapshot.width||node.height!==snapshot.height||JSON.stringify([...node.fills])!==JSON.stringify(snapshot.fills)||(snapshot.key&&node.getSharedPluginData(snapshot.namespace,snapshot.key)!==snapshot.data))return false;
  try{node.fills=clone(fills);if(snapshot.key)node.setSharedPluginData(snapshot.namespace,snapshot.key,data);}
  catch(error){try{node.fills=clone(snapshot.fills);if(snapshot.key)node.setSharedPluginData(snapshot.namespace,snapshot.key,snapshot.data);}catch(rollback){error.rollbackError=rollback;}throw error;}
  if(commit)api?.commitUndo?.();return true;
 }
 function undoGroup(api,change){if(typeof api?.commitUndo!=='function')throw Error('history.commit unavailable');if(change?.constructor?.name==='AsyncFunction')throw Error('Undo group must be synchronous');if(typeof change!=='function')throw Error('Change callback required');const value=change();if(value&&typeof value.then==='function')throw Error('Undo group must be synchronous');api?.commitUndo?.();return value;}

 function selectionContains(node,roots){const ids=roots instanceof Set?roots:new Set([...roots].map(value=>typeof value==='string'?value:value.id)),seen=new Set();for(let current=node;current&&!seen.has(current.id);current=current.parent){if(ids.has(current.id))return true;seen.add(current.id);}return false;}
 async function resolveNode(api,id){if(typeof id!=='string'||!id)throw Error('Node ID required');if(typeof api?.getNodeByIdAsync==='function')return api.getNodeByIdAsync(id);if(typeof api?.getNodeById==='function')return api.getNodeById(id);throw Error('nodes.resolve unavailable');}
 async function loadFonts(api,names,{current=()=>true}={}){
  if(typeof api?.loadFontAsync!=='function')throw Error('fonts.load unavailable');
  const unique=new Map();for(const font of names){if(!font||typeof font.family!=='string'||typeof font.style!=='string')throw Error('Invalid font name');unique.set(JSON.stringify([font.family,font.style]),{family:font.family,style:font.style});}
  let loaded=0;for(const font of unique.values()){if(!current())return {loaded,cancelled:true};await api.loadFontAsync(font);loaded++;}return {loaded,cancelled:!current()};
 }
 return Object.freeze({...base,editorImages,selectionNodes,watchSelection,paintSnapshot,writePaints,undoGroup,resolveNode,loadFonts,selectionContains});
});
