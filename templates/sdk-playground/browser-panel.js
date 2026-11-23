(() => {
  'use strict';
  const assets = [
    { name: 'Arrow Right', category: 'icon', glyph: '→', size: '24 × 24', tags: 'arrow navigation 导航 箭头' },
    { name: 'Close', category: 'icon', glyph: '×', size: '16 × 16', tags: 'dismiss close 关闭' },
    { name: 'Paper Grain', category: 'texture', glyph: '░', size: '512 × 512', tags: 'paper grain noise 纸张 颗粒' },
    { name: 'Grid', category: 'texture', glyph: '▦', size: '128 × 128', tags: 'grid tile 网格 平铺' }
  ];
  const defaults = { browserSearch: '', browserCategory: 'all', browserView: 'cards', browserSelected: 'Arrow Right' };

  const results = window.FigmaExtensions.sdk.collections.control({
    key: 'browserResults', label: '素材', items: assets, id: asset => asset.name,
    itemLabel: asset => asset.name, searchText: asset => asset.name + ' ' + asset.tags,
    category: asset => asset.category, searchKey: 'browserSearch', categoryKey: 'browserCategory',
    viewKey: 'browserView', selectionKey: 'browserSelected', emptyText: '没有匹配的素材',
    renderItem(asset, button) {
      const thumb = document.createElement('span');
      thumb.textContent = asset.glyph;
      thumb.setAttribute('aria-hidden', 'true');
      thumb.style.fontSize = '20px';
      button.append(thumb, document.createTextNode(asset.name));
    },
    renderDetail(asset, container) {
      container.textContent = [asset.name, asset.category === 'icon' ? '图标' : '纹理', asset.size].join(' · ');
    }
  });

  const content = [{
    type: 'group', title: '素材浏览器', children: [
      { type: 'text', key: 'browserSearch', label: '搜索素材', placeholder: '名称或关键词' },
      { type: 'select', key: 'browserCategory', label: '类别', options: [
        { value: 'all', label: '全部' }, { value: 'icon', label: '图标' }, { value: 'texture', label: '纹理' }
      ] },
      { type: 'segmented', key: 'browserView', label: '视图', options: [
        { value: 'cards', label: '卡片' }, { value: 'list', label: '列表' }
      ] },
      results
    ]
  }];
  window.CanvasPlaygroundBrowser = { defaults, content };
})();
