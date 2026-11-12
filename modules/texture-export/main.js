/* Texture export module: reads the original selection; never resizes design nodes. */
(() => {
 'use strict';
 const id='texture-export',host=window.FigmaExtensions,api=window.figma,rules=window.CanvasTextureRules;
 const section=host.sdk.panel(id,{title:'Texture export',collapsible:true,collapsed:true});
 const defaults={mode:'multiple16',rounding:'nearest',roundingByMode:{multiple16:'nearest',power2:'up'},prefix:'T_UI_',middle:'',directory:'',manualSize:false,manualWidth:'64',manualHeight:'64'};
 const preferences=host.sdk.settings(id,defaults,'canvasExtensions.textureExport'),settings=preferences.value;
 for(const key of ['prefix','middle','directory'])settings[key]=String(settings[key]??'');
 if(!['multiple16','power2'].includes(settings.mode))settings.mode='multiple16';
 settings.roundingByMode={multiple16:'nearest',power2:'up',...(settings.roundingByMode||{})};for(const mode of ['multiple16','power2'])if(!['nearest','up','down'].includes(settings.roundingByMode[mode]))settings.roundingByMode[mode]=mode==='power2'?'up':'nearest';settings.rounding=settings.roundingByMode[settings.mode];let roundingSelect;
 const lifecycle=host.sdk.scope(api),services=host.sdk.services;
 const files=services.exportFiles(id,{native:(module,operation,payload)=>host.nativeRequest(module,operation,payload)});
 let disposed=false,busy=false,cancelled=false,selected=[],lastError='',completed=0;
 const style=document.createElement('style');
 style.textContent=`summary::-webkit-details-marker{display:none}.preview-chevron{flex:none;color:var(--color-icon-secondary,#888)}details[open] .preview-chevron{transform:rotate(90deg)}summary:hover{color:var(--color-text,#fff)!important}*{box-sizing:border-box}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{min-width:0}label>input,label>select{display:block;margin-top:6px}label{display:block;font-size:11px;color:var(--color-text-secondary,#aaa);margin-bottom:6px}input,select,button{font:12px Inter,Segoe UI,sans-serif;color:var(--color-text,#fff)}input,select{width:100%;min-width:0;height:28px;background:var(--color-bg-secondary,#383838);border:1px solid transparent;border-radius:5px;padding:0 8px;outline:none}input:focus,select:focus{border-color:var(--color-border-selected,#0d99ff)}select option{background:var(--color-bg,#2c2c2c);color:var(--color-text,#fff)}input:disabled,select:disabled{color:var(--color-text-disabled,#777);cursor:not-allowed}.manual-disabled{opacity:.4}.row{margin-top:12px}.examples{font-size:11px;line-height:18px;color:var(--color-text-secondary,#aaa);overflow-wrap:anywhere;max-height:108px;overflow:auto}.original{opacity:.7}.name{color:var(--color-text,#fff)}.hint{font-size:11px;line-height:16px;color:var(--color-text-secondary,#aaa);margin:8px 0 0}.actions{display:flex;gap:8px;margin-top:12px}button{height:28px;border:0;border-radius:5px;padding:0 10px;background:var(--color-bg-secondary,#383838);cursor:pointer}button:hover{filter:brightness(1.12)}button:disabled{opacity:.4;cursor:default}.export{flex:1}button:focus-visible{outline:2px solid var(--color-border-selected,#0d99ff);outline-offset:1px}.state{font-size:11px;line-height:17px;margin-top:8px;color:var(--color-text-secondary,#aaa)}`;
 section.body.append(style);
 function field(parent,labelText,control){const wrap=document.createElement('div');wrap.className='field';const label=document.createElement('label');label.textContent=labelText;label.append(control);wrap.append(label);parent.append(wrap);return control;}
 function input(key,placeholder=''){const element=document.createElement('input');element.type='text';element.value=settings[key];element.placeholder=placeholder;element.setAttribute('aria-label',key);element.addEventListener('input',()=>{settings[key]=element.value;save();render();});return element;}
 function select(key,values){const element=document.createElement('select');for(const [value,text]of values){const option=document.createElement('option');option.value=value;option.textContent=text;element.append(option);}element.value=settings[key];element.addEventListener('change',()=>{settings[key]=element.value;if(key==='mode'){settings.rounding=settings.roundingByMode[settings.mode];roundingSelect.value=settings.rounding;}else if(key==='rounding'){settings.roundingByMode[settings.mode]=settings.rounding;}save();render();});return element;}
 const sizeRow=document.createElement('div');sizeRow.className='grid';section.body.append(sizeRow);
 field(sizeRow,'尺寸规则',select('mode',[['multiple16','16 倍数'],['power2','二次幂']]));
 roundingSelect=field(sizeRow,'取整方式',select('rounding',[['nearest','最近尺寸'],['down','向下取整'],['up','向上进位']]));
 const naming=document.createElement('div');naming.className='grid row';section.body.append(naming);
 field(naming,'前缀',input('prefix','T_UI_'));field(naming,'中间名称',input('middle','例如 xxx'));
 const pathRow=document.createElement('div');pathRow.className='row';section.body.append(pathRow);
 const directory=host.sdk.components.directoryField({value:settings.directory,placeholder:'例如 D:\\Textures\\UI',choose:value=>files.chooseFolder(value.trim()),onChange:value=>{settings.directory=value;save();render();},onError:error=>state.textContent=String(error.message||error)});pathRow.append(directory.root);lifecycle.add(()=>directory.dispose());

 const manualRow=document.createElement('div');manualRow.className='row';section.body.append(manualRow);const manualLabel=document.createElement('label');manualLabel.style.cssText='display:flex;align-items:center;gap:6px';const manualToggle=document.createElement('input');manualToggle.type='checkbox';manualToggle.checked=settings.manualSize===true;manualToggle.style.cssText='width:14px;height:14px;margin:0;accent-color:var(--color-bg-brand,#0d99ff)';manualLabel.append(manualToggle,document.createTextNode('手动尺寸'));manualRow.append(manualLabel);const manualFields=document.createElement('div');manualFields.className='grid';manualRow.append(manualFields);const manualWidth=field(manualFields,'宽度',input('manualWidth','64')),manualHeight=field(manualFields,'高度',input('manualHeight','64'));for(const control of [manualWidth,manualHeight]){control.type='number';control.min='1';control.step='1';}manualToggle.onchange=()=>{settings.manualSize=manualToggle.checked;save();render();};
 const previews=document.createElement('div');previews.className='examples row';section.body.append(previews);
 const actions=document.createElement('div');actions.className='actions';section.body.append(actions);
 const exportButton=document.createElement('button');exportButton.className='export';
 const cancelButton=document.createElement('button');cancelButton.textContent='取消';cancelButton.style.display='none';
 const openButton=document.createElement('button');openButton.textContent='打开目录';actions.append(exportButton,cancelButton,openButton);
 const previewView=host.sdk.components.preview(),previewPanel=previewView.root,previewArea=previewView.body;section.body.append(previewPanel);lifecycle.add(()=>previewView.dispose());const previewQueue=services.latestTask();previewPanel.ontoggle=()=>{if(previewPanel.open)schedulePreview();else{previewQueue.cancel('preview');previewArea.replaceChildren();}};function schedulePreview(){if(!previewPanel.open)return;previewQueue.run('preview',task=>updatePreview(task),{delay:250}).catch(error=>{if(!disposed)previewArea.textContent=String(error.message||error);});}async function updatePreview(task){try{const plan=rules.plan(currentSelection(),settings);if(!plan.length){previewArea.textContent='请选择对象';return;}previewArea.textContent='正在生成预览…';const item=plan[0];if(typeof item.node.exportAsync!=='function')throw Error('当前对象无法预览');const bytes=await item.node.exportAsync({format:'PNG',constraint:{type:'SCALE',value:1}});if(disposed||!task.current())return;const base64=await resizedPng(bytes,item.width,item.height);if(disposed||!task.current())return;const image=document.createElement('img');image.alt='输出图片预览';image.src='data:image/png;base64,'+base64;host.sdk.components.stylePreview(image);const caption=document.createElement('div');caption.style.cssText='font-size:11px;color:var(--color-text-secondary,#aaa)';caption.textContent=item.width+' × '+item.height+(plan.length>1?' · 首个选中对象':'');previewArea.replaceChildren(image,caption);}catch(error){if(!disposed&&task.current())previewArea.textContent=String(error.message||error);}}
 const state=document.createElement('div');state.className='state';state.setAttribute('role','status');state.setAttribute('aria-live','polite');section.body.append(state);
 function save(){try{preferences.save();}catch(_){}lastError='';}
 function currentSelection(){return [...api.currentPage.selection].filter(node=>!node.removed&&Number(node.width)>0&&Number(node.height)>0);}
 function render(){
  if(disposed)return;
  if(!busy)selected=currentSelection();
  previews.replaceChildren();let plan=[],planError='';
  try{plan=rules.plan(selected,settings);for(const item of plan.slice(0,3)){const row=document.createElement('div'),source=document.createElement('span'),name=document.createElement('span');source.className='original';source.textContent=`${Math.round(item.node.width)}×${Math.round(item.node.height)} → `;name.className='name';name.textContent=item.name;row.append(source,name);previews.append(row);}if(plan.length>3){const more=document.createElement('div');more.textContent=`另 ${plan.length-3} 个对象`;previews.append(more);}}
  catch(error){planError=String(error.message||error);}
  exportButton.textContent=busy?`正在导出 ${completed}/${selected.length}`:`导出 ${selected.length} 张 PNG`;
  exportButton.disabled=busy||!selected.length||!settings.directory.trim()||!plan.length||!!planError;
  openButton.disabled=busy||!settings.directory.trim();cancelButton.style.display=busy?'block':'none';cancelButton.disabled=!busy||cancelled;
  for(const element of section.body.querySelectorAll('input,select'))element.disabled=busy;
  directory.setDisabled(busy);
  manualFields.classList.toggle('manual-disabled',busy||!settings.manualSize);
  manualWidth.disabled=busy||!settings.manualSize;manualHeight.disabled=busy||!settings.manualSize;
  if(!busy)state.textContent=planError||lastError;
  section.show(busy||selected.length>0);if(!busy)schedulePreview();
 }
 const resizedPng=(bytes,width,height)=>services.resizePng(bytes,width,height);
 async function runExport(){
  if(disposed||busy)return;
  selected=currentSelection();if(!selected.length)throw Error('请先选择要导出的对象');
  const options={...settings,directory:settings.directory.trim()},plan=rules.plan(selected,options);
  busy=true;cancelled=false;completed=0;lastError='';let finishMessage='';render();
  try{
   if(selected.some(node=>typeof node.exportAsync!=='function'))throw Error('当前编辑器未提供所选对象的 exportAsync 导出接口');
   state.textContent='正在准备输出目录…';
   const result=await files.run(plan,{directory:options.directory,cancelled:()=>cancelled||disposed,
    onProgress:progress=>{completed=progress.completed;state.textContent='正在导出 '+(progress.index+1)+'/'+plan.length+'：'+progress.name;exportButton.textContent='正在导出 '+completed+'/'+plan.length;},
    encode:async item=>{const bytes=await host.sdk.capabilities.exportPng(item.node);if(cancelled||disposed)return '';return resizedPng(bytes,item.width,item.height);}});
   completed=result.completed;

   finishMessage=cancelled?`已取消，已保存 ${completed} 张 PNG`:`已导出 ${completed} 张 PNG`;
  }catch(error){completed=error.completed??completed;lastError=String(error.message||error);finishMessage=`已保存 ${completed} 张；${lastError}`;}
  finally{busy=false;if(!disposed){render();state.textContent=finishMessage;}}
  return {completed,error:lastError,cancelled};
 }
 exportButton.onclick=()=>{runExport().catch(error=>{lastError=String(error.message||error);render();});};
 cancelButton.onclick=()=>{cancelled=true;cancelButton.disabled=true;state.textContent='正在取消，已保存的文件会保留';};
 openButton.onclick=()=>{files.openFolder(settings.directory.trim()).catch(error=>{state.textContent=String(error.message||error);});};
 host.register(id,{commands:{exportSelection:runExport},status:()=>({sidebarMounted:section.root.isConnected,selected:selected.length,busy,completed,exportApiAvailable:selected.every(node=>typeof node.exportAsync==='function'),error:lastError}),dispose(){disposed=true;cancelled=true;previewQueue.dispose();selectionWatcher.dispose();lifecycle.dispose();section.dispose();}});
 const selectionWatcher=services.watchSelection(api,{delay:0,geometry:true,run(){if(!busy){lastError='';render();}}});
})();
