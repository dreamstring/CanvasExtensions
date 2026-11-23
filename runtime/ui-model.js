/* Synchronous, shallow state bindings for extension controls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CanvasUIModel = api;
})(globalThis, function () {
  'use strict';

  function create(state = {}, { onChange } = {}) {
    const subscriptions = new Set();
    let disposed = false;
    let notifying = false;
    let dirty = false;
    let batchDepth = 0;

    function release(subscription) {
      const cleanup = subscription.cleanup;
      subscription.cleanup = null;
      if (cleanup) cleanup();
    }

    function deliver(subscription, next, previous) {
      const delivery = ++subscription.revision;
      let active = true;
      function onCleanup(fn) {
        if (!active) throw Error('Register cleanup during the subscription callback');
        if (typeof fn !== 'function') throw TypeError('Expected a cleanup function');
        if (subscription.revision !== delivery || !subscriptions.has(subscription)) {
          fn();
          return;
        }
        if (subscription.cleanup) throw Error('Only one cleanup per callback');
        subscription.cleanup = fn;
      }
      try {
        subscription.listener(next, previous, onCleanup);
      } finally {
        active = false;
      }
    }

    function flush() {
      if (notifying) return;
      notifying = true;
      const errors = [];
      try {
        while (dirty && !disposed) {
          dirty = false;
          for (const subscription of Array.from(subscriptions)) {
            if (!subscriptions.has(subscription)) continue;
            try {
              const next = subscription.select(state);
              const previous = subscription.value;
              if (subscription.equals(next, previous)) continue;
              subscription.value = next;
              release(subscription);
              if (subscriptions.has(subscription)) deliver(subscription, next, previous);
            } catch (error) {
              errors.push(error);
            }
          }
        }
      } finally {
        notifying = false;
      }
      if (!disposed) onChange?.(state);
      if (errors.length) throw errors[0];
    }

    function patch(changes) {
      if (disposed) return false;
      const updates = Object.entries(changes).filter(([key, value]) =>
        !Object.hasOwn(state, key) || !Object.is(state[key], value));
      if (!updates.length) return false;
      for (const [key, value] of updates) {
        Object.defineProperty(state, key, { value, configurable: true, writable: true, enumerable: true });
      }
      dirty = true;
      if (!batchDepth) flush();
      return true;
    }

    function batch(change) {
      if (disposed) return;
      batchDepth++;
      try {
        return change();
      } finally {
        batchDepth--;
        if (!batchDepth && dirty && !disposed) flush();
      }
    }

    function subscribe(select, listener, { immediate = false, equals = Object.is } = {}) {
      if (disposed) throw Error('UI model has been disposed');
      const subscription = { select, listener, equals, value: select(state), cleanup: null, revision: 0 };
      subscriptions.add(subscription);
      function stop() {
        if (subscriptions.delete(subscription)) release(subscription);
      }
      if (immediate) {
        try {
          deliver(subscription, subscription.value, undefined);
        } catch (error) {
          stop();
          throw error;
        }
      }
      return stop;
    }

    function watchKeys(keys, listener, options) {
      const fields = Array.from(keys);
      return subscribe(state => fields.map(key => state[key]), listener, {
        ...options,
        equals: (next, previous) => next.every((value, index) => Object.is(value, previous[index]))
      });
    }

    function derive(select) {
      return Object.freeze({ get value() { return select(state); } });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      const pending = Array.from(subscriptions);
      subscriptions.clear();
      let firstError;
      for (const subscription of pending.reverse()) {
        try { release(subscription); } catch (error) { firstError ??= error; }
      }
      if (firstError) throw firstError;
    }

    return Object.freeze({ state, patch, batch, derive, subscribe, watchKeys, dispose });
  }
  return Object.freeze({ create });
});
