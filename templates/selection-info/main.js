(() => {
  const host = window.FigmaExtensions;
  const api = window.figma;
  const section = host.createSection('selection-info', 'Selection info');
  const label = document.createElement('div');
  label.style.color = 'var(--color-text-secondary, #aaa)';
  section.body.append(label);
  function refresh() {
    const count = api.currentPage.selection.length;
    label.textContent = `${count} selected`;
    section.show(count > 0);
    return { count };
  }
  host.register('selection-info', {
    commands: { refresh },
    status: () => ({ sidebarMounted: section.root.isConnected }),
    dispose() {
      api.off('selectionchange', refresh);
      api.off('currentpagechange', refresh);
      section.dispose();
    }
  });
  api.on('selectionchange', refresh);
  api.on('currentpagechange', refresh);
  refresh();
})();
