/* Browser-level contract for authors mixing a composed panel, reactive state and custom DOM. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {browserFixture,runtimeSource} = require('./ui-browser-fixture.cjs');
const manifest = require('../templates/sdk-playground/module.json');
const template = manifest.scripts.map(name=>fs.readFileSync('templates/sdk-playground/'+name,'utf8')).join('\n;');
const html = `<!doctype html><meta charset=utf-8><style>:root{color-scheme:dark}body{margin:0;background:#2c2c2c;color:#fff}aside{width:410px}</style><body>
<aside aria-label="Right sidebar"><section><h2>Fill</h2></section><section><h2>Export</h2></section></aside>
<script>window.figma={currentPage:{selection:[]},on(){},off(){}};
${runtimeSource()}
window.FigmaExtensions.begin(${JSON.stringify(manifest.id)},${JSON.stringify(manifest.commands)});
${template}
window.FigmaExtensions.end();
</script>`;

async function exercise({evaluate,send}) {
 await send('Emulation.setDeviceMetricsOverride',{width:1024,height:1100,deviceScaleFactor:2,mobile:false});
 await evaluate(()=>{
  const find = root => {
   if (root.querySelector('[aria-label="Left guide"]')) return root;
   for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) {const found=find(element.shadowRoot);if(found)return found;}
   }
  };
  const panel=find(document);
  if (!panel) throw Error('Playground did not mount in the right sidebar');
  window.field=(selector,label)=>[...panel.querySelectorAll(selector)].find(el=>!label||el.getAttribute('aria-label')===label);
  const section=panel.host.closest('section') || panel.host.getRootNode().host;
  const header=section.shadowRoot;
  const toggle=header.querySelector('button[aria-expanded]');
  if(toggle?.getAttribute('aria-expanded')!=='false')throw Error('Playground must start collapsed');
  section.style.setProperty('--color-text-secondary','rgb(177, 178, 179)');
  section.style.setProperty('--color-icon','rgb(240, 241, 242)');
  const ink=()=>getComputedStyle(toggle.querySelector('path')).fill;
  if(ink()!=='rgb(177, 178, 179)')throw Error('collapsed plus must match the muted heading');
  toggle.parentElement.dispatchEvent(new Event('pointerenter'));
  if(ink()!==getComputedStyle(toggle.parentElement).color)throw Error('hovered plus must follow its heading');
  toggle.parentElement.dispatchEvent(new Event('pointerleave'));
  toggle.click();
  if(ink()!=='rgb(240, 241, 242)')throw Error('expanded minus must retain the primary icon color');
  section.style.removeProperty('--color-text-secondary');section.style.removeProperty('--color-icon');
  if(toggle.getAttribute('aria-expanded')!=='true')throw Error('Playground must expand');
  toggle.click();toggle.click();
  window.left=field('button','Left guide');
  window.choose=(label,value)=>{
   const select=field('select',label);
   if (!select || select.disabled || !select.getClientRects().length) throw Error('Unavailable select '+label);
   select.value=value;
   select.dispatchEvent(new Event('change',{bubbles:true}));
  };
  window.panel=panel;
 });
 const key = async (name,code,keyCode) => {
  for (const type of ['rawKeyDown','keyUp']) await send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:keyCode});
 };
 async function mouse(type,x,y) {
  const params={type,x,y,button:'left',buttons:type==='mouseReleased'?0:1};
  if(type!=='mouseMoved')params.clickCount=1;
  await send('Input.dispatchMouseEvent',params);
 }
 async function capturePanel(name) {
  const clip = await evaluate(()=>{
   let section=left.getRootNode().host;
   while(section && section.tagName!=='SECTION')section=section.getRootNode().host;
   const rect=section.getBoundingClientRect();
   return {x:rect.left+scrollX,y:rect.top+scrollY,width:rect.width,height:rect.height,scale:1};
  });
  const screenshot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});
  fs.writeFileSync('artifacts/sdk-playground-browser/'+name+'.png',Buffer.from(screenshot.data,'base64'));
 }
 const read=()=>evaluate(()=>({
  left:Number(left.getAttribute('aria-valuenow')),
  right:Number(field('button','Right guide').getAttribute('aria-valuenow')),
  number:field('input[type=number]','Left (%)').valueAsNumber,
  range:field('input[type=range]','Left (%)').valueAsNumber,
  enabled:!left.disabled && !field('input[type=range]','Left (%)').disabled,
  preset:field('select','预设').value
 }));
 assert.deepEqual(await read(),{left:20,right:20,number:20,range:20,enabled:true,preset:'balanced'});
 await evaluate(()=>choose('预设','asymmetric'));
 assert.deepEqual(await read(),{left:12,right:32,number:12,range:12,enabled:true,preset:'asymmetric'});
 const pos=await evaluate(()=>{
  left.scrollIntoView({block:'center'});
  const grip=left.getBoundingClientRect(),board=left.parentElement.getBoundingClientRect();
  return {x:grip.x+grip.width/2,y:grip.y+grip.height/2,endX:board.x+.44*board.width};
 });
 await mouse('mousePressed',pos.x,pos.y);await mouse('mouseMoved',pos.endX,pos.y);await mouse('mouseReleased',pos.endX,pos.y);
 assert.deepEqual(await read(),{left:44,right:32,number:44,range:44,enabled:true,preset:'custom'});
 await key('ArrowRight','ArrowRight',39);
 assert.equal((await read()).number,45,'trusted arrow input should move the focused guide');
 await evaluate(()=>field('button','Right guide').focus());
 await key('ArrowLeft','ArrowLeft',37);
 assert.equal((await read()).right,33,'right margin increases when its guide moves left');

 await evaluate(()=>{const input=field('input[type=number]','Left (%)');input.focus();input.select();});
 await send('Input.insertText',{text:'26'});
 await key('Enter','Enter',13);
 assert.equal((await read()).left,26,'numeric margin should move the guide');
 await evaluate(()=>field('input[type=range]','Left (%)').focus());
 await key('ArrowRight','ArrowRight',39);
 assert.equal((await read()).left,27,'native slider should move the custom guide');
 await capturePanel('panel');


 await evaluate(()=>field('input[type=checkbox]','编辑边距').click());
 assert.equal(await evaluate(()=>left.disabled && field('input[type=number]','Left (%)').disabled && field('input[type=range]','Left (%)').disabled),true);
 await evaluate(()=>field('button','重置').click());
 assert.equal((await read()).left,20,'reset button should restore defaults');
 await evaluate(()=>{left.focus();});
 await key('ArrowRight','ArrowRight',39);
 await evaluate(()=>FigmaExtensions.command('sdk-playground','reset'));
 assert.deepEqual(await read(),{left:20,right:20,number:20,range:20,enabled:true,preset:'balanced'});
 await evaluate(()=>choose('测试场景','browser'));
 assert.equal(await evaluate(()=>field('[data-browser-detail]').textContent.includes('Arrow Right')),true);
 await evaluate(()=>choose('类别','texture'));
 await evaluate(()=>field('button','Grid').click());
 assert.equal(await evaluate(()=>field('[data-browser-detail]').textContent.includes('Grid')),true);
 await evaluate(()=>{
  const listButton = [...panel.querySelectorAll('button')].find(el=>el.textContent==='列表' && el.getClientRects().length);
  listButton.click();
 });
 assert.equal(await evaluate(()=>!!panel.querySelector('[data-browser-view="list"]')),true);
 await capturePanel('browser');
 await evaluate(()=>{
  const search=field('input','搜索素材');search.focus();search.select();
 });
 await send('Input.insertText',{text:'missing-asset-fixture'});
 assert.equal(await evaluate(()=>field('[data-browser-detail]').hidden && panel.textContent.includes('没有匹配的素材')),true);
 await evaluate(()=>{const search=field('input','搜索素材');search.value='Paper';search.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await evaluate(()=>field('[data-browser-detail]').textContent.includes('Paper Grain')),true);

 await evaluate(()=>choose('测试场景','curve'));
 await evaluate(()=>choose('缓动预设','ease'));
 const curvePath=()=>evaluate(()=>field('[data-curve-path]').getAttribute('d'));
 assert.equal(await curvePath(),'M0 100 C25 90 25 0 100 0');
 await evaluate(()=>field('[data-curve-point="2"]').focus());
 await key('ArrowRight','ArrowRight',39);
 assert.equal(await evaluate(()=>field('input[type=number]','P2 · X (%)').valueAsNumber),26);
 assert.equal(await evaluate(()=>field('select','缓动预设').value),'custom');
 await evaluate(()=>{const n=field('input[type=number]','P2 · X (%)');n.focus();n.select();});
 await send('Input.insertText',{text:'52'});
 await key('Enter','Enter',13);
 assert.equal(await curvePath(),'M0 100 C25 90 52 0 100 0');
 await capturePanel('curve');

 await evaluate(()=>choose('测试场景','queue'));
 const originalJobs=await evaluate(()=>field('[aria-label="模拟输出队列"]').querySelectorAll('li').length);
 await evaluate(()=>field('button','添加任务').click());
 assert.equal(await evaluate(()=>field('[aria-label="模拟输出队列"]').querySelectorAll('li').length),originalJobs+1);
 await evaluate(()=>field('button','开始队列').click());
 assert.equal(await evaluate(()=>panel.textContent.includes('运行中')),true);
 await evaluate(()=>field('button','取消运行').click());
 const waitForQueue = async expected=>{
  const start=Date.now();
  while(!await evaluate(text=>[...panel.querySelectorAll('*')].some(el=>el.childElementCount===0 && el.getClientRects().length && el.textContent.startsWith(text+' · ')),expected)){
   if(Date.now()-start>7000)throw Error('Queue did not reach '+expected);
   await new Promise(resolve=>setTimeout(resolve,40));
  }
 };
 await waitForQueue('已取消');
 await evaluate(()=>field('button','开始队列').click());
 await waitForQueue('已完成');
 assert.equal(await evaluate(()=>Array.from(field('[aria-label="模拟输出队列"]').querySelectorAll('li')).every(row=>row.textContent.endsWith('已完成'))),true);

 await evaluate(()=>choose('测试场景','commands'));
 await evaluate(()=>field('button','增加标记').click());
 await evaluate(()=>field('button','执行命令').click());
 assert.equal(await evaluate(()=>panel.textContent.includes('已添加标记 1')),true);
 await evaluate(()=>{const search=field('input','搜索命令');search.focus();search.select();});
 await send('Input.insertText',{text:'no-matching-command'});
 assert.equal(await evaluate(()=>field('button','执行命令').disabled),true);

 await evaluate(()=>choose('测试场景','layers'));
 const layerToggles=()=>evaluate(()=>({
  locked:field('input[type=checkbox]','标题 锁定').checked,
  visible:field('input[type=checkbox]','标题 可见').checked
 }));
 assert.deepEqual(await layerToggles(),{locked:false,visible:true});
 await evaluate(()=>field('input[type=checkbox]','标题 锁定').click());
 await evaluate(()=>field('input[type=checkbox]','标题 可见').click());
 assert.deepEqual(await layerToggles(),{locked:true,visible:false});
 assert.equal(await evaluate(()=>panel.textContent.includes('可见 2 / 3 · 锁定 2 / 3')),true);
 await require('./panel-form-scenarios.cjs')(evaluate);
 for(const scene of ['toolbar','queue','wizard','commands','layers']){
  await evaluate(value=>choose('测试场景',value),scene);
  await capturePanel(scene);
 }
 await evaluate(()=>FigmaExtensions.dispose());
 assert.equal(await evaluate(()=>left.isConnected),false);
 const after=await evaluate(()=>localStorage.getItem('canvasExtensions.sdk-playground'));
 await evaluate(()=>left.dispatchEvent(new KeyboardEvent('keydown',{key:'End'})));
 assert.equal(await evaluate(()=>localStorage.getItem('canvasExtensions.sdk-playground')),after,'disposed listeners must not save edits');
}

browserFixture('sdk-playground-browser',html,exercise)
 .then(()=>console.log('PASS Chromium SDK Playground: guides, searchable assets, editable curves, queue completion/cancellation, command search/execution, layer visibility/locks, toolbar, wizard and unload'))
 .catch(error=>{console.error(error);process.exitCode=1;});
