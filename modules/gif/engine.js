/* Figma canvas GIF preview: browser-native animated <img>, no plugin UI.
 * Runtime-only enhancement. No image-fill assignments or document writes.
 * Supported initial scope: rectangular FILL/FIT image fills, rotation,
 * ancestor visibility/opacity and rectangular ancestor clipping.
 * Overlapping design layers above an image and arbitrary vector masks are
 * not reconstructed by this DOM compositor. Reloading Figma removes it.
 */
(() => {
  'use strict';
  window.FigmaCanvasGif?.dispose();
  const api = window.figma;
  if (!api?.currentPage) throw Error('Open the Figma editor document first.');
  const canvas = [...document.querySelectorAll('canvas')]
    .filter(c => c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 100)
    .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!canvas) throw Error('The editor canvas was not found.');
  const host = canvas.parentElement;
  let pageId = api.currentPage.id;
  const state = { mode: 'browser-gif-in-editor', running: false, loading: false,
    gifs: 0, visible: 0, skipped: 0, errors: [], pageId };
  const items = [];
  const suppressed = new Set();
  const services=window.CanvasExtensionServices;
  let imageResources=services.editorImages(api);
  let serial = 0, raf = 0, disposed = false, lastGeometry = 0, lastViewport = '', dragging = false;

  const root = document.createElement('div');
  root.dataset.figmaCanvasGif = 'images';
  root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', pointerEvents: 'none', overflow: 'hidden',
    contain: 'layout style', zIndex: '1', display: 'none' });
  host.appendChild(root);
  const controls = document.createElement('div');
  controls.dataset.figmaCanvasGif = 'controls';
  Object.assign(controls.style, { position: 'absolute', right: '14px', top: '14px',
    display: 'flex', gap: '8px', alignItems: 'center', padding: '7px 10px', borderRadius: '9px',
    color: 'var(--color-text, #eee)', background: 'var(--color-bg, #2c2c2c)',
    border: '1px solid var(--color-border, #555)', font: '12px Inter, Segoe UI, sans-serif',
    boxShadow: '0 3px 12px #0003', zIndex: '20', pointerEvents: 'auto' });
  const label = document.createElement('span');
  const toggle = document.createElement('button');
  const close = document.createElement('button');
  close.textContent = '×'; close.title = '关闭 GIF 画布预览'; close.setAttribute('aria-label', close.title);
  for (const button of [toggle, close]) {
    button.type = 'button';
    Object.assign(button.style, { color: 'inherit', background: 'transparent', border: '0',
      cursor: 'pointer', font: 'inherit', padding: '2px 3px', borderRadius: '4px' });
  }
  controls.append(label, toggle, close);
  // Sidebar owns controls; do not add floating controls.

  function updateControls() {
    label.textContent = state.loading ? `GIF · 读取中 ${state.gifs}` : `GIF · ${state.visible}/${state.gifs}`;
    toggle.textContent = state.running ? '停止' : '播放';
    toggle.disabled = state.loading;
    controls.title = `画布内预览，不使用插件面板。跳过 ${state.skipped} 项；错误 ${state.errors.length} 项。`;
  }
  const isGif=bytes=>services.format(bytes)==='gif';
  function quad(node, bounds, zoom) {
    const t = node.absoluteTransform, w = node.width, h = node.height;
    return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => [
      (t[0][0] * x + t[0][1] * y + t[0][2] - bounds.x) * zoom,
      (t[1][0] * x + t[1][1] * y + t[1][2] - bounds.y) * zoom]);
  }
  function intersect(subject, clip) {
    const area = clip.reduce((v, p, i) => { const q = clip[(i + 1) % clip.length]; return v + p[0] * q[1] - q[0] * p[1]; }, 0);
    const sign = area >= 0 ? 1 : -1;
    for (let i = 0; i < clip.length && subject.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const side = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      const input = subject; subject = [];
      for (let j = 0; j < input.length; j++) {
        const p = input[j], q = input[(j + 1) % input.length], dp = side(p), dq = side(q);
        if (dp >= -0.001) subject.push(p);
        if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
          const t = dp / (dp - dq);
          subject.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
    }
    return subject;
  }
  function geometry(item, bounds, zoom, width, height) {
    const node = item.node;
    let opacity = item.paint.opacity ?? 1;
    let clip = [[0, 0], [width, 0], [width, height], [0, height]];
    for (let parent = node; parent && parent.type !== 'DOCUMENT'; parent = parent.parent) {
      if (parent.visible === false || parent.removed) return false;
      opacity *= parent.opacity ?? 1;
      if (parent !== node && parent.clipsContent && parent.absoluteTransform) clip = intersect(clip, quad(parent, bounds, zoom));
    }
    const box = node.absoluteBoundingBox;
    if (!box || opacity <= 0 || box.x > bounds.x + bounds.width || box.y > bounds.y + bounds.height ||
      box.x + box.width < bounds.x || box.y + box.height < bounds.y || clip.length < 3) return false;
    const t = node.absoluteTransform;
    item.clip.style.clipPath = `polygon(${clip.map(p => `${p[0]}px ${p[1]}px`).join(',')})`;
    Object.assign(item.element.style, { width: `${node.width}px`, height: `${node.height}px`,
      opacity: String(opacity), transform: `matrix(${t[0][0] * zoom},${t[1][0] * zoom},${t[0][1] * zoom},${t[1][1] * zoom},${(t[0][2] - bounds.x) * zoom},${(t[1][2] - bounds.y) * zoom})` });
    const radii = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']
      .map(k => typeof node[k] === 'number' ? node[k] : typeof node.cornerRadius === 'number' ? node.cornerRadius : 0);
    item.element.style.borderRadius = radii.map(r => `${r}px`).join(' ');
    return true;
  }
  function layout(now = performance.now()) {
    if (disposed || !state.running) return;
    try {
      if (api.currentPage.id !== pageId) { reset(); label.textContent = 'GIF · 页面已切换'; return; }
      const rect = canvas.getBoundingClientRect(), bounds = api.viewport.bounds, zoom = api.viewport.zoom;
      const key = [bounds.x, bounds.y, zoom, rect.width, rect.height].join(',');
      if (key !== lastViewport || dragging || now - lastGeometry > 80) {
        Object.assign(root.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
          width: `${rect.width}px`, height: `${rect.height}px` });
        // Refuse an unknown coordinate mapping instead of showing displaced GIFs.
        if (Math.abs(bounds.width * zoom - rect.width) > 3 || Math.abs(bounds.height * zoom - rect.height) > 3) {
          root.style.visibility = 'hidden';
        } else {
          root.style.visibility = 'visible'; state.visible = 0;
          for (const item of items) {
            let show = false;
            try { show = geometry(item, bounds, zoom, rect.width, rect.height); }
            catch (_) { /* Removed nodes disappear until the next scan. */ }
            item.clip.style.display = show ? 'block' : 'none';
            if (show) state.visible++;
          }
        }
        lastViewport = key; lastGeometry = now; updateControls();
      }
    } catch (error) { state.errors.push(String(error)); stop(); return; }
    raf = requestAnimationFrame(layout);
  }
  function play() {
    if (disposed || state.loading) return;
    if (!items.length) { state.running = false; root.style.display = 'none'; cancelAnimationFrame(raf); updateControls(); return; }
    state.running = true; root.style.display = 'block'; lastViewport = '';
    for (const item of items) if (!item.image.src) item.image.src = item.url;
    cancelAnimationFrame(raf); layout(); updateControls();
  }
  function stop() { serial++; state.loading = false;
    state.running = false; state.visible = 0;
    cancelAnimationFrame(raf); root.style.display = 'none';
    for (const item of items) item.image.removeAttribute('src');
    updateControls();
    return { ...state };
  }
  function clearItems() {
    for (const item of items) { item.image.removeAttribute('src'); URL.revokeObjectURL(item.url); }
    items.length = 0; root.replaceChildren(); state.gifs = 0;
  }
  function reset() { inspectionSerial++; stop(); clearItems(); suppressed.clear(); imageResources.dispose(); imageResources=services.editorImages(api); return { ...state }; }
  function selectedPlayingCount() {
    if (!state.running || !items.length) return 0;
    const ids = new Set(api.currentPage.selection.map(node => node.id));
    return new Set(items.filter(item => item.image.src&&services.selectionContains(item.node,ids)).map(item=>item.node.id)).size;
  }

  let inspectionSerial = 0;
  function cancelInspection() { inspectionSerial++; }
  const isImagePaint = paint => paint.type === 'IMAGE' && paint.imageHash && paint.visible !== false;
  function hasImageSelection() {
    return api.currentPage.selection.some(node => node.visible !== false &&
      (node.children?.length || Array.isArray(node.fills) && node.fills.some(isImagePaint)));
  }
  async function inspectSelection() {
    const token = ++inspectionSerial, inspectedPage = api.currentPage.id;
    const live = () => !disposed && token === inspectionSerial && inspectedPage === api.currentPage.id;
    // Never traverse a container automatically. Preview owns the full descendant scan.
    const nodes = [], seen = new Set();
    let deferredContainers = 0;
    for (const node of api.currentPage.selection) {
      if (seen.has(node.id) || node.removed || node.visible === false) continue;
      seen.add(node.id);
      if (Array.isArray(node.fills) && node.fills.some(isImagePaint)) nodes.push(node);
      if (node.children?.length) deferredContainers++;
    }
    let next = 0, gifCount = 0, failedCount = 0, unknownCount = deferredContainers, reads = 0;
    const started = performance.now();
    async function worker() {
      while (live() && next < nodes.length) {
        const node = nodes[next++]; let unknown = false, gif = false;
        for (const paint of node.fills) {
          if (!isImagePaint(paint) || !live()) continue;
          try {
            let known=imageResources.knownFormat(paint.imageHash);
            if(!known){
              if(reads>=8||performance.now()-started>=250){unknown=true;continue;}
              if(!live())return;reads++;
              known=await imageResources.identify(paint.imageHash);
            }
            if(!live())return;
            if(known==='gif'){gif=true;break;}
          }catch(_){if(!live())return;failedCount++;unknown=true;}

        }
        if (gif) gifCount++; else if (unknown) unknownCount++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(1, nodes.length) }, worker));
    return live() ? { gifCount, failedCount, unknownCount } : { gifCount: 0, failedCount: 0, unknownCount: 0 };
  }
  function stopSelected() {
    const ids = new Set(api.currentPage.selection.map(node => node.id));
    for (const id of ids) suppressed.add(id);
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]; if (!services.selectionContains(item.node,ids)) continue;
      item.image.removeAttribute('src'); URL.revokeObjectURL(item.url); item.clip.remove(); items.splice(i, 1);
    }
    state.gifs = items.length; state.visible = Math.min(state.visible, items.length); lastViewport = '';
    if (!items.length) { state.running = false; cancelAnimationFrame(raf); root.style.display = 'none'; }
    updateControls(); return { ...state };
  }
  async function scan() {
    if (disposed) throw Error('Preview was disposed; reload the script.');
    if (pageId !== api.currentPage.id) reset();
    pageId = api.currentPage.id; state.pageId = pageId;
    state.loading = true; state.skipped = 0; state.errors = [];
    const token = ++serial, cache = new Map(); updateControls();
    suppressed.clear();
    try {
      const nodes=(await services.selectionNodes(api,{deep:true,current:()=>!disposed&&token===serial})).filter(node=>Array.isArray(node.fills));
      for (const node of nodes) for (let fillIndex = 0; fillIndex < node.fills.length; fillIndex++) {
        if (disposed || token !== serial) return;
        const paint = node.fills[fillIndex];
        if (services.selectionContains(node,suppressed)) continue;
        if (paint.type !== 'IMAGE' || !paint.imageHash || paint.visible === false) continue;
        if (items.some(item => item.node.id === node.id && item.fillIndex === fillIndex && item.paint.imageHash === paint.imageHash)) continue;
        let bytes = cache.get(paint.imageHash);
        if (bytes === undefined) {
          const existing = null;
          bytes = existing?.bytes ?? await imageResources.bytes(paint.imageHash);
          if (disposed || token !== serial) return;
          if (services.selectionContains(node,suppressed)) continue;
          const gif = isGif(bytes);
          imageResources.remember(paint.imageHash,bytes);
          bytes = gif ? bytes : null;
          cache.set(paint.imageHash, bytes);
        }
        if (!bytes) continue;
        if (!['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE'].includes(node.type) ||
          !['FILL', 'FIT'].includes(paint.scaleMode) || paint.rotation ||
          (node.children?.length ?? 0) > 0 || node.isMask || node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') {
          state.skipped++; continue;
        }
        // Replace a changed fill slot, but leave every unrelated decoder running.
        for (let i = items.length - 1; i >= 0; i--) {
          const old = items[i];
          if (old.node.id !== node.id || old.fillIndex !== fillIndex) continue;
          old.image.removeAttribute('src'); URL.revokeObjectURL(old.url); old.clip.remove(); items.splice(i, 1);
        }
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
        const clip = document.createElement('div'), element = document.createElement('div'), image = document.createElement('img');
        Object.assign(clip.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
        Object.assign(element.style, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0',
          overflow: 'hidden', pointerEvents: 'none' });
        Object.assign(image.style, { display: 'block', width: '100%', height: '100%', pointerEvents: 'none',
          objectFit: paint.scaleMode === 'FIT' ? 'contain' : 'cover' });
        image.alt = ''; image.draggable = false;
        image.addEventListener('error', () => { state.errors.push(`GIF decode failed: ${node.id}`); updateControls(); });
        element.appendChild(image); clip.appendChild(element); root.appendChild(clip);
        items.push({ node, paint, fillIndex, url, clip, element, image });
        state.gifs = items.length; updateControls();
      }
    } catch (error) { state.errors.push(String(error)); }
    finally { if (token === serial) { state.loading = false; updateControls(); } }
    if (!disposed && token === serial) play();
    console.log('FIGMA_CANVAS_GIF ' + JSON.stringify(state));
    return { ...state };
  }
  const pointerDown = () => { dragging = true; };
  const pointerUp = () => { dragging = false; };
  host.addEventListener('pointerdown', pointerDown, true);
  window.addEventListener('pointerup', pointerUp, true);
  toggle.onclick = () => state.running ? stop() : play();
  close.onclick = () => dispose();
  function dispose() {
    if (disposed) return;
    serial++; stop(); disposed = true; state.loading = false;
    clearItems(); imageResources.dispose(); root.remove(); controls.remove();
    host.removeEventListener('pointerdown', pointerDown, true);
    window.removeEventListener('pointerup', pointerUp, true);
  }
  window.FigmaCanvasGif = { scan, play, stop, stopSelected, reset, inspectSelection, hasImageSelection, cancelInspection, selectedPlayingCount, dispose, isLive: () => !disposed && canvas.isConnected !== false, status: state };
  updateControls();
  console.log('FIGMA_CANVAS_GIF_READY: await FigmaCanvasGif.scan();');
})();
