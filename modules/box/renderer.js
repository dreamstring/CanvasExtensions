/* One encoder at a time. New requests replace queued work; stale work never writes. */
(() => {
 'use strict';
 function create({api,rules,document,decode,namespace='canvasExtensions',key='box'}) {
  const pending=new Map(),versions=new Map();let sequence=0,running=false,disposed=false,cachedHash='',cachedBitmap=null;
  const size=node=>[Math.max(1,Math.round(node.width)),Math.max(1,Math.round(node.height))];
  function invalidate(node){versions.set(node.id,++sequence);const job=pending.get(node.id);if(job){pending.delete(node.id);job.resolve(false);}}
  async function bitmap(hash){if(cachedHash===hash&&cachedBitmap)return cachedBitmap;const image=hash&&api.getImageByHash(hash);if(!image)throw Error('原图资源不可用，请点击“以当前图片重建 Box”；当前图片未被覆盖');const bytes=await image.getBytesAsync();const next=await decode(new Blob([bytes]));cachedBitmap?.close();cachedHash=hash;cachedBitmap=next;return next;}
  async function render(job){
   const {node,settings,expected,width,height}=job;
   if(width>8192||height>8192||width*height>16777216)throw Error('Box 输出超过 8192 边长或 1600 万像素限制');
   const source=await bitmap(settings.paint.imageHash);
   if(disposed||versions.get(node.id)!==job.version)return false;
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建九宫格画布');
   const margins=rules.pixels(source.width,source.height,settings.margins,settings.unit||'pixels');
   for(const part of rules.plan(source.width,source.height,width,height,margins))ctx.drawImage(source,...part);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片编码失败')),'image/png'));
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(disposed||node.removed||versions.get(node.id)!==job.version)return false;
   if(size(node).join('x')!==width+'x'+height)return false;
   if(node.getSharedPluginData(namespace,key)!==expected)return false;
   const fills=[...node.fills],actual=fills[settings.index];
   if(actual?.type!=='IMAGE'||actual.imageHash!==(settings.outputHash||settings.paint.imageHash))throw Error('图片填充已被修改，未覆盖');
   // Direct IMAGE writes preserve other ordinary paints. PATTERN requires Figma's async setter.
   if(fills.some(p=>p.type==='PATTERN'))throw Error('请先将 Box 图片放在不含 Pattern 的填充对象中');
   const image=api.createImage(bytes),paint={...settings.paint,imageHash:image.hash,scaleMode:'FILL'};
   delete paint.imageTransform;delete paint.scalingFactor;fills[settings.index]=paint;
   const saved={...settings,outputHash:image.hash,size:width+'x'+height};delete saved.token;
   // Plugin-data hashes are not image references. Keep the original asset in an
   // invisible native paint so Figma retains it across save/reopen and asset GC.
   const reference={...settings.paint,visible:false};
   if(JSON.stringify(fills[saved.sourceIndex])!==JSON.stringify(reference)){saved.sourceIndex=fills.length;fills.push(reference);}
   saved.sourceReference=reference;
   const before=[...node.fills];
   try{node.fills=fills;node.setSharedPluginData(namespace,key,JSON.stringify(saved));}
   catch(error){node.fills=before;throw error;}
   if(job.commit)api.commitUndo?.();
   return true;
  }
  async function drain(){if(running||disposed)return;running=true;try{while(pending.size&&!disposed){const [id,job]=pending.entries().next().value;pending.delete(id);try{job.resolve(await render(job));}catch(e){job.reject(e);}}}finally{running=false;if(disposed){cachedBitmap?.close();cachedBitmap=null;}}}
  function request(node,settings,{commit=false}={}){
   if(disposed)return Promise.resolve(false);
   const prior=pending.get(node.id);prior?.resolve(false);
   const version=++sequence;versions.set(node.id,version);const [width,height]=size(node);
   const result=new Promise((resolve,reject)=>pending.set(node.id,{node,settings:JSON.parse(JSON.stringify(settings)),width,height,expected:node.getSharedPluginData(namespace,key),version,commit,resolve,reject}));
   queueMicrotask(drain);return result;
  }
  return {request,invalidate,get busy(){return running||pending.size>0;},dispose(){disposed=true;for(const job of pending.values())job.resolve(false);pending.clear();if(!running){cachedBitmap?.close();cachedBitmap=null;}}};
 }
 const renderer={create};if(typeof module!=='undefined')module.exports=renderer;else window.CanvasBoxRenderer=renderer;
})();
