(() => {
  'use strict';
  const sdk = window.FigmaExtensions.sdk;
  const keys = ['curveX1', 'curveY1', 'curveX2', 'curveY2'];
  const presets = {
    linear: [0, 0, 100, 100],
    ease: [25, 10, 25, 100],
    'ease-in-out': [42, 0, 58, 100]
  };
  function coordinates(values) {
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  }
  const defaults = { curvePreset: 'linear', curveTime: 50, ...coordinates(presets.linear) };
  const clamp = number => Math.max(0, Math.min(100, Math.round(number)));

  function bezier(t, p1, p2) {
    const u = 1 - t;
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * 100;
  }

  // The horizontal axis is time. Invert x(t) before evaluating the output y(t).
  function outputAtTime(state) {
    const time = state.curveTime;
    if (time === 0 || time === 100) return time;
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, state.curveX1, state.curveX2) < time) lo = mid;
      else hi = mid;
    }
    return bezier((lo + hi) / 2, state.curveY1, state.curveY2);
  }

  function mountPlot(container, ctx, life) {
    const board = document.createElement('div');
    Object.assign(board.style, {
      position: 'relative', margin: '10px', height: '150px',
      border: '1px solid var(--color-border, #444)', borderRadius: '4px',
      backgroundColor: 'var(--color-bg-secondary, #383838)'
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { width: '100%', height: '100%', display: 'block' });
    function stroke(color, width) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(width));
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      return path;
    }
    const grid = stroke('var(--color-border, #555)', 1);
    grid.setAttribute('d', 'M25 0V100 M50 0V100 M75 0V100 M0 25H100 M0 50H100 M0 75H100');
    const tangents = stroke('var(--color-text-secondary, #aaa)', 1);
    const curve = stroke('var(--color-icon-brand, #0d99ff)', 2);
    curve.setAttribute('data-curve-path', '');
    const position = stroke('var(--color-text, #fff)', 1);
    position.setAttribute('stroke-dasharray', '3 3');
    board.append(svg);
    container.append(board);

    const handles = [1, 2].map(index => {
      const xKey = 'curveX' + index, yKey = 'curveY' + index;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.dataset.curvePoint = String(index);
      handle.setAttribute('aria-label', '控制点 ' + index + '，方向键移动');
      Object.assign(handle.style, {
        position: 'absolute', width: '14px', height: '14px', padding: '0', borderRadius: '50%',
        border: '2px solid var(--color-bg, #222)', background: 'var(--color-icon-brand, #0d99ff)',
        transform: 'translate(-50%, -50%)', cursor: 'move', touchAction: 'none'
      });
      board.append(handle);
      function set(x, y) {
        ctx.patch({ [xKey]: clamp(x), [yKey]: clamp(y), curvePreset: 'custom' });
      }
      sdk.components.dragSurface({ handle, surface: board, scope: life,
        onMove({ x, y }) { set(100 * x, 100 * (1 - y)); }
      });
      life.listen(handle, 'keydown', event => {
        const amount = event.shiftKey ? 10 : 1;
        const moves = { ArrowRight: [amount, 0], ArrowLeft: [-amount, 0], ArrowUp: [0, amount], ArrowDown: [0, -amount] };
        if (!Object.hasOwn(moves, event.key)) return;
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        set(ctx.state[xKey] + dx, ctx.state[yKey] + dy);
      });
      return handle;
    });
    life.add(ctx.model.watchKeys([...keys, 'curveTime'], () => {
      const { curveX1: x1, curveY1: y1, curveX2: x2, curveY2: y2, curveTime } = ctx.state;
      curve.setAttribute('d', 'M0 100 C' + x1 + ' ' + (100-y1) + ' ' + x2 + ' ' + (100-y2) + ' 100 0');
      tangents.setAttribute('d', 'M0 100 L' + x1 + ' ' + (100-y1) + ' M100 0 L' + x2 + ' ' + (100-y2));
      position.setAttribute('d', 'M' + curveTime + ' 100 V' + (100 - outputAtTime(ctx.state)) + ' H0');
      for (const [index, handle] of handles.entries()) {
        const x = ctx.state['curveX' + (index + 1)], y = ctx.state['curveY' + (index + 1)];
        handle.style.left = x + '%'; handle.style.top = (100-y) + '%';
        handle.title = 'P' + (index + 1) + ' (' + x + '%, ' + y + '%)';
      }
    }, { immediate: true }));
    return () => board.remove();
  }

  const content = [
    { type: 'select', key: 'curvePreset', label: '缓动预设', options: [
      { value: 'linear', label: '线性' }, { value: 'ease', label: '缓动' },
      { value: 'ease-in-out', label: '缓入缓出' }, { value: 'custom', label: '自定义' }
    ], onChange(ctx, value) { if (Object.hasOwn(presets, value)) ctx.patch(coordinates(presets[value])); } },
    { type: 'custom', key: 'curvePlot', label: '时间 / 进度', mount: mountPlot },
    ...[1, 2].map(index => ({
      type: 'row', children: ['X', 'Y'].map(axis => ({
        type: 'number', key: 'curve' + axis + index, label: 'P' + index + ' · ' + axis + ' (%)', min: 0, max: 100,
        onChange(ctx, value) {
          ctx.patch({ ['curve' + axis + index]: clamp(value), curvePreset: 'custom' });
        }
      }))
    })),
    { type: 'rangeField', key: 'curveTime', label: '时间', unit: '%', min: 0, max: 100, step: 1 },
    { type: 'label', text: ({state}) => '进度 ' + outputAtTime(state).toFixed(1) + '% · cubic-bezier(' +
      keys.map(key => state[key] / 100).join(', ') + ')' }
  ];
  window.CanvasPlaygroundCurve = { defaults, content };
})();
