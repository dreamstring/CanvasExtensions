/* Figma 126.11.8: image-paint radio group and normal-flow filter rows.
 * Box is an extension paint editor; no unsupported enum is sent to Figma. */
(() => {
 'use strict';
 window.CanvasBoxPicker={create({root,onChoose,onNativeMode,isBox}){
  let disposed=false,queued=false,dialog=null,imageRadio=null,icon=null;
  const nativeState=new WeakMap();
  const hiddenRows=new Map();let modeLabel=null,modeText='';
  function restoreAppearance(){for(const [row,display]of hiddenRows)row.style.display=display;hiddenRows.clear();if(modeLabel?.isConnected&&modeLabel.textContent==='Box')modeLabel.textContent=modeText;modeLabel=null;}
  const nine='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5" stroke="currentColor"/><path d="M9.5 6v12M14.5 6v12M6 9.5h12M6 14.5h12" stroke="currentColor"/></svg>';
  const isImage=el=>el.value==='IMAGE'||el.getAttribute('aria-label')==='Image'||el.id?.endsWith('-IMAGE');
  function restoreRadio(){const state=imageRadio&&nativeState.get(imageRadio);if(state&&imageRadio.isConnected){if(state.checked===null)imageRadio.removeAttribute('aria-checked');else imageRadio.setAttribute('aria-checked',state.checked);if(state.state!==null)imageRadio.setAttribute('data-state',state.state);if(imageRadio.checked)imageRadio.parentElement.className=state.wrapperClass;}if(imageRadio)nativeState.delete(imageRadio);}
  function update(){
   if(disposed)return;
   const next=[...document.querySelectorAll('[role="dialog"] input[type="radio"],[role="dialog"] [role="radio"]')].find(isImage);
   if(next!==imageRadio){restoreAppearance();restoreRadio();icon?.remove();icon=null;imageRadio=next;dialog=next?.closest('[role="dialog"]')||null;}
   if(!imageRadio||!dialog){root.remove();return;}
   const group=imageRadio.closest('fieldset,[role="radiogroup"]');if(!group){root.remove();return;}
   if(!icon?.isConnected){
    icon=document.createElement('button');icon.type='button';icon.className=imageRadio.parentElement.className;for(const c of [...icon.classList])if(c.includes('fillTypeSelected'))icon.classList.remove(c);const nativeStyle=getComputedStyle(imageRadio.parentElement);icon.style.cssText='appearance:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;padding:0;border:0;margin:0;background:transparent;color:inherit;cursor:pointer';icon.style.width=nativeStyle.width;icon.style.height=nativeStyle.height;icon.style.borderRadius=nativeStyle.borderRadius;icon.dataset.canvasBoxType='true';icon.setAttribute('aria-label','Box');icon.setAttribute('title','Box · 九宫格');icon.setAttribute('role','radio');icon.setAttribute('tabindex','0');icon.innerHTML=nine;
    const choose=event=>{event.preventDefault();event.stopPropagation();if(!imageRadio.checked&&imageRadio.getAttribute('aria-checked')!=='true'&&!isBox())imageRadio.click();onChoose();schedule();};
    icon.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();},true);icon.addEventListener('click',choose,true);icon.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')choose(event);});
    icon.onpointerenter=()=>{icon.style.background='var(--color-bg-hover,#383838)';};icon.onpointerleave=()=>{icon.style.background=isBox()?'var(--color-bg-selected,#383838)':'';};group.append(icon);
   }
   const active=isBox();icon.setAttribute('aria-checked',String(active));icon.setAttribute('data-state',active?'checked':'unchecked');icon.style.background=active?'var(--color-bg-selected,#383838)':'';
   if(active){if(!nativeState.has(imageRadio))nativeState.set(imageRadio,{checked:imageRadio.getAttribute('aria-checked'),state:imageRadio.getAttribute('data-state'),wrapperClass:imageRadio.parentElement.className});for(const c of [...imageRadio.parentElement.classList])if(c.includes('fillTypeSelected'))imageRadio.parentElement.classList.remove(c);if(imageRadio.getAttribute('aria-checked')!=='false')imageRadio.setAttribute('aria-checked','false');if(imageRadio.getAttribute('data-state')==='checked')imageRadio.setAttribute('data-state','unchecked');}else restoreRadio();
   if(!active)restoreAppearance();
   const trigger=[...dialog.querySelectorAll('[role="combobox"]')].find(el=>/^(Fill|Fit|Crop|Tile|Box)$/.test(el.textContent.trim()));
   if(!trigger){root.remove();return;}
   if(active){const label=[...trigger.querySelectorAll('span')].find(el=>/^(Fill|Fit|Crop|Tile)$/.test(el.textContent.trim()));if(label){modeLabel=label;modeText=label.textContent;label.textContent='Box';}}
   const labels=[...dialog.querySelectorAll('div,span,label')];let filter=labels.reverse().find(el=>/^(Exposure|曝光)$/.test(el.textContent.trim()));const contrast=labels.find(el=>/^(Contrast|对比度)$/.test(el.textContent.trim()));
   if(!filter||!contrast){root.remove();return;}
   while(filter.parentElement&&filter.parentElement!==dialog&&!filter.parentElement.contains(contrast))filter=filter.parentElement;
   if(root.nextElementSibling!==filter)filter.before(root);root.hidden=!active;root.style.display=active?'block':'none';
   if(active){for(const label of labels.filter(el=>/^(Exposure|Contrast|Saturation|Temperature|Tint|Highlights|Shadows|曝光|对比度|饱和度|色温|色调|高光|阴影)$/.test(el.textContent.trim()))){let row=label;while(row.parentElement&&row.parentElement!==filter.parentElement&&row.parentElement!==dialog)row=row.parentElement;if(row.parentElement===filter.parentElement&&!row.contains(root)){if(!hiddenRows.has(row))hiddenRows.set(row,row.style.display);row.style.display='none';}}}
  }
  function schedule(){if(queued||disposed)return;queued=true;queueMicrotask(()=>{queued=false;update();});}
  function nativeSelection(event){
   if(event.type==='keydown'&&event.key!=='Enter'&&event.key!==' ')return;
   const option=event.target.closest?.('[role="option"][data-fpl-select-value]');if(option&&isBox()&&document.getElementById(option.closest('[role="listbox"]')?.id)===document.getElementById(dialog?.querySelector('[role="combobox"]')?.getAttribute('aria-controls'))){restoreAppearance();onNativeMode();}
   const radio=event.target.closest?.('input[type="radio"],[role="radio"]')||event.target.closest?.('[class*="fillTypeButton"]')?.querySelector('input[type="radio"]');if(radio&&!radio.hasAttribute('data-canvas-box-type')&&radio.closest('fieldset,[role="radiogroup"]')===imageRadio?.closest('fieldset,[role="radiogroup"]')&&isBox()){restoreAppearance();restoreRadio();onNativeMode();}
  }
  const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true});document.addEventListener('pointerdown',nativeSelection,true);document.addEventListener('keydown',nativeSelection,true);
  return {update,dispose(){disposed=true;observer.disconnect();document.removeEventListener('pointerdown',nativeSelection,true);document.removeEventListener('keydown',nativeSelection,true);restoreAppearance();restoreRadio();icon?.remove();root.remove();}};
 }};
})();
