const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), {EventEmitter} = require('node:events');
const template = fs.readFileSync('runtime/loader.cjs', 'utf8');
async function run({url='https://www.figma.com/design/test/example',wrongHash=false,ready=true,gifEnabled=true}={}) {
 const payload=Buffer.from('window.__testPayload=true;');const calls=[],errors=[],timers=new Map();let timerId=0;const app=new EventEmitter();
 const wc=new EventEmitter();wc.isDestroyed=()=>false;wc.getURL=()=>url;wc.isFocused=()=>true;
 wc.executeJavaScript=async source=>{calls.push(source);return ready;};
 app.whenReady=()=>Promise.resolve();
 const sockets=[];const net={createConnection(name){const s=new EventEmitter();s.writable=true;s.setEncoding=()=>{};s.write=()=>{};s.destroy=()=>{};sockets.push({name,s});return s;}};
 const electron={app,webContents:{getAllWebContents:()=>[wc]}};
 const source=template.replace('__NATIVE_MAP__','{}').replace('__NATIVE_EXPORT_FACTORY__','(()=>({handle:async()=>({}),disposeOwner(){}}))').replace('__STARTUP_SOURCE__',JSON.stringify('window.__earlyUi=true;')).replace('__COMMANDS__',JSON.stringify(gifEnabled?{gif:['previewSelection','stop']}:{})).replace('__PAYLOAD_PATH__',JSON.stringify('fixture-payload.js')).replace('__PAYLOAD_SHA256__',wrongHash?'bad':crypto.createHash('sha256').update(payload).digest('hex'));
 vm.runInNewContext(source,{require:name=>({electron,fs:{readFileSync:()=>payload},crypto,net,os:{userInfo:()=>({username:'Tester'})}}[name]),URL,console:{error:(...args)=>errors.push(args)},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},setInterval:()=>1,clearInterval(){}});
 await new Promise(resolve=>setImmediate(resolve));return {calls,errors,sockets,wc,timers,setReady:value=>{ready=value;},setURL:value=>{url=value;},async tick(){const first=timers.entries().next().value;if(!first)return false;timers.delete(first[0]);await first[1].fn();await new Promise(resolve=>setImmediate(resolve));return true;}};
}
(async()=>{
 let x=await run();assert.equal(x.calls.length,2);assert.equal(x.calls[1],'window.__testPayload=true;');assert.match(x.sockets[0].name,/^\\\\\.\\pipe\\FigmaGifAssistant-[a-f0-9]{16}$/);
 x.setURL('https://www.figma.com/design/test/renamed?node-id=3-4');x.wc.emit('did-navigate-in-page');await new Promise(r=>setImmediate(r));
 assert.equal(x.calls.filter(source=>source==='window.__testPayload=true;').length,1,'same-file node URL must not dispose or reinject');
 x.wc.emit('dom-ready');await new Promise(r=>setImmediate(r));assert.equal(x.calls.filter(source=>source==='window.__testPayload=true;').length,2,'real document reload reinjects');
 x.setURL('https://www.figma.com/design/another-file/title');x.wc.emit('did-navigate-in-page');await new Promise(r=>setImmediate(r));assert.equal(x.calls.filter(source=>source==='window.__testPayload=true;').length,3,'different document initializes new engine');
 x=await run({url:'https://other.example/design/test'});assert.equal(x.calls.length,0,'foreign origins must not receive payload');
 x=await run({url:'file:///shell.html'});assert.equal(x.calls.length,0,'desktop shell must not receive payload');
 x=await run({wrongHash:true});assert.equal(x.calls.length,1);assert.equal(x.errors.length,1,'tampered payload rejected');
 x=await run({ready:false});assert.equal(x.calls.length,2,'unready editor receives UI shell only');assert.equal(x.calls[1],'window.__earlyUi=true;');
 x=await run({ready:false,gifEnabled:false});assert.equal(x.calls.length,1,'disabled GIF never injects early UI');
 x=await run({ready:false});for(let i=0;i<65;i++)assert(await x.tick(),'slow editor must retain a retry after60seconds');
 assert.equal([...x.timers.values()][0].ms,5000,'late readiness uses low-frequency retry');
 x.setReady(true);await x.tick();assert.equal(x.calls.filter(s=>s==='window.__testPayload=true;').length,1,'editor becoming ready after old timeout loads automatically');
 x=await run({ready:false});x.wc.emit('destroyed');assert.equal(x.timers.size,0,'destroyed editor cancels retry');
 x=await run({wrongHash:true});assert.equal(x.timers.size,0,'integrity failure must not loop');
 console.log('PASS loader: editor origin/path filter, readiness gate, payload integrity, local pipe naming; mocked Electron only');
})();

