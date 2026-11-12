/* Stable services: no editor or DOM dependencies until explicitly supplied. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CanvasExtensionServices=value;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 function scope(){const cleanups=[];let disposed=false;return {add(fn){if(disposed)fn();else cleanups.push(fn);return fn;},listen(target,event,fn,options){target.addEventListener(event,fn,options);return this.add(()=>target.removeEventListener(event,fn,options));},dispose(){if(disposed)return;disposed=true;for(const fn of cleanups.reverse())try{fn();}catch(_){}cleanups.length=0;},get disposed(){return disposed;}};}
 function latestTask({concurrency=1}={}){
  if(!Number.isInteger(concurrency)||concurrency<1)throw Error('Invalid concurrency');
  const jobs=new Map(),pending=new Map();let active=0,disposed=false;
  function cancel(key){const job=jobs.get(key);if(!job)return;job.cancelled=true;clearTimeout(job.timer);pending.delete(key);jobs.delete(key);job.resolve({status:'cancelled'});}
  function drain(){if(disposed)return;while(active<concurrency&&pending.size){const [key,job]=pending.entries().next().value;pending.delete(key);active++;
   const current=()=>!disposed&&!job.cancelled&&jobs.get(key)===job;
   const token={current,check(){if(!current())throw Object.assign(Error('Task superseded'),{code:'STALE_TASK'});},commit(fn){this.check();return fn();}};
   // Start synchronously until the first await, preserving resource acquisition order.
   let result;try{result=job.work(token);}catch(error){result=Promise.reject(error);}
   Promise.resolve(result).then(value=>{if(current()){jobs.delete(key);job.resolve({status:'completed',value});}},error=>{if(current()){jobs.delete(key);job.reject(error);}}).finally(()=>{active--;drain();});
  }}
  return {run(key,work,{delay=0}={}){if(disposed)return Promise.resolve({status:'cancelled'});cancel(key);let job;const result=new Promise((resolve,reject)=>{job={work,resolve,reject,cancelled:false};jobs.set(key,job);});const enqueue=()=>{if(!job.cancelled&&!disposed){pending.set(key,job);drain();}};if(delay>0)job.timer=setTimeout(enqueue,delay);else enqueue();return result;},cancel,dispose(){if(disposed)return;disposed=true;for(const key of [...jobs.keys()])cancel(key);},get busy(){return active>0||jobs.size>0;}};
 }
 function format(bytes){if(!bytes||bytes.length<4)return 'unknown';if(bytes.length>=6&&bytes[0]===71&&bytes[1]===73&&bytes[2]===70&&bytes[3]===56&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97)return 'gif';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'png';if(bytes[0]===255&&bytes[1]===216)return 'jpeg';if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'webp';return 'unknown';}
 function imageResources({read,decode,maxSignatures=512,maxBitmaps=1}={}){
  if(!Number.isInteger(maxSignatures)||maxSignatures<1||!Number.isInteger(maxBitmaps)||maxBitmaps<0)throw Error('Invalid image cache limits');
  const reading=new Map(),signatures=new Map(),bitmaps=new Map();let disposed=false;
  function remember(hash,value){signatures.delete(hash);signatures.set(hash,value);while(signatures.size>maxSignatures)signatures.delete(signatures.keys().next().value);}
  async function bytes(hash){if(disposed)throw Error('Image resources disposed');if(!hash)throw Error('Image hash required');if(reading.has(hash))return reading.get(hash);const pending=Promise.resolve().then(()=>read(hash)).then(value=>{if(!value)throw Error('Image unavailable');if(!disposed)remember(hash,format(value));return value;});reading.set(hash,pending);try{return await pending;}finally{if(reading.get(hash)===pending)reading.delete(hash);}}
  function prune(){for(const [hash,entry]of bitmaps){if(entry.users||!entry.bitmap)continue;if(!disposed&&bitmaps.size<=maxBitmaps)break;bitmaps.delete(hash);entry.bitmap.close?.();}}
  async function withBitmap(hash,fn){if(disposed)throw Error('Image resources disposed');if(!decode)throw Error('Image decode unavailable');let entry=bitmaps.get(hash);if(!entry){entry={users:0,bitmap:null};entry.pending=bytes(hash).then(value=>decode(new Blob([value]))).then(bitmap=>{entry.bitmap=bitmap;return bitmap;});bitmaps.set(hash,entry);}entry.users++;try{const bitmap=await entry.pending;if(disposed)throw Error('Image resources disposed');return await fn(bitmap);}catch(error){if(!entry.bitmap&&bitmaps.get(hash)===entry)bitmaps.delete(hash);throw error;}finally{entry.users--;prune();}}
  return {bytes,withBitmap,knownFormat:hash=>signatures.get(hash),remember:(hash,bytes)=>remember(hash,format(bytes)),async identify(hash){return signatures.get(hash)||format(await bytes(hash));},dispose(){disposed=true;signatures.clear();prune();},get size(){return {signatures:signatures.size,bitmaps:bitmaps.size,inFlight:reading.size};}};
 }
 function surface(bitmap,width,height,{document=globalThis.document,parts=null,smoothing=true}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192)throw Error('Invalid output size');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');
  context.imageSmoothingEnabled=smoothing;context.imageSmoothingQuality='high';context.clearRect?.(0,0,width,height);
  if(parts)for(const part of parts)context.drawImage(bitmap,...part);else context.drawImage(bitmap,0,0,width,height);
  return {canvas,dispose(){canvas.width=1;canvas.height=1;}};
 }
 async function pngBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PNG encoding failed')),'image/png'));}
 async function base64(blob,Reader=globalThis.FileReader){return new Promise((resolve,reject)=>{const reader=new Reader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('PNG encoding failed'));reader.readAsDataURL(blob);});}
 async function resizePng(bytes,width,height,{decode=globalThis.createImageBitmap,document=globalThis.document,Reader=globalThis.FileReader}={}){
  const bitmap=await decode(new Blob([bytes],{type:'image/png'}));let view;try{view=surface(bitmap,width,height,{document});return await base64(await pngBlob(view.canvas),Reader);}finally{view?.dispose();bitmap.close?.();}
 }
 function exportFiles(id,{native}={}){if(typeof native!=='function')throw Error('Native export adapter required');const send=(operation,payload)=>native(id,operation,payload);return {
  chooseFolder:directory=>send('choose-export-folder',{directory}),openFolder:directory=>send('open-export-folder',{directory}),
  async run(items,{directory,encode,cancelled=()=>false,onProgress=()=>{}}={}){
   let batchId=null,completed=0;try{const prepared=await send('export-png',{action:'prepare',directory,items:items.map(({name,width,height})=>({name,width,height}))});batchId=prepared.batchId;
    for(let index=0;index<items.length;index++){if(cancelled())break;onProgress({index,completed,total:items.length,name:prepared.names[index]});const base64=await encode(items[index],index);if(cancelled())break;await send('export-png',{action:'write',batchId,index,base64});completed++;}
    const wasCancelled=cancelled();await send('export-png',{action:wasCancelled?'cancel':'finish',batchId});batchId=null;return {completed,cancelled:wasCancelled};
   }catch(error){const failure=error&&typeof error==='object'?error:Error(String(error));failure.completed=completed;throw failure;}finally{if(batchId)try{await send('export-png',{action:'cancel',batchId});}catch(_){}}
  }
 };}
 // Optional general-purpose progress task; callers own UI and whether partial results persist.
 function progressTask(){const queue=latestTask();return {cancel:()=>queue.cancel('progress'),dispose:()=>queue.dispose(),run(items,work,onProgress=()=>{}){return queue.run('progress',async token=>{const values=[];for(let index=0;index<items.length;index++){token.check();const value=await work(items[index],token,index);token.check();values.push(value);onProgress({completed:values.length,total:items.length});}return values;});}};}
 function axis(source,target,start,end){
  if(![source,target,start,end].every(Number.isFinite)||source<=0||target<=0||start<0||end<0||start+end>source+source*1e-10)throw Error('切片边距必须非负，且两侧总和不能超过原图尺寸（100%）');
  if(Math.abs(start+end-source)<=source*1e-10)end=source-start;
  const scale=Math.min(1,target/(start+end||1));
  return {s:[0,start,Math.max(start,source-end),source],d:[0,start*scale,target-end*scale,target]};
 }
 function plan(sw,sh,w,h,m,outputScale=1){
  const x=axis(sw,w,m.left,m.right),y=axis(sh,h,m.top,m.bottom),out=[];
  if(!Number.isFinite(outputScale)||outputScale<=0)throw Error('预览比例必须为正数');
  if(w===sw&&h===sh&&outputScale===1)return [[0,0,sw,sh,0,0,w,h]];
  // GPU Canvas anti-aliases fractional destination rectangles independently.
  // Share integer output boundaries so semi-transparent patches cannot crack.
  x.d=x.d.map(v=>Math.round(v*outputScale));y.d=y.d.map(v=>Math.round(v*outputScale));
  for(let j=0;j<3;j++)for(let i=0;i<3;i++){
   const a=[x.s[i],y.s[j],x.s[i+1]-x.s[i],y.s[j+1]-y.s[j],x.d[i],y.d[j],x.d[i+1]-x.d[i],y.d[j+1]-y.d[j]];
   // At exactly 100% the middle source strip is zero-width. Extend its seam
   // texel across the remaining target area instead of rejecting it or leaving holes.
   if(a[6]>0&&a[7]>0){if(a[2]<=sw*1e-10){a[0]=Math.max(0,Math.min(sw-1,Math.floor(a[0])));a[2]=Math.min(1,sw);}if(a[3]<=sh*1e-10){a[1]=Math.max(0,Math.min(sh-1,Math.floor(a[1])));a[3]=Math.min(1,sh);}if(a[2]>0&&a[3]>0)out.push(a);}
  }
  return out;
 }
 function pixels(sw,sh,m,unit='pixels'){
  if(!['pixels','percent'].includes(unit))throw Error('未知边距单位');
  return Object.fromEntries(['left','top','right','bottom'].map(n=>[n,unit==='percent'?Number(m[n])*(['left','right'].includes(n)?sw:sh)/100:Number(m[n])]));
 }
 const nineSlice=Object.freeze({plan,pixels});
 return Object.freeze({scope,latestTask,imageResources,format,surface,pngBlob,base64,resizePng,exportFiles,progressTask,nineSlice});
});
