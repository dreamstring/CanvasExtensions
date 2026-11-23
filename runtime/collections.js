/* Shared query/selection policies and a keyed list for compose panels. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CanvasCollections = api;
})(globalThis, function () {
  'use strict';
  const defaultId = item => item.id;
  const defaultLabel = item => String(item.label ?? item.name ?? item.id);
  const defaultCategory = item => item.category;

  function query(items, { search = '', category = 'all', searchText = defaultLabel,
                          categoryOf = defaultCategory } = {}) {
    const term = String(search ?? '').trim().toLowerCase();
    return items.filter(item => (
      (category == null || category === 'all' || Object.is(categoryOf(item), category)) &&
      (!term || String(searchText(item)).toLowerCase().includes(term))
    ));
  }

  function select(items, selectedId, idOf = defaultId) {
    return items.find(item => Object.is(idOf(item), selectedId)) ?? items[0] ?? null;
  }

  const css = `
    .sdk-collection { display: grid; gap: 4px; }
    .sdk-collection[data-browser-view=cards] { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .sdk-collection button { display:flex; gap:6px; align-items:center; border:1px solid transparent;
      border-radius:var(--radius-medium,5px); background:var(--color-bg-secondary,#383838);
      padding:8px; color:inherit; font:inherit; cursor:pointer; }
    .sdk-collection[data-browser-view=cards] button { flex-direction:column; }
    .sdk-collection button[aria-pressed=true] { border-color:var(--color-border-selected,#0d99ff); }
    .sdk-collection button:focus-visible { outline:2px solid var(--color-border-selected,#0d99ff); }
    .sdk-collection [hidden] { display:none; }
    .sdk-collection-detail { margin-top:8px; }
  `;

  function control(options) {
    const { key, label, items, id = defaultId, itemLabel = defaultLabel,
            category = defaultCategory, searchText = itemLabel, selectionKey, searchKey,
            categoryKey, viewKey, selectable = true, renderItem, renderDetail } = options;
    if (!key || (selectable && !selectionKey)) throw TypeError('Collection requires a key and a selectionKey for selectable rows');
    return { type: 'custom', key, label, mount(container, ctx, life) {
      const doc = container.ownerDocument || document;
      const style = doc.createElement('style');
      style.textContent = css;
      const list = doc.createElement(selectable ? 'div' : 'ol');
      list.className = 'sdk-collection';
      const empty = doc.createElement('p');
      empty.setAttribute('role', 'status');
      empty.textContent = options.emptyText ?? 'No matching items';
      const detail = doc.createElement('div');
      detail.className = 'sdk-collection-detail';
      detail.setAttribute('data-browser-detail', '');
      container.append(style, list, empty, detail);
      const rows = new Map();
      function remove(row) {
        row.life?.dispose();
        row.element.onclick = null;
        row.element.remove();
      }
      life.add(() => {
        for (const row of rows.values()) remove(row);
        rows.clear();
        for (const el of [style, list, empty, detail]) el.remove();
      });
      function refresh() {
        const all = typeof items === 'function' ? items(ctx) : items;
        const ids = all.map(id);
        if (ids.some(value => typeof value !== 'string' && !Number.isFinite(value)) || new Set(ids).size !== ids.length)
          throw TypeError('Collection items need unique string or finite numeric IDs');
        const matches = query(all, { search: ctx.state[searchKey], category: ctx.state[categoryKey], searchText, categoryOf: category });
        const matching = new Set(matches.map(id));
        const active = selectable ? select(matches, ctx.state[selectionKey], id) : null;
        const activeId = active == null ? null : id(active);
        const wanted = new Set(ids);
        for (const [rowId, row] of rows) {
          if (!wanted.has(rowId)) { remove(row); rows.delete(rowId); }
        }
        list.dataset.browserView = ctx.state[viewKey] === 'cards' ? 'cards' : 'list';
        all.forEach((item, index) => {
          const rowId = ids[index];
          let row = rows.get(rowId);
          if (!row) {
            const element = doc.createElement(selectable ? 'button' : 'li');
            if (selectable) {
              element.type = 'button';
              element.onclick = () => ctx.patch({ [selectionKey]: rowId });
            }
            row = { element, item: null, life: null };
            rows.set(rowId, row);
          }
          const { element } = row;
          if (row.item !== item) {
            row.life?.dispose();
            element.replaceChildren();
            if (renderItem) {
              row.life = window.FigmaExtensions.sdk.services.scope();
              renderItem(item, element, ctx, row.life);
            } else element.textContent = itemLabel(item);
            row.item = item;
          }
          if (selectable) {
            element.setAttribute('aria-label', itemLabel(item));
            element.setAttribute('aria-pressed', String(Object.is(rowId, activeId)));
          }
          element.hidden = !matching.has(rowId);
          if (list.children[index] !== element) list.insertBefore(element, list.children[index] || null);
        });
        empty.hidden = matches.length > 0;
        detail.hidden = active == null;
        detail.replaceChildren();
        if (active != null) {
          if (renderDetail) renderDetail(active, detail, ctx);
          else detail.textContent = itemLabel(active);
        }
      }
      const watched = [searchKey, categoryKey, viewKey, selectionKey, ...(options.watchKeys || [])].filter(Boolean);
      life.add(ctx.model.watchKeys([...new Set(watched)], refresh, { immediate: true }));
    } };
  }
  // A complete searchable picker. The same public query and selection policies
  // drive the action and the displayed rows, including fallback after filtering.
  function picker(options) {
    const { key, items, label, itemLabel = defaultLabel, id = defaultId,
      searchText = itemLabel, searchKey = key + 'Search', selectionKey = key + 'Selected' } = options;
    const active = ctx => {
      const source = typeof items === 'function' ? items(ctx) : items;
      return select(query(source, { search: ctx.state[searchKey], searchText,
        category: ctx.state[options.categoryKey], categoryOf: options.category }), ctx.state[selectionKey], id);
    };
    const children = [
      { type: 'text', key: searchKey, label: options.searchLabel ?? '搜索' },
      control({ ...options, selectionKey, searchKey, selectable: true })
    ];
    if (options.onRun) children.push({ type: 'button', label: options.actionLabel ?? '执行',
      enabled: ctx => active(ctx) != null,
      onClick(ctx) {
        const item = active(ctx);
        if (item != null) return options.onRun(item, ctx);
      }
    });
    return { type: 'group', title: label, children };
  }
  return Object.freeze({ query, select, control, picker });
});
