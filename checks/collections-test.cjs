'use strict';
const assert = require('node:assert/strict');
const { query, select, control } = require('../runtime/collections.js');
const { create } = require('../runtime/ui-model.js');
const { scope } = require('../runtime/services.js');
global.window = { FigmaExtensions: { sdk: { services: { scope } } } };

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.ownerDocument = doc; }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, ref) {
    node.remove();
    this.children.splice(ref ? this.children.indexOf(ref) : this.children.length, 0, node);
    node.parent = this;
  }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.textContent = ''; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
}
const doc = { createElement: tag => new Element(tag) };
const items = [{ id: 'a', name: 'Arrow', category: 'glyph' }, { id: 'g', name: 'Grain', category: 'texture' }];
assert.deepEqual(query(items, { search: '  AR ', category: 'glyph' }), [items[0]]);
assert.deepEqual(query(items, { search: 'AR', category: 'texture' }), []);
assert.equal(select(items, 'missing'), items[0]);
assert.equal(select(items, 'g'), items[1]);
assert.equal(select([], 'a'), null);
assert.throws(() => control({ key: 'items', items }), /selectionKey/);

const container = new Element('section'), life = scope();
const model = create({ term: '', active: 'g', shape: 'cards', rows: items });
const ctx = { model, state: model.state, patch: model.patch };
const cleanups = [];
const component = control({
  key: 'list', items: ctx => ctx.state.rows, searchKey: 'term', selectionKey: 'active', viewKey: 'shape', watchKeys: ['rows'],
  renderItem(item, button, ctx, rowLife) {
    button.textContent = item.name; rowLife.add(() => cleanups.push(item.id));
  },
  renderDetail(item, detail) { detail.textContent = item.name; }
});
component.mount(container, ctx, life);
const [, list, empty, detail] = container.children;
assert.equal(list.dataset.browserView, 'cards');
assert.equal(detail.textContent, 'Grain');
const arrow = list.children[0];
arrow.onclick();
assert.equal(ctx.state.active, 'a');
model.patch({ term: 'grain' });
assert.equal(detail.textContent, 'Grain');
assert.equal(ctx.state.active, 'a');
assert.equal(arrow.hidden, true);
model.patch({ term: 'no match' });
assert.equal(empty.hidden, false);
assert.equal(detail.hidden, true);
model.patch({ term: '', shape: 'list', rows: items.toReversed() });
assert.equal(list.children[1], arrow);
assert.equal(list.dataset.browserView, 'list');
model.patch({ rows: [items[1]] });
assert.deepEqual(cleanups, ['a']);
assert.equal(arrow.onclick, null);
life.dispose();
assert.deepEqual(cleanups, ['a', 'g']);
assert.equal(container.children.length, 0);
const readOnly = new Element('section'), readLife = scope();
control({ key: 'readonly', items, selectable: false }).mount(readOnly, ctx, readLife);
assert.equal(readOnly.children[1].tag, 'ol');
assert.equal(readOnly.children[1].children[0].textContent, 'Arrow');
readLife.dispose();
model.dispose();
console.log('PASS collections: query, fallback selection, row identity and cleanup, filter, reorder, default and custom content');
