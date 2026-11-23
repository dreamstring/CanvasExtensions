# SDK 2.0: composable panels

## Usage

Copy `templates/composed-panel` into the extensions directory to experiment, then enable it. It is not enabled automatically. Existing `sdk.define()` and low-level `sdk.panel()` remain available.

```js
window.FigmaExtensions.sdk.compose({
  id: 'my-tool',
  defaults: { manual: false, width: 64, height: 64 },
  panel: {
    title: 'My tool', collapsible: true, collapsed: true,
    content: [
      { type: 'checkbox', key: 'manual', label: '手动尺寸' },
      { type: 'row', children: [
        { type: 'number', key: 'width', label: '宽度', min: 1,
          enabled: ctx => ctx.state.manual },
        { type: 'number', key: 'height', label: '高度', min: 1,
          enabled: ctx => ctx.state.manual }
      ] },
      { type: 'button', key: 'run', label: '执行',
        onClick: ctx => ctx.status(`${ctx.state.width} × ${ctx.state.height}`) }
    ]
  }
});
```

Compositions use a nested shadow root, so the legacy generic form stylesheet cannot override their individual styles. Internal Figma class hashes are not part of this authoring API.

## Available declarations

| type | Properties |
|---|---|
| row | children, columns (defaults to child count) |
| column | children |
| label | text |
| text / number | key, label, placeholder; number supports min/max/step |
| checkbox | key, label |
| select | key, label, options: `{value,label}[]` |
| slider | key, label, min/max/step |
| segmented | key, label, options: `{value,label}[]` |
| button | key, label, icon, variant: primary/outline/default, onClick, tooltip |
| iconButton | key, label (accessible name), icon, onClick |
| disclosure | title, open, children |

Bound controls and buttons support `enabled(ctx)` and `visible(ctx)`. Settings auto-save by extension ID. Async button actions temporarily disable controls and report errors; a rejected action restores controls. Page/selection listeners and mounted views are removed on disposal. `scope` remains available for extra cleanup.

`sdk.ui.icon(name)` returns a 24px SVG. Current source-derived registry: plus, chevronDown, visibility. These paths were captured from actual native sidebar controls; generic unknown icons are not silently substituted.

## Evidence and acceptance levels

Actual Figma sample: 64 native sidebar controls, 27,259 readable CSSOM rules including 27,045 editor stylesheet rules. The live stylesheet URL matches the previously downloaded artifact. `ui-checks/live-reference-summary.json` contains value-only summaries. No input values or design text were captured.

Native typography tokens: medium 11px / weight 450, small 9px, strong weight 550. Controls use 24px height and radius token 5px where applicable; these values are not imposed on unrelated widgets. Captured native plus and chevron SVG canvases are 24px (the painted glyph is smaller).

`runtime/component-reference.js` stores source identity, tokens, three icon definitions, and 1,012 selected style rules, including numeric inputs, combo boxes, raw fields, native icon buttons, menus, tooltips and sliders. This is a reference catalog, not a claim that all represented widgets are implemented. Original Figma factories are never executed.

Own hidden Electron test: nested composition renders, checkbox enables/disables number fields, edited values persist, panel mounts without module errors, source-derived icons use 24px canvases. Dark/light screenshots: `ui-checks/composed-kit-dark.png` and `composed-kit-light.png`. These are our own gallery, not screenshots proving Figma pixel equivalence.

Remaining: full native mouse/keyboard state comparison; normal checkbox (live sample was a visibility toggle, not the standard checked box); native-style select popovers; tooltip replacement for browser title; slider thumb/track behavior; color picker; unit/scrub inputs; mixed values; drag reorder; scrolling/overflow and extra DPI cases. Current select uses HTML select popup semantics; disclosure and segmented selection are our implementation. Do not claim full Figma equivalence for these behaviors.

## Versioning

Host/SDK changes: host version 0.5.1. This pass does not bump GIF or texture module versions. Existing extensions continue using their own custom panel bodies; adopting `compose()` can be done independently after visual regression checks. No silent rewrite of their business logic.

