const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let sidebars = [], radios = [];
const sidebarSelector = '[aria-label="Right sidebar"]';
const radioSelector = '[role="dialog"] input[type="radio"],[role="dialog"] [role="radio"]';
const hiddenSelector = '[hidden],[inert],[aria-hidden="true"]';
const document = {
 querySelectorAll(selector) {
  if (selector === sidebarSelector) return sidebars;
  assert.equal(selector, radioSelector);
  return radios;
 }
};
const window = {};
let observed = 0, disconnected = 0, changed;
document.documentElement = {};
class MutationObserver {
 constructor(notify) {changed = notify;}
 observe(root, options) {
  assert.equal(root, document.documentElement);
  assert.ok(options.attributes && options.subtree && options.childList);
  assert.equal(options.attributeFilter, undefined, 'custom selectors can use any attribute');
  observed++;
 }
 disconnect() {disconnected++;}
}
vm.runInNewContext(fs.readFileSync(require.resolve('../runtime/ui-targets.js'), 'utf8'), {document, window, MutationObserver});
const {rightSidebar, paintDialog, within} = window.CanvasUITargets;
const element = () => ({ hidden: false, closest(selector) {
 assert.equal(selector, hiddenSelector);
 return this.hidden ? this : null;
}});
const sidebar = element(), row = element();
sidebar.querySelectorAll = selector => {assert.equal(selector, '.row');return [row];};
const locateRow = within(rightSidebar, '.row');
assert.equal(locateRow(), null);
sidebars = [sidebar];
assert.equal(locateRow(), row);
row.hidden = true;
assert.equal(locateRow(), null);
sidebars.push(element());
assert.equal(rightSidebar(), null);

function radio(dialog, value, hidden = false, groupDialog = dialog) {
 return { value, getAttribute: () => null, closest(selector) {
  if (selector === hiddenSelector) return hidden ? this : null;
  if (selector === '[role="dialog"]') return dialog;
  assert.equal(selector, 'fieldset,[role="radiogroup"]');
  return {closest: () => groupDialog};
 }};
}
const first = {}, second = {};
radios = [radio(first, 'GRADIENT'), radio(second, 'IMAGE', true), radio(second, 'IMAGE', false, first)];
assert.equal(paintDialog(), null);
radios.push(radio(first, 'IMAGE'), radio(first, 'IMAGE'));
assert.equal(paintDialog(), first);
radios.push(radio(second, 'IMAGE'));
assert.equal(paintDialog(), null);
radios = [radio(second, 'IMAGE')];
assert.equal(paintDialog(), second);
console.log('PASS SDK targets: scoped and unique matches, hidden ancestry, group ownership, repeated paints and replaced dialog');

const {observe} = window.CanvasUITargets, calls = [];
let target = null, attached = true;
const stop = observe(() => target, value => {calls.push(value);attached = true;}, {valid: () => attached});
let secondCalls = 0;
const stopSecond = observe(() => null, () => secondCalls++);
assert.equal(observed, 1);
assert.deepEqual(calls, [null]);
target = first;
changed();
changed();
assert.deepEqual(calls, [null, first]);
assert.equal(secondCalls, 1);
attached = false;
changed();
assert.deepEqual(calls, [null, first, first]);
stopSecond();
assert.equal(disconnected, 0);
target = null;
changed();
assert.deepEqual(calls, [null, first, first, null]);
stop();stop();
assert.equal(disconnected, 1);
assert.throws(() => observe(() => {throw Error('invalid selector');}, () => {}), /invalid selector/);
assert.equal(observed, 2);
assert.equal(disconnected, 2);
console.log('PASS shared target observer: initial and distinct delivery, custom attributes, lost mount repair and final teardown');
