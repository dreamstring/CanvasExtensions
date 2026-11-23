(() => {
  'use strict';
  const collections = window.FigmaExtensions.sdk.collections;
  const commands = [
    { id: 'guides', label: '切换参考线', execute(ctx) {
      const visible = !ctx.state.commandGuides;
      ctx.patch({ commandGuides: visible, commandFeedback: visible ? '已显示参考线' : '已隐藏参考线' });
    } },
    { id: 'mark', label: '增加标记', execute(ctx) {
      const count = ctx.state.commandMarks + 1;
      ctx.patch({ commandMarks: count, commandFeedback: '已添加标记 ' + count });
    } },
    { id: 'clear', label: '清空标记', execute(ctx) {
      ctx.patch({ commandMarks: 0, commandFeedback: '已清空标记' });
    } }
  ];
  const defaults = {
    commandSearch: '', commandSelected: 'guides', commandFeedback: '',
    commandMarks: 0, commandGuides: false
  };
  const content = [
    collections.picker({
      key: 'commandList', label: '命令', items: commands,
      searchKey: 'commandSearch', selectionKey: 'commandSelected',
      searchLabel: '搜索命令', actionLabel: '执行命令', emptyText: '没有匹配的命令',
      onRun: (command, ctx) => command.execute(ctx)
    }),
    { type: 'label', text: ({ state }) => state.commandFeedback },
    { type: 'label', text: ({ state }) => '参考线' + (state.commandGuides ? '开启' : '关闭') + ' · 标记 ' + state.commandMarks }
  ];
  window.CanvasPlaygroundCommands = { defaults, content };
})();
