/* Native-sized normal-flow property section. No design writes. */
(() => {
  'use strict';
  window.FigmaGifStartup?.dispose();
  if (!window.FigmaExtensions) window.FigmaAssistant?.dispose();
  const api = window.figma, engine = window.FigmaCanvasGif;
  let disposed = false, queued = false, selectedGifs = 0, unknownImages = 0, lastSelectionKey = '', inspecting = false, inspectionFailed = false;
  const panel = document.createElement('section');
  panel.dataset.figmaAssistant = 'gif'; panel.setAttribute('aria-label', 'GIF preview');
  Object.assign(panel.style, { display: 'block', position: 'relative', width: '100%', minWidth: '0',
    maxWidth: 'none', boxSizing: 'border-box', gridColumn: '1 / -1', alignSelf: 'stretch',
    flex: '0 0 auto', margin: '0', padding: '0', border: '0',
    borderTop: '1px solid var(--color-border, #444)', color: 'var(--color-text, #eee)',
    background: 'var(--color-bg, #2c2c2c)', font: '12px Inter, Segoe UI, sans-serif' });
  const shadow = panel.attachShadow({ mode: 'open' });
  const releaseUi=window.FigmaExtensions?.ui?.install(shadow);
  const heading = document.createElement('div'); heading.textContent = 'GIF preview';
  Object.assign(heading.style, { display: 'flex', alignItems: 'center', height: '40px',
    padding: '0 16px', margin: '0', boxSizing: 'border-box', fontWeight: '600', fontSize: '12px' });
  const body = document.createElement('div');
  Object.assign(body.style, { padding: '0 16px 12px', boxSizing: 'border-box', width: '100%' });
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '0', width: '100%', minWidth: '0', height: '24px',
    borderRadius: '5px', overflow: 'hidden', background: 'var(--color-bg-secondary, #383838)' });
  const preview = document.createElement('button'), stop = document.createElement('button');
  function makeButton(button, text, playIcon) {
    button.type = 'button';
    Object.assign(button.style, { all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '6px', flex: '1 1 0', minWidth: '0', height: '24px', padding: '0 8px',
      boxSizing: 'border-box', cursor: 'pointer', font: '12px Inter, Segoe UI, sans-serif',
      whiteSpace: 'nowrap', color: 'var(--color-text, #eee)', background: 'transparent' });
    if (!playIcon) button.style.borderLeft = '1px solid var(--color-bg, #2c2c2c)';
    const icon = document.createElement('span');
    Object.assign(icon.style, { width: '10px', height: '10px', display: 'block', background: 'currentColor',
      clipPath: playIcon ? 'polygon(15% 0, 100% 50%, 15% 100%)' : 'inset(10% round 1px)' });
    const label = document.createElement('span'); label.textContent = text;
    button.append(icon, label); button.setAttribute('aria-label', text);
    button.addEventListener('pointerenter', () => { if (!button.disabled) button.style.background = 'var(--color-bg-tertiary, #444)'; });
    button.addEventListener('pointerleave', update);
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) { button.style.outline = '2px solid var(--color-border-selected, #0d99ff)'; button.style.outlineOffset = '-2px'; } });
    button.addEventListener('blur', () => { button.style.outline = 'none'; });
  }
  makeButton(preview, 'Preview', true); makeButton(stop, 'Stop', false);
  preview.title = 'Play selected GIFs; keep other GIFs playing'; stop.title = 'Stop selected GIF previews';
  const status = document.createElement('div');
  Object.assign(status.style, { marginTop: '8px', fontSize: '11px', lineHeight: '16px',
    color: 'var(--color-text-secondary, #aaa)', overflowWrap: 'anywhere', display: 'flex', gap: '12px', flexWrap: 'wrap' });
  const selectedLabel = document.createElement('span'), gifLabel = document.createElement('span'), playingLabel = document.createElement('span'), detailLabel = document.createElement('span');
  status.append(selectedLabel, gifLabel, playingLabel, detailLabel);
  row.append(preview, stop); body.append(row, status); shadow.append(heading, body);
  function update() {
    if (disposed) return;
    const s = engine.status, selectedPlaying = engine.selectedPlayingCount();
    const selectedCount = api.currentPage?.selection?.length ?? selectedGifs;
    selectedLabel.textContent = `${selectedCount} selected`;
    gifLabel.textContent = inspecting ? '' : `${selectedGifs} GIF`;
    playingLabel.textContent = `${selectedPlaying} playing`;
    detailLabel.textContent = inspecting ? '正在识别 GIF…' : inspectionFailed ? '识别失败，请重新选择' : s.loading ? 'Reading…' : unknownImages ? '点击 Preview 识别其余图片' : s.errors.length ? 'Preview error' : s.skipped ? `${s.skipped} unsupported` : '';
    preview.disabled = inspecting || s.loading || (selectedGifs === 0 && unknownImages === 0); stop.disabled = selectedPlaying === 0 && !s.loading;
    for (const button of [preview, stop]) { button.style.opacity = button.disabled ? '.4' : '1'; button.style.cursor = button.disabled ? 'default' : 'pointer'; }
    preview.style.background = selectedPlaying > 0 ? 'var(--color-bg-tertiary, #444)' : 'transparent';
    stop.style.background = 'transparent';
  }
  async function playSelection() { try { await engine.scan(); } catch (error) { engine.status.errors.push(String(error)); } await selectionWatcher.refresh({immediate:true}); update(); return snapshot(); }
  function halt() { engine.stopSelected(); update(); return snapshot(); }
  preview.onclick = playSelection; stop.onclick = halt;
  const sectionNames = /^(Effects|Stroke|Fill|Appearance|Layout|Position|Styles|Page|效果|描边|填充|外观|布局|位置|样式|页面)$/;
  function labelOf(el) { return (el.getAttribute('aria-label') || el.textContent || '').trim(); }
  function exportBoundary(side, exportControl) {
    const neighbors = [...side.querySelectorAll('button, [role="button"], h2, h3, div, span')]
      .filter(el => !panel.contains(el) && sectionNames.test(labelOf(el)));
    if (!neighbors.length) return null;
    let anchor = exportControl;
    while (anchor.parentElement && anchor.parentElement !== side) {
      const parent = anchor.parentElement;
      if (neighbors.some(neighbor => parent.contains(neighbor))) break;
      anchor = parent;
    }
    return anchor === exportControl ? null : anchor;
  }
  function place() {
    queued = false; if (disposed) return;
    if (selectedGifs === 0 && unknownImages === 0 && !inspecting && !inspectionFailed) { panel.remove(); return; }
    if (window.FigmaExtensions?.placeSection) { window.FigmaExtensions.placeSection('gif', panel); update(); return; }
    const side = document.querySelector('[aria-label="Right sidebar"]');
    if (!side) { panel.remove(); return; }
    const exportControl = [...side.querySelectorAll('button, [role="button"], h2, h3')]
      .find(el => /^(Export|导出)$/.test(labelOf(el)));
    const anchor = exportControl && exportBoundary(side, exportControl);
    if (!anchor || !anchor.parentElement) { panel.remove(); return; }
    if (panel.previousElementSibling !== anchor) anchor.after(panel);
    update();
  }
  function schedule() { if (!queued && !disposed) { queued = true; queueMicrotask(place); } }
  const selectionWatcher=window.CanvasExtensionServices.watchSelection(api,{
    delay:250,poll:0,initial:false,
    onStart(){lastSelectionKey=selectionKey();selectedGifs=0;unknownImages=0;inspectionFailed=false;engine.cancelInspection?.();inspecting=engine.hasImageSelection();place();update();},
    async run(_,task){
      if(!engine.hasImageSelection()){task.commit(()=>{inspecting=false;schedule();update();});return;}
      const result=await engine.inspectSelection();
      if(!task.current())return;
      task.commit(()=>{selectedGifs=result.gifCount;unknownImages=result.unknownCount||0;inspectionFailed=result.failedCount>0;inspecting=false;schedule();update();});
    },
    onError(){selectedGifs=0;unknownImages=0;inspectionFailed=true;inspecting=false;schedule();update();}
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const pageChanged = () => { engine.reset(); update(); };
  api.on?.('currentpagechange', pageChanged);
  function selectionKey() { return `${api.currentPage?.id ?? ''}:${(api.currentPage?.selection ?? []).map(node => node.id).join(',')}`; }
  const timer = setInterval(() => { if (selectionKey() !== lastSelectionKey) selectionWatcher.refresh(); update(); }, 400);
  const modules = Object.freeze({ gif: Object.freeze({ readOnly: true, commands: Object.freeze({ previewSelection: playSelection, stop: halt }) }) });
  function snapshot() { return { version: '0.2.11', sidebarMounted: panel.isConnected, selectedGifs, unknownImages, inspecting, inspectionFailed, module: 'gif', ...engine.status }; }
  window.FigmaAssistant = {
    modules, status: snapshot, isLive: () => !disposed && engine.isLive(),
    async command(module, action) {
      const method = modules[module]?.commands[action];
      if (!Object.hasOwn(modules, module) || !method || !Object.hasOwn(modules[module].commands, action)) throw Error('Unsupported command');
      return await method();
    },
    dispose() {
      if (disposed) return; disposed = true; selectionWatcher.dispose(); observer.disconnect(); clearInterval(timer);
      api.off?.('currentpagechange', pageChanged);
      releaseUi?.();panel.remove(); engine.dispose();
    }
  };
  selectionWatcher.refresh(); update();
})();
