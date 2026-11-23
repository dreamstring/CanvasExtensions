(() => {
  'use strict';
  const sdk = window.FigmaExtensions.sdk;
  const sides = ['left', 'top', 'right', 'bottom'];
  const opposite = { left: 'right', top: 'bottom', right: 'left', bottom: 'top' };
  const presets = {
    balanced: { left: 20, top: 20, right: 20, bottom: 20 },
    asymmetric: { left: 12, top: 18, right: 32, bottom: 26 }
  };
  const defaults = { preset: 'balanced', editable: true, ...presets.balanced };
  const title = side => side[0].toUpperCase() + side.slice(1);

  function edit(ctx, side, input) {
    if (!ctx.state.editable || !Number.isFinite(input)) return;
    const limit = 100 - ctx.state[opposite[side]];
    ctx.patch({ [side]: Math.max(0, Math.min(limit, Math.round(input))), preset: 'custom' });
  }

  function mountGuides(container, ctx, life) {
    const board = document.createElement('div');
    board.className = 'guide-board';
    const style = document.createElement('style');
    style.textContent = `
      .guide-board {
        position: relative; box-sizing: border-box; min-height: 160px; height: 12em;
        margin: 8px; border-radius: 6px; touch-action: none;
        background: var(--color-bg-secondary, #383838);
        outline: 1px solid var(--color-border-strong, #888);
      }
      .guide-center { position: absolute; background: var(--color-bg-selected, #394360); pointer-events: none; }
      .guide-board button { position: absolute; border: 0; background: transparent; padding: 0; touch-action: none; }
      .guide-board button::after { content: ''; display: block; margin: auto; background: var(--color-icon-brand, #0d99ff); }
      .guide-board button[data-axis=x] { width: 12px; height: 100%; top: 0; transform: translateX(-50%); cursor: ew-resize; }
      .guide-board button[data-axis=y] { height: 12px; width: 100%; left: 0; transform: translateY(-50%); cursor: ns-resize; }
      .guide-board button[data-axis=x]::after { width: 2px; height: 100%; }
      .guide-board button[data-axis=y]::after { height: 2px; width: 100%; }
      .guide-board button:focus-visible { outline: 2px solid var(--color-border-selected, #0d99ff); z-index: 1; }
      .guide-board button:disabled { cursor: default; opacity: .55; }
    `;
    const center = document.createElement('div');
    center.className = 'guide-center';
    board.append(center);
    container.append(style, board);
    for (const side of sides) {
      const horizontalAxis = side === 'left' || side === 'right';
      const reversed = side === 'bottom' || side === 'right';
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.dataset.axis = horizontalAxis ? 'x' : 'y';
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', title(side) + ' guide');
      handle.setAttribute('aria-orientation', horizontalAxis ? 'horizontal' : 'vertical');
      handle.setAttribute('aria-valuemin', '0');
      board.append(handle);
      sdk.components.dragSurface({
        handle, surface: board, scope: life,
        onMove({ x, y }) {
          const position = horizontalAxis ? x : y;
          edit(ctx, side, (reversed ? 1 - position : position) * 100);
        }
      });
      life.listen(handle, 'keydown', event => {
        const amount = event.shiftKey ? 10 : 1;
        const delta = horizontalAxis
          ? { ArrowLeft: -amount, ArrowRight: amount }
          : { ArrowUp: -amount, ArrowDown: amount };
        let next;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 100;
        else if (Object.hasOwn(delta, event.key)) next = ctx.state[side] + (reversed ? -1 : 1) * delta[event.key];
        else return;
        event.preventDefault();
        edit(ctx, side, next);
      });
      life.add(ctx.model.watchKeys(
        [side, opposite[side], 'editable'],
        () => {
          const margin = ctx.state[side];
          center.style[side] = margin + '%';
          handle.style[horizontalAxis ? 'left' : 'top'] = (reversed ? 100 - margin : margin) + '%';
          handle.setAttribute('aria-valuenow', String(margin));
          handle.setAttribute('aria-valuemax', String(100 - ctx.state[opposite[side]]));
          handle.setAttribute('aria-valuetext', margin + '%');
          handle.title = title(side) + ' ' + margin + '%';
          handle.disabled = !ctx.state.editable;
        }, { immediate: true }
      ));
    }
    return () => { board.remove(); style.remove(); };
  }

  const guides = [
        { type: 'select', key: 'preset', label: '预设', options: [
          { value: 'balanced', label: '均衡' }, { value: 'asymmetric', label: '非对称' }, { value: 'custom', label: '自定义' }
        ], onChange(ctx, value) { if (Object.hasOwn(presets, value)) ctx.patch(presets[value]); } },
        { type: 'checkbox', key: 'editable', label: '编辑边距' },
        { type: 'group', enabled: ctx => ctx.state.editable, children: [
          ...sides.map(side => ({ type: 'rangeField', key: side, label: title(side), min: 0, max: 100, step: 1,
            unit: '%', onChange: (ctx, value) => edit(ctx, side, value) })),
          { type: 'custom', key: 'guides', label: '九宫切线', mount: mountGuides }
        ] },
        { type: 'label', text: ctx => sides.map(side => title(side) + ' ' + ctx.state[side] + '%').join(' · ') },
        { type: 'button', key: 'reset', label: '重置', onClick: ctx => ctx.patch(defaults) }
  ];
  const forms=window.CanvasPlaygroundForms;
  const browser=window.CanvasPlaygroundBrowser;
  const curve=window.CanvasPlaygroundCurve;
  const commands=window.CanvasPlaygroundCommands;
  const layers=window.CanvasPlaygroundLayers;
  const scenes=[
    ['guides','九宫参数表单',guides], ['toolbar','紧凑对齐工具条',forms.toolbar],
    ['browser','素材浏览器',browser.content], ['curve','缓动曲线编辑器',curve.content],
    ['queue','任务队列',forms.queue], ['wizard','分步向导',forms.wizard],
    ['commands','命令面板',commands.content], ['layers','图层矩阵',layers.content]
  ];
  sdk.compose({
    id:'sdk-playground',defaults:{...defaults,...forms.defaults,...browser.defaults,...curve.defaults,...commands.defaults,...layers.defaults,scene:'guides'},
    setup:forms.setup,
    panel:{title:'SDK Playground',collapsible:true,collapsed:true,visible:()=>true,content:[
      {type:'select',key:'scene',label:'测试场景',options:scenes.map(([value,label])=>({value,label}))},
      ...scenes.map(([id,,children])=>({type:'group',visible:ctx=>ctx.state.scene===id,children}))
    ]},
    commands: { reset: ctx => ctx.patch(defaults) }
  });
})();
