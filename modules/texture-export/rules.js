/* Pure sizing and naming rules, shared with the module tests. */
(() => {
 'use strict';
 function dimension(value,mode,rounding='nearest') {
  if(!Number.isFinite(value)||value<=0)throw Error('尺寸必须大于 0');
  let low,high;
  if(mode==='multiple16'){low=Math.max(16,Math.floor(value/16)*16);high=Math.max(16,Math.ceil(value/16)*16);}
  else if(mode==='power2'){low=2**Math.max(0,Math.floor(Math.log2(value)));high=2**Math.max(0,Math.ceil(Math.log2(value)));}
  else throw Error('未知尺寸规则');
  const result=rounding==='up'?high:rounding==='down'?low:rounding==='nearest'?(Math.abs(value-low)<Math.abs(high-value)?low:high):NaN;
  if(!Number.isFinite(result)||result>8192)throw Error('输出尺寸需在 1–8192 像素范围');
  return result;
 }
 function clean(value){return String(value??'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().replace(/[ .]+$/g,'');}
 function plan(nodes,settings){
  const counts=new Map(),prefix=clean(settings.prefix),middle=clean(settings.middle);
  if(prefix.length+middle.length>120)throw Error('前缀和中间名称过长');
  const stem=prefix+middle+(middle&&!middle.endsWith('_')?'_':'');
  return nodes.map(node=>{
   const width=dimension(Number(settings.manualSize?settings.manualWidth:node.width),settings.mode,settings.rounding),height=dimension(Number(settings.manualSize?settings.manualHeight:node.height),settings.mode,settings.rounding);
   const key=width+'x'+height,index=(counts.get(key)||0)+1;counts.set(key,index);
   return {node,width,height,stem,sequence:index,name:stem+key+'_'+String(index).padStart(3,'0')+'.png'};
  });
 }
 window.CanvasTextureRules=Object.freeze({dimension,clean,plan});
})();
