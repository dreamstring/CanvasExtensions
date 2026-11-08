/* UI adapter: passive computed-style sampling. Never invokes Figma handlers. */
(() => {
 'use strict';
 const host=window.FigmaExtensions,roots=new Set();let report={source:'fallback',samples:{}};
 const properties=['fontFamily','fontSize','fontWeight','lineHeight','height','borderRadius','color','backgroundColor','borderColor'];
 const arrowData=color=>{const source=host.componentReference?.icons.chevronDown;if(!source)return null;return 'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+source.viewBox+'">'+source.paths.map(path=>'<path d="'+path.d+'" fill="'+color+'"/>').join('')+'</svg>')+'")';};
 const css=`
 :host{font-size:var(--text-body-medium-font-size,11px)!important;font-weight:var(--text-body-medium-font-weight,450)!important;--ce-font:Inter,Segoe UI,sans-serif;--ce-label-size:var(--text-body-small-font-size,9px);--ce-control-size:11px;--ce-control-height:24px;--ce-radius:5px}
 :host>div:first-of-type{font-size:var(--text-body-medium-font-size,11px)!important;font-weight:var(--font-weight-strong,550)!important}
 label{font-family:var(--ce-font)!important;font-size:var(--ce-label-size)!important;line-height:16px!important;color:var(--color-text-secondary,#b3b3b3)!important}
 label:has(input[type=checkbox]){font-size:var(--text-body-medium-font-size,11px)!important}
 input:not([type=checkbox]):not([type=range]),select,button{font-family:var(--ce-font)!important;font-size:var(--ce-control-size)!important;height:var(--ce-control-height)!important;border-radius:var(--ce-radius)!important;line-height:normal!important}
 input:not([type=checkbox]):not([type=range]),select{padding:0 8px!important;background-color:var(--color-bg-secondary,#383838)!important;border:1px solid transparent!important}
 input:focus,select:focus{border-color:var(--color-border-selected,#0d99ff)!important;outline:none!important}
 select{background-image:var(--ce-chevron-image)!important;appearance:none!important;padding-right:24px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='m2 3 2 2 2-2' fill='none' stroke='%23b3b3b3' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important;background-position:right 0 center!important;background-size:24px 24px!important;background-repeat:no-repeat!important}
 select{background-image:var(--ce-chevron-image)!important}
 input[type=checkbox]{appearance:none!important;display:inline-block!important;width:14px!important;height:14px!important;border:1px solid var(--color-border-strong,#888)!important;border-radius:2px!important;background:transparent!important;padding:0!important;flex:none!important}
 input[type=checkbox]:checked{background-color:var(--color-bg-selected,#444)!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='m2.5 6 2.5 2.5 4.5-5' fill='none' stroke='white' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}
 input:disabled,select:disabled,button:disabled{cursor:default!important;color:var(--color-text-disabled,#777)!important}
 summary{font-family:var(--ce-font)!important;font-size:var(--text-body-medium-font-size,11px)!important;font-weight:var(--font-weight-strong,550)!important;line-height:16px!important;min-height:32px!important;gap:0!important}summary>.preview-chevron{width:16px!important;height:16px!important;flex:0 0 16px!important}
 button.ce-section-toggle{width:24px!important;height:24px!important;min-width:24px!important;padding:0!important;border:0!important;background:transparent!important;border-radius:var(--radius-medium,5px)!important}button.ce-section-toggle:hover{background:var(--color-bg-transparent-hover,var(--color-bg-hover,#383838))!important}button.ce-section-toggle:active{background:var(--color-bg-transparent-pressed,var(--color-bg-pressed,#444))!important}button.ce-section-toggle svg{width:24px!important;height:24px!important}button{font-weight:var(--text-body-medium-font-weight,450)!important}button:focus-visible,summary:focus-visible{outline:2px solid var(--color-border-selected,#0d99ff);outline-offset:1px}
 `;
 function capture(element){if(!element)return null;const s=getComputedStyle(element);return Object.fromEntries(properties.map(p=>[p,s[p]]));}
 function sample(){
  const side=document.querySelector('[aria-label="Right sidebar"]');if(!side)return;
  const visible=el=>el.getBoundingClientRect().height>0&&!el.closest('[data-figma-extensions]');
  const input=[...side.querySelectorAll('input:not([type=checkbox])')].find(visible);
  const label=[...side.querySelectorAll('label')].find(visible);
  const button=[...side.querySelectorAll('button,[role=button]')].filter(visible).find(el=>/^(Export|导出)\s+/.test(el.textContent.trim()));
  const samples={input:capture(input),label:capture(label),exportButton:capture(button)};
  report={source:input||label||button?'live-computed-style':'fallback',samples};
  for(const root of roots){
   if(!root.host?.isConnected)continue;
   if(host.componentKit)for(const summary of root.querySelectorAll('summary')){const old=summary.querySelector('.preview-chevron');if(old&&!old.dataset.ceNative){const next=host.componentKit.icon('chevronRight');next.classList.add('preview-chevron');next.dataset.ceNative='1';old.replaceWith(next);}}
   const vars={};const arrow=arrowData(getComputedStyle(side).getPropertyValue('--color-icon').trim()||'#b3b3b3');if(arrow)vars['--ce-chevron-image']=arrow;if(samples.input){const size=parseFloat(samples.input.fontSize),height=parseFloat(samples.input.height);vars['--ce-font']=samples.input.fontFamily;if(size>=9&&size<=14)vars['--ce-control-size']=samples.input.fontSize;if(height>=20&&height<=32)vars['--ce-control-height']=samples.input.height;}
   for(const [key,value]of Object.entries(vars))root.host.style.setProperty(key,value);
  }
 }
 function reference(includeRules=true){
  const side=document.querySelector('[aria-label="Right sidebar"]');if(!side)return null;
  const fields=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','height','minHeight','width','minWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','gap','borderRadius','borderWidth','borderColor','color','backgroundColor','opacity','display','alignItems','justifyContent'];
  const controls=[...side.querySelectorAll('button,[role=button],input,select,label,summary,[role=checkbox],[role=combobox],[role=slider]')].filter(el=>!el.closest('[data-figma-extensions]')&&el.getBoundingClientRect().height>0).slice(0,200).map(el=>{const s=getComputedStyle(el);return {tag:el.tagName,role:el.getAttribute('role'),type:el.type||null,classes:[...el.classList],disabled:el.disabled===true||el.getAttribute('aria-disabled')==='true',checked:el.type==='checkbox'?el.checked:undefined,focused:el.matches(':focus'),hovered:el.matches(':hover'),style:Object.fromEntries(fields.map(key=>[key,s[key]])),icons:[...el.querySelectorAll('svg')].slice(0,3).map(svg=>({width:svg.getBoundingClientRect().width,height:svg.getBoundingClientRect().height,viewBox:svg.getAttribute('viewBox'),paths:[...svg.querySelectorAll('path')].slice(0,8).map(path=>({d:path.getAttribute('d'),fill:path.getAttribute('fill'),stroke:path.getAttribute('stroke'),strokeWidth:path.getAttribute('stroke-width')}))}))};});
  const style=getComputedStyle(side),tokens={};for(let i=0;i<style.length;i++){const key=style[i];if(/^--(color|spacer|radius|text-|font-)/.test(key))tokens[key]=style.getPropertyValue(key).trim();}
  const stylesheets=[],rules=[];if(includeRules){for(const sheet of document.styleSheets){const item={href:sheet.href?.split('?')[0]||'inline',readable:false,count:0};try{const visit=(list,context=[])=>{for(const rule of list){if(rule.selectorText&&rule.style){rules.push({selector:rule.selectorText,declarations:rule.style.cssText,context});item.count++;}else if(rule.cssRules)visit(rule.cssRules,[...context,rule.cssText.slice(0,rule.cssText.indexOf('{')).trim()]);}};visit(sheet.cssRules);item.readable=true;}catch(_){item.reason='cross-origin-or-unavailable';}stylesheets.push(item);}}
  return {schemaVersion:1,capturedAt:new Date().toISOString(),scope:'native right-sidebar styles only; no input values or document text',theme:document.documentElement.getAttribute('class'),fplVersion:document.documentElement.getAttribute('data-fpl-version'),tokens,controls,stylesheets,rules};
 }
 const timer=typeof setInterval==='function'?setInterval(sample,1500):null;
 host.ui=Object.freeze({icon:name=>host.componentKit.icon(name),compose:spec=>host.componentKit.compose(spec),source:()=>host.componentReference?.evidence,install(shadow){const style=document.createElement('style');const arrow=arrowData('#b3b3b3');if(arrow)shadow.host.style.setProperty('--ce-chevron-image',arrow);style.dataset.canvasNativeUi='1';style.textContent=css;shadow.append(style);roots.add(shadow);sample();return ()=>roots.delete(shadow);},sample,reference,inspect:()=>JSON.parse(JSON.stringify(report)),dispose(){if(timer!==null)clearInterval(timer);roots.clear();}});
})();
