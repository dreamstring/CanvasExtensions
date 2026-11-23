/* Normalize a captured pointer gesture to the current surface rectangle. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CanvasPointerInput = api;
})(globalThis, function () {
  'use strict';
  function dragSurface({ handle, surface, scope, onMove }) {
    if (typeof onMove !== 'function') throw TypeError('Expected an onMove callback');
    let active = null;
    let disposed = false;
    function release() {
      const id = active;
      active = null;
      if (id !== null && handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    }
    function start(event) {
      if (disposed || active !== null || event.button !== 0 || event.isPrimary === false || handle.disabled) return;
      try { handle.setPointerCapture(event.pointerId); }
      catch (error) { if (error.name === 'NotFoundError') return; throw error; }
      active = event.pointerId;
      handle.focus?.({ preventScroll: true });
      event.preventDefault();
    }
    function move(event) {
      if (active !== event.pointerId || disposed || handle.disabled) return;
      const rect = surface.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return;
      const clamp = value => Math.max(0, Math.min(1, value));
      onMove({ x: clamp((event.clientX - rect.left) / rect.width),
               y: clamp((event.clientY - rect.top) / rect.height) }, event);
    }
    function end(event) {
      if (active !== event.pointerId) return;
      try { move(event); } finally { release(); }
    }
    function cancel(event) {
      if (active === event.pointerId) release();
    }
    const events = { pointerdown: start, pointermove: move, pointerup: end,
                     pointercancel: cancel, lostpointercapture: cancel };
    function dispose() {
      if (disposed) return;
      disposed = true;
      for (const [name, fn] of Object.entries(events)) handle.removeEventListener(name, fn);
      release();
    }
    for (const [name, fn] of Object.entries(events)) handle.addEventListener(name, fn);
    scope?.add(dispose);
    return dispose;
  }
  return Object.freeze({ dragSurface });
});