SDK 2.1 增加 path、imagePreview 声明与公共目录/预览组件，详见 [公共服务](SDK-SERVICES.md#公共控件与清理)。

## 定点挂载和状态联动

`sdk.compose` 可用 `panel.target` 指定一个返回 DOM 容器或 null 的函数。例如扩展已有图片 Fill 弹窗定位器时，可直接传入该定位器。容器出现或被替换时，SDK 将同一面板挂过去，保留控件实例；扩展卸载时释放观察器。定位函数应当只读、廉价，且只返回宿主元素。面板沿用原有组件库的 Figma 主题变量与图标。

```js
sdk.compose({
  id: 'scale-panel',
  defaults: { manual: false, scale: 100 },
  panel: {
    title: 'Scale',
    content: [
      { type: 'checkbox', key: 'manual', label: '手动缩放' },
      { type: 'slider', key: 'scale', label: '缩放', min: 10, max: 200,
        enabled: ({ state }) => state.manual },
      { type: 'label', text: ({ state }) => `当前缩放 ${state.scale}%` },
      { type: 'button', label: '重置', onClick: ctx => ctx.patch({ manual: false, scale: 100 }) }
    ]
  }
});
```

滑块每次触发 `input`、复选框触发 `change` 时，SDK 保存字段并刷新当前面板。命令或按钮可用 `ctx.patch({ manual: false, scale: 100 })` 将多个字段合并保存一次，同时更新控件值、启用状态和派生文本。直接修改 `ctx.state` 后调用 `ctx.refresh()` 仅更新显示。

## SDK 2.3 组合字段和宿主按钮

`panel.nativeStyle: true` 会为面板安装已有的原生样式适配层，读取 Figma 主题变量和可用的侧栏控件样式。自定义控件的交互由 SDK 实现。

- 在 `content` 或 `children` 中传入返回节点描述的函数即可复用一组字段。函数在构建面板时运行。随状态变化的文本使用 `text: ctx => ...`。
- `{ type: 'group', title, children, enabled, visible }` 支持嵌套。组禁用时，所有后代输入和按钮随之禁用；子项仍可有自己的条件。
- `{ type: 'rangeField', key, label, min, max, step, unit }` 生成共享一个数值的滑块和数字输入框。滑动即时更新，键入数字后 Enter 或离开确认，Escape 撤回输入草稿。
- `sdk.components.targetAction({ target, label, icon, onPress, scope })` 把按钮挂到解析函数指定的宿主。提供模块的 `ctx.scope` 后会自动清理。返回对象的 `setPressed(boolean)` 同步切换按钮的视觉及无障碍状态，`dispose()` 可提前移除按钮。
- 用 `ctx.model.subscribe` 监听特定派生值；订阅的清理回调可中止过期预览。用 `ctx.patch` 同时更新多个设置。

[Fill 面板完整示例](templates/fill-panel/main.js) 同时演示工具栏按钮和表单控制同一个开关、成组启用、滑块与数字联动、实时换算、重置及卸载清理。复制示例目录到扩展目录即可按常规方式加载。

## SDK 2.4 自绘控件

可以只替换表单中的一块。声明 `{ type: 'custom', key, label, mount(container, ctx, life) }`，在 container 中创建 DOM。通过 `ctx.patch` 提交编辑，通过 `ctx.model.subscribe` 接收预设和其他字段的更新。用 `life.listen` 注册 DOM 事件，用 `life.add` 托管取消订阅或资源释放，也可以从 mount 返回一个同步清理函数。声明式字段组的禁用会传到自绘区域，卸载和初始化失败都会释放已登记资源。

[SDK Playground](templates/sdk-playground) 演示四个标准数值控件和可拖动的九宫切线共同编辑同一份状态。

`sdk.components.dragSurface({ handle, surface, scope: life, onMove({ x, y }, event) { … } })` 将捕获的主指针位置换算为相对 surface 的 0 到 1 坐标，拖出边界时夹到边缘。pointerup 提交最后位置，取消或卸载释放捕获。插件仍可直接使用 DOM 事件，自行定义不同交互。
