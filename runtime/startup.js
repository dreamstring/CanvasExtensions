/* Early read-only UI: no scene API or image bytes required. */
(() => {
 'use strict';
 if(window.FigmaAssistant?.isLive?.() || window.FigmaGifStartup)return;
 const root=document.createElement('section');root.dataset.figmaGifStartup='pending';
 Object.assign(root.style,{width:'100%',minWidth:'0',gridColumn:'1 / -1',flex:'0 0 auto',borderTop:'1px solid var(--color-border,#444)',background:'var(--color-bg,#2c2c2c)',color:'var(--color-text,#fff)',font:'12px Inter,Segoe UI,sans-serif'});
 const shadow=root.attachShadow({mode:'open'});
 shadow.innerHTML='<style>*{box-sizing:border-box}header{height:40px;padding:0 16px;display:flex;align-items:center;font-weight:600}.body{padding:0 16px 12px}.row{display:flex;height:24px;border-radius:5px;overflow:hidden;background:var(--color-bg-secondary,#383838)}button{all:unset;flex:1;text-align:center;font:12px Inter,Segoe UI,sans-serif;opacity:.4}button+button{border-left:1px solid var(--color-bg,#2c2c2c)}p{font-size:11px;line-height:16px;color:var(--color-text-secondary,#aaa);margin:8px 0 0}</style><header>GIF preview</header><div class="body"><div class="row"><button disabled>Preview</button><button disabled>Stop</button></div><p role="status">扩展已加载，正在等待编辑器…</p></div>';
 let disposed=false;
 const label=el=>(el.getAttribute('aria-label')||el.textContent||'').trim();
 function place(){
  if(disposed)return;
  const side=document.querySelector('[aria-label="Right sidebar"]');if(!side){root.remove();return;}
  const labels=[...side.querySelectorAll('button,[role="button"],h2,h3,div,span')].filter(el=>!root.contains(el));
  if(!labels.some(el=>/^(GIF|Image|图片|图像)$/.test(label(el)))){root.remove();return;}
  const control=[...side.querySelectorAll('button,[role="button"],h2,h3')].find(el=>/^(Export|导出)$/.test(label(el)));
  const neighbors=labels.filter(el=>/^(Effects|Stroke|Fill|Appearance|Layout|Position|Styles|Page|效果|描边|填充|外观|布局|位置|样式|页面)$/.test(label(el)));
  if(!control||!neighbors.length){root.remove();return;}
  let anchor=control;
  while(anchor.parentElement&&anchor.parentElement!==side){if(neighbors.some(el=>anchor.parentElement.contains(el)))break;anchor=anchor.parentElement;}
  if(anchor===control){root.remove();return;}
  if(root.previousElementSibling!==anchor)anchor.after(root);
 }
 const observer=new MutationObserver(place);observer.observe(document.documentElement,{childList:true,subtree:true});
 window.FigmaGifStartup={dispose(){if(disposed)return;disposed=true;observer.disconnect();root.remove();delete window.FigmaGifStartup;}};
 place();
})();
