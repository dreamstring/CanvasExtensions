/* Headless Chromium against disposable local HTML fixtures. Uses built-in Node WebSocket. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');

function runtimeSource() {
 const runtime = ['framework','component-reference','native-ui','services','editor-services','ui-model','ui-targets','pointer-input','collections','sdk','component-kit'];
 return runtime.map(name => fs.readFileSync('runtime/' + name + '.js','utf8')).join('\n;');
}

async function browserFixture(name, html, exercise) {
 const browser = process.env.CANVAS_CHROMIUM || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
 ].find(file => fs.existsSync(file));
 if (!browser) throw Error('Set CANVAS_CHROMIUM to a Chrome or Edge executable.');
 const folder = path.resolve('artifacts', name);
 fs.mkdirSync(folder, {recursive:true});
 const file = path.join(folder, 'index.html');
 fs.writeFileSync(file, html);
 const profile = fs.mkdtempSync(path.join(folder, 'profile-'));
 const child = spawn(browser,['--headless','--no-first-run','--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=0','--user-data-dir=' + profile, 'about:blank'],{windowsHide:true,stdio:'ignore'});
 const stopped = new Promise(resolve => {child.once('exit',resolve);child.once('error',resolve);});
 const deadline = Date.now()+30000;
 const timedOut = () => {if(Date.now()>deadline)throw Error(name + ' timed out');};
 let socket,send;
 try {
  const portFile = path.join(profile,'DevToolsActivePort');
  let port;
  while (!port) {
   if(child.exitCode !== null || !child.pid)throw Error('Could not launch Chromium');
   try {
    const raw = fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
    if (/^\d+$/.test(raw)) port=Number(raw);
   } catch (error) {
    if (!['ENOENT','EBUSY','EACCES'].includes(error.code)) throw error;
   }
   if (!port) {timedOut();await delay(40);}
  }
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const page = targets.find(target=>target.type==='page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  const pending = new Map();
  let serial=0;
  socket.onmessage=({data})=>{
   const {id,result,error}=JSON.parse(data);
   const done=pending.get(id);
   if(!done)return;
   pending.delete(id);
   if(error)done.reject(Error(error.message));else done.resolve(result);
  };
  send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++serial;
   pending.set(id,{resolve,reject});
   socket.send(JSON.stringify({id,method,params}));
  });
  async function evaluate(fn,...args) {
   const expression = '('+fn.toString()+')(...'+JSON.stringify(args)+')';
   const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
   if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
   return reply.result.value;
  }
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await send('Page.navigate',{url:pathToFileURL(file).href});
  let timeout;
  try {
   await Promise.race([new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(name+' timed out')),30000);}), (async()=>{
    while(!await evaluate(()=>location.protocol==='file:' && document.readyState==='complete')) {timedOut();await delay(30);}
    await exercise({evaluate, send});
   })()]);
  }finally{clearTimeout(timeout);}
 }finally{
  if(socket?.readyState===1 && send) {
   send('Browser.close').catch(()=>{});socket.close();
  }else child.kill();
  await Promise.race([stopped,delay(1500)]);
  if(child.exitCode===null)child.kill();
  // The fixture directory is fixed by this test, and the profile was created uniquely in it.
  if(path.dirname(profile)===folder)fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
}
module.exports={browserFixture,runtimeSource};
