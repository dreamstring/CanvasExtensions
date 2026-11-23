(() => {
  const { sdk } = window.FigmaExtensions;
  const scaleControls = () => ({
    type: 'group',
    title: '缩放参数',
    enabled: ({ state }) => state.manual,
    children: [
      { type: 'rangeField', key: 'scale', label: '缩放', min: 10, max: 200, step: 1, unit: '%' },
      { type: 'label', text: ({ state }) => `100 px → ${state.scale} px` }
    ]
  });

  sdk.compose({
    id: 'fill-panel-example',
    defaults: { manual: false, scale: 100 },
    setup(ctx) {
      const action = sdk.components.targetAction({
        target: sdk.targets.paintTypes,
        label: '手动缩放',
        icon: 'visibility',
        scope: ctx.scope,
        onPress: () => ctx.patch({ manual: !ctx.state.manual })
      });
      ctx.model.subscribe(state => state.manual, value => action.setPressed(value), { immediate: true });
    },
    panel: {
      target: sdk.targets.imageMode,
      position: 'after',
      nativeStyle: true,
      content: [
        { type: 'checkbox', key: 'manual', label: '手动缩放' },
        scaleControls,
        { type: 'button', label: '重置', onClick: ctx => ctx.patch({ manual: false, scale: 100 }) }
      ]
    }
  });
})();
