'use strict';
const assert = require('node:assert/strict');
const { dragSurface } = require('../runtime/pointer-input.js');
const listeners = new Map();
let captured = null, cleanup;
const handle = {
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: name => listeners.delete(name),
  setPointerCapture: id => { captured = id; },
  hasPointerCapture: id => captured === id,
  releasePointerCapture: id => { assert.equal(id, captured); captured = null; },
  focus() {}
};
const rect = { left: 10, top: 20, width: 100, height: 50 };
const points = [];
const stop = dragSurface({ handle, surface: { getBoundingClientRect: () => rect },
  scope: { add: fn => { cleanup = fn; } }, onMove: point => points.push(point) });
function send(name, options = {}) {
  listeners.get(name)?.({ button: 0, isPrimary: true, pointerId: 1, clientX: 60, clientY: 45,
    preventDefault() {}, ...options });
}
for (const input of [{ button: 2 }, { isPrimary: false }]) {
  send('pointerdown', input); assert.equal(captured, null);
}
send('pointerdown'); assert.equal(captured, 1);
send('pointerdown', { pointerId: 2 }); send('pointermove', { pointerId: 2 });
send('pointerup', { pointerId: 2 }); assert.equal(captured, 1); assert.deepEqual(points, []);
send('pointermove'); assert.deepEqual(points.pop(), { x: .5, y: .5 });
rect.width = 0; send('pointermove'); assert.deepEqual(points, []); rect.width = 100;
send('pointerup', { clientX: -1, clientY: 200 });
assert.deepEqual(points.pop(), { x: 0, y: 1 }); assert.equal(captured, null);
for (const event of ['pointercancel', 'lostpointercapture']) {
  send('pointerdown'); send(event); send('pointermove'); assert.deepEqual(points, []);
}
handle.disabled = true; send('pointerdown'); assert.equal(captured, null);
handle.disabled = false; send('pointerdown'); cleanup();
assert.equal(captured, null); assert.equal(listeners.size, 0); stop();
console.log('PASS pointer input: capture, ownership, normalization, cancellation and unmount');
