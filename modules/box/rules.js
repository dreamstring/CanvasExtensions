/* Pure nine-slice geometry. Margins are source-image pixels, not UV positions. */
(() => {
 'use strict';
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
 const rules={plan,pixels};if(typeof module!=='undefined')module.exports=rules;else window.CanvasBoxRules=rules;
})();
