(() => {
  'use strict';
  const layers = [
    { id: 'Background', name: '背景', locked: true },
    { id: 'Title', name: '标题', locked: false },
    { id: 'Texture', name: '纹理', locked: false }
  ];
  const defaults = {};
  for (const layer of layers) {
    defaults['visible' + layer.id] = true;
    defaults['locked' + layer.id] = layer.locked;
  }
  const content = [
    ...layers.map(layer => ({
      type: 'row', columns: 2, children: [
        { type: 'checkbox', key: 'visible' + layer.id, label: layer.name + ' 可见' },
        { type: 'checkbox', key: 'locked' + layer.id, label: layer.name + ' 锁定' }
      ]
    })),
    { type: 'label', text: ({ state }) => {
      const visible = layers.filter(layer => state['visible' + layer.id]).length;
      const locked = layers.filter(layer => state['locked' + layer.id]).length;
      return '可见 ' + visible + ' / ' + layers.length + ' · 锁定 ' + locked + ' / ' + layers.length;
    } },
    { type: 'button', key: 'layerReset', label: '恢复初始图层状态', onClick: ctx => ctx.patch(defaults) }
  ];
  window.CanvasPlaygroundLayers = { defaults, content };
})();
