(() => {
  'use strict';
  const { app, webContents } = require('electron');
  const fs = require('fs'), crypto = require('crypto');
  const payloadPath = __PAYLOAD_PATH__;
  const expected = '__PAYLOAD_SHA256__';
  const commandMap = __COMMANDS__;
  const startupSource = __STARTUP_SOURCE__;
  const nativeMap = __NATIVE_MAP__;
  const nativeExport = __NATIVE_EXPORT_FACTORY__({fs,path:require('path'),crypto,shell:require('electron').shell,dialog:require('electron').dialog,BrowserWindow:require('electron').BrowserWindow});
  const attached = new WeakSet();
  const diagnostic = { stage: 'loader-started', error: '' };
  function record(stage, error = '') {
    if (diagnostic.stage === stage && diagnostic.error === error) return;
    diagnostic.stage = stage; diagnostic.error = error;
    // Diagnostic codes only: never persist document URLs, layer names or image bytes.
    try {
      const path = payloadPath + '.diagnostic.jsonl';
      if (fs.existsSync(path) && fs.statSync(path).size > 262144) fs.writeFileSync(path, '');
      fs.appendFileSync(path, JSON.stringify({ time: new Date().toISOString(), stage, error }) + '\n');
    } catch (_) {}
  }
  record('loader-ready');
  function editor(wc) {
    if (wc.isDestroyed()) return false;
    try { const u = new URL(wc.getURL()); return u.protocol === 'https:' && u.hostname === 'www.figma.com' && /^\/(design|file)\//.test(u.pathname); }
    catch (_) { return false; }
  }
  function attach(wc) {
    if (attached.has(wc)) return; attached.add(wc);
    let timer = null, generation = 0, installedDocument = '', startupDocument = '';
    let nativeBusy = false, destroyed = false,referenceSaved=false,referenceBusy=false,referenceCount=0;
    async function saveUiReference(){
      if(process.env.CANVAS_EXTENSIONS_CAPTURE_UI!=='1'||destroyed||referenceBusy||referenceCount>=12||!installedDocument||!editor(wc))return;
      referenceBusy=true;
      try{const reference=await wc.executeJavaScript(`window.FigmaExtensions?.ui?.reference(${!referenceSaved}) ?? null`);if(reference&&reference.controls?.length){const bytes=JSON.stringify(reference);if(bytes.length<=16*1024*1024){fs.writeFileSync(payloadPath+'.ui-'+wc.id+(referenceSaved?'.state.json':'.reference.json'),bytes);referenceSaved=true;referenceCount++;}}}catch(_){/* Read-only probe unavailable; normal extensions continue. */}finally{referenceBusy=false;}
    }
    const referenceTimer=setInterval(saveUiReference,10000);
    async function pumpNative(){
      if(nativeBusy||destroyed||!installedDocument||!editor(wc))return;
      nativeBusy=true;
      try{
        for(let n=0;n<1000&&!destroyed;n++){
          const requests=await wc.executeJavaScript('window.FigmaExtensions?.drainNativeRequests() ?? []');
          if(!Array.isArray(requests)||!requests.length)break;
          const request=requests[0];let response={id:request.id,ok:false,error:'未授权的本地操作'};
          try{
            if(!Object.hasOwn(nativeMap,request.module)||!nativeMap[request.module].includes(request.operation))throw Error('扩展未启用或本地能力未声明');
            const result=await nativeExport.handle(wc,request.module,request.operation,request.payload);
            response={id:request.id,ok:true,result};
          }catch(error){response.error=String(error.message||error);}
          if(!destroyed)await wc.executeJavaScript(`window.FigmaExtensions?.completeNativeRequest(${JSON.stringify(response)})`);
        }
      }catch(_){/* Document closed or reloaded; the client rejects pending work on dispose. */}
      finally{nativeBusy=false;}
    }
    const nativeTimer=setInterval(pumpNative,1000);
    wc.on('console-message',(_event,details,message)=>{const text=typeof details==='object'?details?.message:message;if(text==='[CanvasExtensions:native-request]')pumpNative();});
    const stop = () => { generation++; if (timer) clearTimeout(timer); timer = null; };
    async function load() {
      stop(); const token = generation; let attempts = 0;
      async function attempt() {
        if (token !== generation || !editor(wc)) return;
        try {
          const documentKey = new URL(wc.getURL()).pathname.split('/').slice(0, 3).join('/');
          if (installedDocument === documentKey && await wc.executeJavaScript('Boolean(window.FigmaAssistant?.isLive?.())')) return;
          const ready = await wc.executeJavaScript('Boolean(window.figma?.currentPage && document.querySelector("canvas"))');
          if (token !== generation || wc.isDestroyed()) return;
          if (!ready) {
            if (Object.hasOwn(commandMap, 'gif') && startupDocument !== documentKey) {
              await wc.executeJavaScript(startupSource);
              if (token !== generation || wc.isDestroyed()) return;
              startupDocument = documentKey;
            }
            if (++attempts < 60) { record('waiting-editor-api'); timer = setTimeout(attempt, 1000); }
            else { record('editor-api-delayed'); timer = setTimeout(attempt, 5000); }
            return;
          }
          const bytes = fs.readFileSync(payloadPath);
          if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) { record('load-failed', 'payload-hash-mismatch'); throw Error('Local payload hash mismatch'); }
          record('executing-payload');
          await wc.executeJavaScript(bytes.toString('utf8'));
          if (token !== generation || wc.isDestroyed()) return;
          installedDocument = documentKey;
          record('payload-executed');
        } catch (error) {
          if (diagnostic.error !== 'payload-hash-mismatch') {
            record('load-failed', 'editor-execution-or-local-file-error');
            if (token === generation && !destroyed && editor(wc)) timer = setTimeout(attempt, 5000);
          }
          console.error('[FGA] load:', String(error));
        }
      }
      await attempt();
    }
    wc.on('dom-ready', () => { installedDocument = ''; startupDocument = ''; referenceSaved=false;nativeExport.disposeOwner(wc); load(); }); wc.on('did-navigate-in-page', load); wc.once('destroyed',()=>{destroyed=true;clearInterval(referenceTimer);clearInterval(nativeTimer);nativeExport.disposeOwner(wc);stop();});
    load();
  }
  app.on('web-contents-created', (_event, wc) => attach(wc));
  app.whenReady().then(() => webContents.getAllWebContents().forEach(attach));
  // Current-user named pipe only. No TCP server or arbitrary evaluation command.
  const net = require('net'), os = require('os');
  const pipeName = '\\\\.\\pipe\\FigmaGifAssistant-' + crypto.createHash('sha256').update(os.userInfo().username.toLowerCase()).digest('hex').slice(0, 16);
  let quitting = false, reconnect = null, lastEditor = null, lastRuntimeState = '';
  app.on('before-quit', () => { quitting = true; clearTimeout(reconnect); });
  function connect() {
    if (quitting) return;
    const socket = net.createConnection(pipeName); let buffer = '', busy = false, polling = false;
    const statusTimer = setInterval(async () => {
      if (!socket.writable || busy || polling) return;
      polling = true;
      let ready = 0, mounted = 0, editors = 0, selectedGifs = 0, moduleErrors = 0, exportApiAvailable = null;
      try {
      for (const wc of webContents.getAllWebContents().filter(editor)) {
        editors++;
        if (wc.isFocused()) lastEditor = wc;
        try { const s = await wc.executeJavaScript('window.FigmaAssistant?.status() ?? null'); if (s) { ready++; if (s.sidebarMounted) mounted++; selectedGifs += (s.extensions ?? [s]).reduce((n, module) => n + (Number(module.selectedGifs) || 0), 0); if (s.errors && !Array.isArray(s.errors)) moduleErrors += Object.keys(s.errors).length; const texture=s.extensions?.find(module=>module.id==='texture-export'&&module.selected>0);if(texture)exportApiAvailable=!!texture.exportApiAvailable; } } catch (_) {}
      }
      const runtimeState = JSON.stringify({ ready, mounted, editors, selectedGifs, moduleErrors, exportApiAvailable });
      if (runtimeState !== lastRuntimeState) { lastRuntimeState = runtimeState; try { fs.appendFileSync(payloadPath + '.diagnostic.jsonl', JSON.stringify({ time: new Date().toISOString(), event: 'runtime-state', ready, mounted, editors, selectedGifs, moduleErrors, exportApiAvailable }) + '\n'); } catch (_) {} }
      if (socket.writable) socket.write(JSON.stringify({ event: 'status', ready, mounted, editors, ...diagnostic }) + '\n');
      } finally { polling = false; }
    }, 1500);
    socket.setEncoding('utf8');
    socket.on('data', async chunk => {
      buffer += chunk; if (buffer.length > 65536) { socket.destroy(); return; }
      let boundary;
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
        try {
          const command = JSON.parse(line);
          if (!Object.hasOwn(commandMap, command.module) || !commandMap[command.module].includes(command.action) || busy) continue;
          busy = true;
          // Only a focused editor accepts a desktop command. Sidebar buttons remain per-document.
          const candidates = webContents.getAllWebContents().filter(editor);
          const wc = candidates.find(w => w.isFocused()) || (lastEditor && candidates.includes(lastEditor) ? lastEditor : candidates.length === 1 ? candidates[0] : null);
          if (!wc) throw Error('Focus the target Figma editor first');
          await wc.executeJavaScript(`window.FigmaAssistant.command(${JSON.stringify(command.module)}, ${JSON.stringify(command.action)})`);
          if (socket.writable) socket.write(JSON.stringify({ event: 'result', ok: true }) + '\n');
        } catch (error) { if (socket.writable) socket.write(JSON.stringify({ event: 'result', ok: false }) + '\n'); }
        finally { busy = false; }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => { clearInterval(statusTimer); if (!quitting) reconnect = setTimeout(connect, 2000); });
  }
  app.whenReady().then(connect);
})();

