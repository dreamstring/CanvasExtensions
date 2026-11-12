/* One encoder at a time. New requests replace queued work; stale work never writes. */
(() => {
 'use strict';
 const services=typeof module!=='undefined'&&module.exports?require('../../runtime/editor-services.js'):window.CanvasExtensionServices;
 function create({api,rules,document,decode,images,namespace='canvasExtensions',key='box'}) {
  const queue=services.latestTask(),resources=images||services.imageResources({decode,read:async hash=>{const image=hash&&api.getImageByHash(hash);if(!image)throw Error('原图资源不可用，请点击“以当前图片重建 Box”；当前图片未被覆盖');return image.getBytesAsync();}});let disposed=false;
  const size=node=>[Math.max(1,Math.round(node.width)),Math.max(1,Math.round(node.height))];
  const invalidate=node=>queue.cancel(node.id);
  async function render(job,task){
   const {node,settings,expected,width,height}=job;
   if(width>8192||height>8192||width*height>16777216)throw Error('Box 输出超过 8192 边长或 1600 万像素限制');
   return resources.withBitmap(settings.paint.imageHash,async source=>{
   if(!task.current())return false;
   const margins=rules.pixels(source.width,source.height,settings.margins,settings.unit||'pixels');
   const view=services.surface(source,width,height,{document,parts:rules.plan(source.width,source.height,width,height,margins)});
   try{
   const blob=await services.pngBlob(view.canvas);
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(!task.current()||node.removed)return false;
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
   return services.writePaints(job.snapshot,{fills,data:JSON.stringify(saved),api,commit:job.commit,current:task.current});
   }finally{view.dispose();}

   });
  }
  function request(node,settings,{commit=false}={}){
   if(disposed)return Promise.resolve(false);
   const [width,height]=size(node),job={node,settings:JSON.parse(JSON.stringify(settings)),width,height,expected:node.getSharedPluginData(namespace,key),snapshot:services.paintSnapshot(node,{namespace,key}),commit};
   return queue.run(node.id,task=>render(job,task)).then(result=>result.status==='completed'?result.value:false);
  }
  return {request,invalidate,get busy(){return queue.busy;},dispose(){disposed=true;queue.dispose();if(!images)resources.dispose();}};

 }
 const renderer={create};if(typeof module!=='undefined')module.exports=renderer;else window.CanvasBoxRenderer=renderer;
})();
