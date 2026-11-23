/* Read-only DOM targets for extension panels. Every lookup resolves the current host. */
(() => {
 'use strict';

 function unique(elements) {
  const candidates = new Set(elements);
  return candidates.size === 1 ? candidates.values().next().value : null;
 }

 function available(element) {
  return !element.closest('[hidden],[inert],[aria-hidden="true"]');
 }

 function within(parent, selector) {
  if (typeof parent !== 'function' || typeof selector !== 'string' || !selector.trim()) {
   throw new TypeError('within requires a parent resolver and a CSS selector');
  }
  return () => {
   const container = parent();
   return container ? unique([...container.querySelectorAll(selector)].filter(available)) : null;
  };
 }

 const rightSidebar = within(() => document, '[aria-label="Right sidebar"]');

 function paintDialogs() {
  const dialogs = [];
  for (const radio of document.querySelectorAll('[role="dialog"] input[type="radio"],[role="dialog"] [role="radio"]')) {
   const image = radio.value === 'IMAGE' || radio.getAttribute('aria-label') === 'Image' || radio.id?.endsWith('-IMAGE');
   if (!image || !available(radio)) continue;
   const dialog = radio.closest('[role="dialog"]');
   const group = radio.closest('fieldset,[role="radiogroup"]');
   if (group && group.closest('[role="dialog"]') === dialog && dialog) dialogs.push(dialog);
  }
  return [...new Set(dialogs)];
 }

 const subscriptions = new Set();
 let observer = null;

 function observe(resolve, listener, {valid} = {}) {
  if (typeof resolve !== 'function' || typeof listener !== 'function') {
   throw new TypeError('observe requires a target resolver and a listener');
  }

  if (valid !== undefined && typeof valid !== 'function') throw new TypeError('valid must be a function');

  // A separate sentinel ensures the initial empty location is delivered too.
  let previous = Symbol('unresolved');
  function update() {
   const target = resolve() ?? null;
   if (previous === target && (!valid || valid(target))) return;
   previous = target;
   listener(target);
  }
  function unsubscribe() {
   subscriptions.delete(update);
   if (!subscriptions.size && observer) {
    observer.disconnect();
    observer = null;
   }
  }

  if (!observer) {
   const shared = new MutationObserver(() => {
    for (const subscriber of [...subscriptions]) {
     if (!subscriptions.has(subscriber)) continue;
     try { subscriber(); }
     catch (error) { console.error('Canvas Extensions: target resolution failed', error); }
    }
   });
   // Arbitrary author selectors may depend on class, style or data-* changes.
   shared.observe(document.documentElement, {childList: true, subtree: true, attributes: true});
   observer = shared;
  }
  subscriptions.add(update);
  try { update(); }
  catch (error) { unsubscribe(); throw error; }
  return unsubscribe;
 }

 // Named slots have the same resolver contract as an author's custom target.
 function paintDialog() { return unique(paintDialogs()); }
 function typeGroups(dialog) {
  return [...new Set([...dialog.querySelectorAll('input[type="radio"],[role="radio"]')]
   .filter(radio => available(radio) && radio.closest('[role="dialog"]') === dialog &&
     (radio.value === 'IMAGE' || radio.getAttribute('aria-label') === 'Image' || radio.id?.endsWith('-IMAGE')))
   .map(radio => radio.closest('fieldset,[role="radiogroup"]')).filter(Boolean))];
 }
 function modeControls(dialog) {
  return [...dialog.querySelectorAll('[role="combobox"]')].filter(el =>
   available(el) && el.closest('[role="dialog"]') === dialog &&
   /^(Fill|Fit|Crop|Tile|Box|填充|适应|裁剪|平铺)$/.test(el.textContent.trim()));
 }
 function paintTypes(dialog = paintDialog()) { return dialog && unique(typeGroups(dialog)); }
 function imageMode(dialog = paintDialog()) { return dialog && unique(modeControls(dialog)); }
 const slots = Object.freeze({rightSidebar, paintDialog, paintTypes, imageMode});
 function inspect() {
  const matches = [];
  for (const element of document.querySelectorAll('[aria-label="Right sidebar"]')) {
   if (available(element)) matches.push({name:'rightSidebar',element});
  }
  for (const dialog of paintDialogs()) {
   matches.push({name:'paintDialog',element:dialog});
   for (const element of typeGroups(dialog)) matches.push({name:'paintTypes',element});
   for (const element of modeControls(dialog)) matches.push({name:'imageMode',element});
  }
  return matches;
 }
 function insert({target, element, position = 'append', scope}) {
  if (!['append','prepend','before','after'].includes(position)) throw TypeError('Unknown insert position: ' + position);
  if (!element || element.parentNode) throw TypeError('insert requires a detached extension element');
  const sibling = position === 'before' || position === 'after';
  let stop;
  try {
   stop = observe(target, anchor => {
    if (anchor) anchor[position](element);
    else element.remove();
   }, {valid: anchor => anchor ? element.parentElement === (sibling ? anchor.parentElement : anchor) : !element.parentElement});
  } catch (error) { element.remove(); throw error; }
  function dispose() { stop(); element.remove(); }
  scope?.add(dispose);
  return dispose;
 }
 window.CanvasUITargets = Object.freeze({rightSidebar, paintDialog, paintTypes, imageMode, slots, inspect, insert, within, observe});
})();
