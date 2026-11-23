# Canvas Extensions SDK 开发手册

Canvas Extensions 0.7.0 随附 SDK 2.6。一个扩展由清单和 JavaScript 脚本组成，管理器按清单发现、启用并加载扩展。

## 选择开发方式

| 要实现的交互 | 从哪里开始 |
| --- | --- |
| 在侧栏放几个输入框，由复选框控制宽度是否可编辑 | [最小示例](#最小示例) |
| 用原生风格控件拼出表单、工具条或分组 | [组合面板与控件](#组合面板与控件) |
| 让滑块、数字框和自绘预览同步 | [状态与控件联动](#状态与控件联动) |
| 把按钮放进已有的 Fill 面板 | [在已有界面中挂载](#在已有界面中挂载) |
| 搜索素材、选择列表项、更新详情 | [集合与选择](#集合与选择) |
| 处理选区变化、异步图片任务、目录或批量输出 | [任务与公共服务](#任务与公共服务) |

可以先用声明式字段完成表单，再给个别区域加入自绘控件。若要先看操作效果，打开 [SDK Playground 的八个面板](templates/sdk-playground/README.md)。

## 文件布局

`%LOCALAPPDATA%/FigmaGifAssistant/extensions/<id>/module.json` 和功能脚本。
首次启动从发布包复制三个普通模块示例；已存在的目录不会被覆盖。扩展修改后重新扫描，再退出 Figma、应用扩展并重新启动。运行中的 Figma 不会热更新。
更新扩展可直接替换对应目录文件，保留相同 ID；主程序版本无需改变。发布包中的模块是首次安装种子，不是更高优先级的隐藏副本。修改前建议复制目录备份；不要同时保留相同 ID 的两个目录。

## 最小示例

复制 `templates/sdk-example` 到扩展目录，重新扫描后启用。清单包含 schemaVersion、id、name、version、description、permission、scripts、commands、可选 minimumSdk（公共服务要求 2.1）、nativeCapabilities。版本属于扩展自身。

```js
window.FigmaExtensions.sdk.define({
  id: 'my-tool',
  defaults: { enabled: false, width: 64 },
  panel: {
    title: 'My tool',
    visible: ctx => ctx.selection().length > 0,
    rows: [
      [{ key: 'enabled', type: 'checkbox', label: '手动尺寸' }],
      [{ key: 'width', type: 'number', label: '宽度', min: 1,
         enabled: ctx => ctx.state.enabled }],
      [{ key: 'run', type: 'button', label: '执行',
         onClick: ctx => ctx.status('宽度：' + ctx.state.width) }]
    ]
  }
});
```

## 声明式接口

- `panel.title`、`panel.visible(ctx)`、`panel.rows`：右栏标题、显示条件和行布局，每行字段平分宽度。
- 字段：`text`、`number`、`slider`、`checkbox`、`select`、`button`；支持 label、key、placeholder、min/max/step、enabled(ctx)。select 的 options 为 `{value,label}[]`。
- `defaults`：默认状态；输入自动持久化到按扩展 ID 隔离的 localStorage。`storageKey` 可指定旧版键，便于迁移。
- `onChange(ctx,key)`、字段 `onChange(ctx)`、`onClick(ctx)`、`onRefresh(ctx)`、`setup(ctx)`、`dispose(ctx)`、`commands`、`status(ctx)`：业务回调。
- ctx：`api`、`state`、`selection()`、`settings.save()/set()`、`status(text)`、`refresh()`、`scope`、`section`、`native(operation,payload)`。
- SDK 自动处理主题、字体、间距、禁用态、选区/页面变化和销毁。
- `scope.on(event,fn)`、`scope.interval(fn,ms)`、`scope.add(cleanup)`：随扩展卸载自动清理。

## 复杂面板

现有复杂扩展可以组合低层接口，不必强制重写成表单：
`sdk.panel(id,{title})`、`sdk.settings(id,defaults,storageKey)`、`sdk.scope(api)`。
纹理导出使用这些接口并保留图片预览等自定义内容；GIF 的引擎和专用面板仍在自己的扩展目录。SDK 不承载这两个扩展的业务逻辑。

## 权限与范围

本地能力白名单：export-png、open-export-folder、choose-export-folder。SDK 不提供任意磁盘写入和任意命令执行。
扩展脚本必须在自身目录中。read-design/write-design 是权限说明，不是隔离沙箱；只加载信任的脚本。
当前 SDK 包含基础表单控件；任意新图标、复杂控件、更多本地能力需另行扩展，不宣称支持未实现的控件。

## 组合面板与控件

### Usage

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

### Available declarations

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

### Evidence and acceptance levels

Actual Figma sample: 64 native sidebar controls, 27,259 readable CSSOM rules including 27,045 editor stylesheet rules. The live stylesheet URL matches the previously downloaded artifact. `ui-checks/live-reference-summary.json` contains value-only summaries. No input values or design text were captured.

Native typography tokens: medium 11px / weight 450, small 9px, strong weight 550. Controls use 24px height and radius token 5px where applicable; these values are not imposed on unrelated widgets. Captured native plus and chevron SVG canvases are 24px (the painted glyph is smaller).

`runtime/component-reference.js` stores source identity, tokens, three icon definitions, and 1,012 selected style rules, including numeric inputs, combo boxes, raw fields, native icon buttons, menus, tooltips and sliders. This is a reference catalog, not a claim that all represented widgets are implemented. Original Figma factories are never executed.

Own hidden Electron test: nested composition renders, checkbox enables/disables number fields, edited values persist, panel mounts without module errors, source-derived icons use 24px canvases. Dark/light screenshots: `ui-checks/composed-kit-dark.png` and `composed-kit-light.png`. These are our own gallery, not screenshots proving Figma pixel equivalence.

Remaining: full native mouse/keyboard state comparison; normal checkbox (live sample was a visibility toggle, not the standard checked box); native-style select popovers; tooltip replacement for browser title; slider thumb/track behavior; color picker; unit/scrub inputs; mixed values; drag reorder; scrolling/overflow and extra DPI cases. Current select uses HTML select popup semantics; disclosure and segmented selection are our implementation. Do not claim full Figma equivalence for these behaviors.

### Versioning

Host/SDK changes: host version 0.5.1. This pass does not bump GIF or texture module versions. Existing extensions continue using their own custom panel bodies; adopting `compose()` can be done independently after visual regression checks. No silent rewrite of their business logic.

SDK 2.1 增加 path、imagePreview 声明与公共目录/预览组件，详见 [公共服务](SDK.md#公共控件与清理)。

### 定点挂载和状态联动

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

### SDK 2.3 组合字段和宿主按钮

`panel.nativeStyle: true` 会为面板安装已有的原生样式适配层，读取 Figma 主题变量和可用的侧栏控件样式。自定义控件的交互由 SDK 实现。

- 在 `content` 或 `children` 中传入返回节点描述的函数即可复用一组字段。函数在构建面板时运行。随状态变化的文本使用 `text: ctx => ...`。
- `{ type: 'group', title, children, enabled, visible }` 支持嵌套。组禁用时，所有后代输入和按钮随之禁用；子项仍可有自己的条件。
- `{ type: 'rangeField', key, label, min, max, step, unit }` 生成共享一个数值的滑块和数字输入框。滑动即时更新，键入数字后 Enter 或离开确认，Escape 撤回输入草稿。
- `sdk.components.targetAction({ target, label, icon, onPress, scope })` 把按钮挂到解析函数指定的宿主。提供模块的 `ctx.scope` 后会自动清理。返回对象的 `setPressed(boolean)` 同步切换按钮的视觉及无障碍状态，`dispose()` 可提前移除按钮。
- 用 `ctx.model.subscribe` 监听特定派生值；订阅的清理回调可中止过期预览。用 `ctx.patch` 同时更新多个设置。

[Fill 面板完整示例](templates/fill-panel/main.js) 同时演示工具栏按钮和表单控制同一个开关、成组启用、滑块与数字联动、实时换算、重置及卸载清理。复制示例目录到扩展目录即可按常规方式加载。

### SDK 2.4 自绘控件

可以只替换表单中的一块。声明 `{ type: 'custom', key, label, mount(container, ctx, life) }`，在 container 中创建 DOM。通过 `ctx.patch` 提交编辑，通过 `ctx.model.subscribe` 接收预设和其他字段的更新。用 `life.listen` 注册 DOM 事件，用 `life.add` 托管取消订阅或资源释放，也可以从 mount 返回一个同步清理函数。声明式字段组的禁用会传到自绘区域，卸载和初始化失败都会释放已登记资源。

[SDK Playground](templates/sdk-playground) 演示四个标准数值控件和可拖动的九宫切线共同编辑同一份状态。

`sdk.components.dragSurface({ handle, surface, scope: life, onMove({ x, y }, event) { … } })` 将捕获的主指针位置换算为相对 surface 的 0 到 1 坐标，拖出边界时夹到边缘。pointerup 提交最后位置，取消或卸载释放捕获。插件仍可直接使用 DOM 事件，自行定义不同交互。

## 状态与控件联动

`CanvasUIModel.create(state, { onChange })` 以普通可写对象保存状态。派生值、订阅和批量更新均可独立测试。状态字段采用浅比较，数组或对象内容发生变化时应传入新的引用。

| 调用 | 行为 |
| --- | --- |
| `model.patch({ manual: true, scale: 75 })` | 先写入整组字段，再计算订阅的选择值。返回值表示是否有字段变化。 |
| `model.derive(s => s.scale + '%')` | 返回只读视图，每次读取 `.value` 时从当前状态计算。 |
| `model.subscribe(select, listener, { immediate: true })` | 首次立即运行，之后仅在选取值发生变化时运行。返回停止订阅函数。 |
| `model.dispose()` | 结束所有订阅，清理其资源；此后的 patch 返回 false。 |

`listener(next, previous, onCleanup)` 可在同步阶段注册一个清理函数。SDK 在下次调用该监听器前、取消订阅时或模型释放时执行清理。以下示例在滑块再次变化时取消前一帧计划的预览绘制。

```js
const stop = model.subscribe(
  state => state.scale,
  (scale, previous, onCleanup) => {
    const frame = requestAnimationFrame(() => drawPreview(scale));
    onCleanup(() => cancelAnimationFrame(frame));
  },
  { immediate: true }
);
```

`onChange(state)` 在一次有变化的 patch 完成通知后运行，可用于统一持久化或刷新。监听器内部再次 patch 时，外层更新完成后调用一次 onChange。直接修改原始对象不会触发订阅。独立创建模型的扩展应在卸载时调用 dispose。

### 合并一次用户操作

`model.batch(() => { ... })` 将回调中的同步 patch 合并为一轮通知。回调内可读到刚更新的字段，订阅者在最外层 batch 结束后看到最终组合。compose 的字段 change 与其 onChange 中的同步联动默认使用此语义。回调抛错时，已写入的状态仍会派发；await 之后的写入是独立的一轮。

自绘控件同时依赖几个字段时，可用 `ctx.model.watchKeys(['left', 'right'], (values, previous, onCleanup) => ..., { immediate: true })`。只有列出的字段值发生变化才会再次通知。返回取消订阅函数，可交给自绘控件的 life.add。

## 在已有界面中挂载

将解析函数传给 `sdk.compose` 的 `panel.target`。SDK 会在挂载时调用它，并在宿主 DOM 的子节点发生变化后重新定位。每次返回当前元素，返回 `null` 表示暂时没有可用位置。

| 解析函数 | 定位条件 |
| --- | --- |
| `sdk.targets.rightSidebar` | 唯一带有 `aria-label="Right sidebar"` 的宿主侧栏；此标记来自管理器现有侧栏实现。 |
| `sdk.targets.paintDialog` | 唯一含有 Image 填充类型单选项和所属单选组的对话框，沿用 Box 模块的 DOM 标记。在具有 Image 选项的填充弹窗中可用，当前选中的填充类型可以是其他类型。 |
| `sdk.targets.within(parent, selector)` | 创建一个解析函数，在 parent() 返回的容器内查找唯一符合 CSS 选择器的后代。 |

以上定位会排除带有 hidden、inert、aria-hidden="true" 的元素及其后代。同一次查找出现多个候选容器时返回 null；当宿主替换元素后，下次查找会返回新元素。CSS 选择器由作者提供，无效的选择器会抛出浏览器异常。Figma 版本变更可能改变内部 DOM 标记。

直接在填充弹窗中挂载使用主题变量的自定义控件：

```js
const sdk = window.FigmaExtensions.sdk;
sdk.compose({
  id: 'paint-info',
  panel: {
    target: sdk.targets.paintDialog,
    content: [{ type: 'label', text: 'Paint tools' }]
  }
});
```

若扩展在侧栏中已有一个自有容器，可在其中嵌入第二个扩展面板。定位函数可跨多次宿主替换复用：

```js
const target = sdk.targets.within(sdk.targets.rightSidebar, '[data-my-extension-slot="tools"]');
```

挂载组件继承 Figma 主题变量。面板内的文案与控件由扩展提供。请使用专属选择器定位宿主容器，避免将扩展刚挂载的子节点也匹配为下一次挂载位置。

### 观察位置变化

`sdk.targets.observe(resolve, listener)` 同步通知首次结果（含 null），之后在目标元素发生变化时通知。返回的函数用于取消订阅，可交由 `ctx.scope.add` 清理。所有订阅共享一个 document MutationObserver；它观察子节点和属性变更，因此 class、style、aria-label、hidden、inert 和自定义 data 属性均可参与定位。最后一个订阅结束时断开观察器。选择器只在 DOM 变更回调中重新执行，建议将范围收窄到相关容器。仅通过 JavaScript 属性更新且无 DOM 变更的状态由扩展自己监听。

可传入第三个参数 `{ valid: target => ... }` 检查已有挂载是否完好。宿主清空子节点且容器本身保留时，valid 返回 false 会为同一个容器再次通知；listener 应修复挂载以恢复有效状态。

### SDK 2.6 已有面板内的插入点

`sdk.targets.inspect()` 枚举当前文档中匹配已注册类型的所有位置，返回包含 name、element 的数组。当前类型为 rightSidebar、paintDialog、paintTypes（填充类型按钮组）、imageMode（图片模式选择器）。关闭的弹窗不在结果中；多个弹窗可逐个拿到 DOM 元素。具名解析器默认要求唯一匹配，也可用 paintTypes(dialog)、imageMode(dialog) 将查找限定在已选弹窗。新的宿主结构可通过 within(parent, selector) 或自己的解析函数定位。

- 只加一个控件：`sdk.targets.insert({target: sdk.targets.imageMode, position: 'before', element, scope: ctx.scope})`。传入扩展创建的独立元素。默认 append，也支持 prepend、before、after。
- 加工具栏动作：`sdk.components.targetAction({target: sdk.targets.paintTypes, label, icon, onPress, scope: ctx.scope})`。
- 加整组字段：`panel: {target: sdk.targets.imageMode, position: 'after', nativeStyle: true, content: [...]}`。

定位器在宿主更新时重新求值；弹窗关闭时移除扩展元素，重开时挂回，scope 结束时注销。已有宿主节点的点击、隐藏或替换逻辑属于扩展自己的行为。已知插入点及语言标签取决于 Figma 宿主版本。

## 集合与选择

`sdk.collections` 提供三个层次的复用。纯查询与选择可用于命令和启用条件；面板可采用默认列表，也可以自绘条目与详情。每条数据需有稳定、唯一的字符串或数值 ID。

```js
const { query, select } = sdk.collections;
const matches = query(items, {
  search: ctx.state.term,
  category: ctx.state.category,
  searchText: item => item.name + ' ' + item.tags,
  categoryOf: item => item.kind
});
const active = select(matches, ctx.state.selected, item => item.id);
```

`query` 保留原顺序，修剪搜索词并忽略大小写；类别 `all` 表示全部。`select` 优先匹配保存的 ID，缺失时返回首个匹配项，空集返回 null。过滤临时隐藏选中项时保留原来的选择，清除过滤即可恢复。

### 声明式控件

将下列描述放进 `sdk.compose` 的 content。搭配 text、select 和 segmented 控件分别更新 term、category、view。默认条目显示 label、name 或 id；默认详情显示选中项名称。将 view 设置为 cards 可切换到卡片排列。

```js
sdk.collections.control({
  key: 'assets', label: '素材', items,
  searchKey: 'term', categoryKey: 'category', viewKey: 'view', selectionKey: 'selected',
  category: item => item.kind,
  searchText: item => item.name + ' ' + item.tags,
  emptyText: '没有匹配的素材'
})
```

自定义 `id(item)` 和 `itemLabel(item)` 可以适配其他数据格式。`renderItem(item, element, ctx, rowLife)` 填充条目内容，若注册事件或创建资源，请通过 rowLife 释放。自定义按钮应保留 SDK 管理的点击选择行为。`renderDetail(item, container, ctx)` 可添加文字或图片，每次刷新前容器会清空。交互条目采用可通过键盘激活的按钮，并公开 aria-pressed 状态。原地更新字段时请以新对象替换该条目；重排序可复用原对象和 DOM。

对于任务队列等只读展示，设置 `selectable: false`，默认渲染有序列表。可将 `items` 设为 `ctx => ctx.state.jobs`，并声明 `watchKeys: ['jobs']`。列表同时观察所声明的搜索、类别、视图和选择字段；额外影响数据源及详情的字段应列入 watchKeys。若同一条目的自绘内容依赖独立状态，也可通过 rowLife 托管一个 ctx.model 订阅。

最短路径是 `sdk.collections.picker({ key: 'tool', label: '工具', items, onRun: (item, ctx) => ... })`。传入带 id 和 label 的数组即可获得搜索框、结果列表、选中状态和执行按钮；无匹配时按钮自动禁用。查询词与选中 ID 默认保存为 toolSearch 和 toolSelected。替换一行或详情可以传 renderItem、renderDetail；需要独立排列控件时可以直接使用 control。

## 任务与公共服务

入口为 `window.FigmaExtensions.sdk.services`（下文 `S`）；需要主程序 0.7.0 起提供的 SDK 2.1。模块清单声明 `minimumSdk: "2.1"`。宿主会拒绝高于自身支持版本的要求；旧宿主不理解此字段，因此请先升级主程序再替换模块。

### 分层与验证范围

- `runtime/services.js` 稳定公共层：任务、清理、进度、缓存、九宫几何、PNG 处理和批次协议。
- `runtime/editor-services.js` Figma 适配层：`watchSelection`、`editorImages`、`paintSnapshot/writePaints` 与 `sdk.capabilities`。能力检测只证明运行时接口形状，不证明所有 Figma 版本行为兼容。
- 本地文件能力：仍由模块 ID 和 nativeCapabilities 白名单限制；SDK 不新增任意磁盘访问或代码执行。
- 自动测试覆盖模拟编辑器、真实 Skia PNG 和合成本地文件。SDK 重构后的运行尚未重新在用户 Figma 设计中验收。

### 选区

```js
const watch = S.watchSelection(figma, {
  delay: 250, deep: false, poll: 400, geometry: false,
  onStart() { /* 立即显示识别状态，或取消关联任务 */ },
  async run({nodes, pageId}, task) {
    const result = await compute(nodes);
    if (task.current()) task.commit(() => show(result));
  },
  onError(error) { show(error.message); }
});
ctx.scope.add(() => watch.dispose());
```

`run` 只接收当前选区快照。新事件或轮询检测变化会取消旧任务；`deep` 用分批迭代遍历可见子层并去重。`geometry` 将尺寸纳入轮询键。`refresh({immediate:true})` 可显式立即执行；`initial:false` 关闭首次执行。`S.selectionNodes(api,{deep,current,yieldEvery})` 可独立采集选区；`S.selectionContains(node,roots)` 按父级链判断所选祖先，避免为统计正在播放项而遍历整个 Frame。

取消不能中断 Figma 已开始的图片读取。后台异步业务必须在写回前调用 `task.current/check/commit`，不能把任意异步回调交给 commit 后就假定安全。导出批次冻结开始时的计划，选择其他对象不会改写正在导出的计划。

### 任务队列与进度

`S.latestTask({concurrency:1})` 返回 `run(key, work, {delay:0})`、`cancel(key)`、`dispose()` 和 `busy`。同 key 的新请求替代旧请求；全队列限制资源并发。旧任务立即以 `{status:'cancelled'}` 结束，已启动的工作最终释放资源后才运行排队工作。正常结果为 `{status:'completed',value}`；当前任务失败拒绝 Promise，过期失败被丢弃。

`work(task)` 的 `current()` 检查有效性，`check()` 抛出 STALE_TASK，`commit(fn)` 只保护同步提交入口。它不提供任意副作用的自动撤销。销毁后不接受新工作。

`S.progressTask()` 是额外通用能力：`run(items, async(item,task,index)=>value, onProgress)` 顺序处理并报告 `{completed,total}`；可 `cancel()`、`dispose()`，结果沿用 latestTask 协议。它不负责回滚已完成项。

### 图片资源

```js
const images = S.editorImages(figma, {decode:createImageBitmap, maxSignatures:512, maxBitmaps:1});
const type = await images.identify(hash); // gif/png/jpeg/webp/unknown
await images.withBitmap(hash, async bitmap => { /* 使用期间不被释放 */ });
images.dispose();
```

`knownFormat(hash)` 不读取；`bytes(hash)` 合并同 hash 的并发读取，读取结束即不再缓存原始字节；`remember(hash,bytes)` 记录格式。格式签名缓存有界。解码缓存有使用租约，只有没有使用者时才淘汰或 close；销毁期间在途解码完成后仍会清理。`size` 提供 signatures/bitmaps/inFlight 诊断。

`S.imageResources({read,decode,...})` 是不依赖 Figma 的版本。`S.format(bytes)` 只识别签名，不证明整个文件可解码；原图不存在与解码失败均抛错，不静默使用其他图片。

### 图片处理

- `S.resizePng(bytes,width,height,{decode,document,Reader})` 返回 PNG base64，负责释放 bitmap 和临时画布。
- `S.surface(bitmap,width,height,{document,parts,smoothing})` 创建画布并绘制；返回 `{canvas,dispose}`。尺寸是 1–8192 的整数；调用方仍需限制面积/内存。
- `S.pngBlob(canvas)` 与 `S.base64(blob,Reader)` 分开提供 PNG 编码和转换。
- `S.nineSlice.pixels(sw,sh,margins,unit)` 换算边距；`S.nineSlice.plan(...)` 生成 drawImage 分片参数。四项均是厚度，支持 100% 合计时的接缝像素，共用整数目标边界。原始算法和像素回归从 Box 迁移而来。

这些 API 不改设计对象。

### 安全填充写回与撤销边界

```js
const before = S.paintSnapshot(node,{namespace:'canvasExtensions',key:'my-tool'});
// 计算可以异步进行；写回前再次检查快照。
const applied = S.writePaints(before, {
  fills: nextFills, data: JSON.stringify(settings),
  api: figma, commit: true, current: task.current
});
```

快照保存 fills、shared plugin data、尺寸和对象 ID。被删除、尺寸/填充/参数变化或任务失效时返回 false。写入失败会尝试恢复 fills 与参数；回滚也失败时原错误包含 rollbackError。快照包含原图引用信息，但资源保留仍由业务决定；Box 的隐藏原图 paint 属于其专有策略。

额外能力 `S.undoGroup(api, synchronousChange)` 在同步变更成功后调用 commitUndo。它是提交边界，不是数据库事务；抛错不会自动撤销任意节点修改。异步函数和缺少 commitUndo 的环境会在调用业务前拒绝。需要字段回滚请使用 writePaints。

### 预留的节点与字体适配

`S.resolveNode(api,id)` 优先调用 getNodeByIdAsync，旧环境回退 getNodeById；不存在返回宿主的 null，缺少接口则报错。`S.loadFonts(api,names,{current})` 校验并去重 family/style，按序调用 loadFontAsync；取消只停止后续加载。这些接口不修改文字或节点，当前仅有适配器模拟测试，没有在本次迁移中进行实机字体写入验证。

### 本地输出

```js
const files = S.exportFiles(id, {native:(id,op,payload)=>host.nativeRequest(id,op,payload)});
await files.run(plan, {
  directory, encode:async item => pngBase64,
  cancelled:()=>cancelled, onProgress:({completed,total,name})=>showProgress(completed,total,name)
});
```

`plan` 包含 name/width/height；返回 `{completed,cancelled}`。prepare/write/finish/cancel 协议及失败清理在 SDK 内，磁盘排他写入、同名续号、路径/PNG 检查和窗口归属在受限原生端。编码失败仍关闭会话，错误对象含 completed；取消不会删除已输出文件。模块自行提供命名策略；`files.chooseFolder(directory)`、`openFolder(directory)` 仍需对应清单权限。

### 公共控件与清理

`sdk.components.directoryField({label,value,placeholder,choose,onChange,onError})` 返回 root/input/button、setDisabled、dispose。选择取消或控件销毁后不写回；禁用和选择中状态同时影响按钮与输入框。

`sdk.components.preview({title,open})` 返回 root/body/summary/dispose，提供统一折叠入口；`stylePreview(image,{maxHeight})` 统一透明棋盘与图片尺寸。实际目录选择与预览调用已迁入纹理导出，Box 复用图片预览样式。

`sdk.compose` 新增声明控件 `{type:'path',key,label}` 和 `{type:'imagePreview',key,label,source:ctx=>url}`，继续支持原有 row/column/disclosure/checkbox/number/slider/select/button。path 自动使用模块的 choose-export-folder 能力；imagePreview 的资源 URL 由作者管理。

现有 `sdk.scope` 增加 `listen(target,event,fn,options)`、`timeout(fn,ms)`、`url(blob)`，分别清理事件、计时器与 Blob URL。`S.scope()` 提供不依赖编辑器的 add/listen/dispose。停用后添加清理项会立即执行，重复 dispose 无副作用。

### 调用点与示例

| 公共能力 | 实际扩展调用 |
| --- | --- |
| watchSelection | GIF 侧栏、纹理导出选区 |
| latestTask | Box 编码队列、纹理导出预览 |
| editorImages/imageResources | GIF 格式识别、Box 预览和编码共享原图 |
| nineSlice/surface/pngBlob | Box 分片渲染 |
| resizePng/exportFiles | 纹理导出实际编码和本地批次 |
| paintSnapshot/writePaints | Box 应用与恢复 |
| directoryField/preview/stylePreview | 纹理导出目录与预览、Box 预览 |

[services-example](templates/services-example) 可复制到扩展目录，演示公共选区、进度任务、格式识别、目录声明和清理；不修改设计、不输出文件。额外 undoGroup、scope.timeout/url 等通过独立测试验证，不暗示已验证所有 Figma 内部写入行为。
