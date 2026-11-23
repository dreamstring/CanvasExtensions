# 面板挂载位置

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

## 观察位置变化

`sdk.targets.observe(resolve, listener)` 同步通知首次结果（含 null），之后在目标元素发生变化时通知。返回的函数用于取消订阅，可交由 `ctx.scope.add` 清理。所有订阅共享一个 document MutationObserver；它观察子节点和属性变更，因此 class、style、aria-label、hidden、inert 和自定义 data 属性均可参与定位。最后一个订阅结束时断开观察器。选择器只在 DOM 变更回调中重新执行，建议将范围收窄到相关容器。仅通过 JavaScript 属性更新且无 DOM 变更的状态由扩展自己监听。

可传入第三个参数 `{ valid: target => ... }` 检查已有挂载是否完好。宿主清空子节点且容器本身保留时，valid 返回 false 会为同一个容器再次通知；listener 应修复挂载以恢复有效状态。

## SDK 2.6 已有面板内的插入点

`sdk.targets.inspect()` 枚举当前文档中匹配已注册类型的所有位置，返回包含 name、element 的数组。当前类型为 rightSidebar、paintDialog、paintTypes（填充类型按钮组）、imageMode（图片模式选择器）。关闭的弹窗不在结果中；多个弹窗可逐个拿到 DOM 元素。具名解析器默认要求唯一匹配，也可用 paintTypes(dialog)、imageMode(dialog) 将查找限定在已选弹窗。新的宿主结构可通过 within(parent, selector) 或自己的解析函数定位。

- 只加一个控件：`sdk.targets.insert({target: sdk.targets.imageMode, position: 'before', element, scope: ctx.scope})`。传入扩展创建的独立元素。默认 append，也支持 prepend、before、after。
- 加工具栏动作：`sdk.components.targetAction({target: sdk.targets.paintTypes, label, icon, onPress, scope: ctx.scope})`。
- 加整组字段：`panel: {target: sdk.targets.imageMode, position: 'after', nativeStyle: true, content: [...]}`。

定位器在宿主更新时重新求值；弹窗关闭时移除扩展元素，重开时挂回，scope 结束时注销。已有宿主节点的点击、隐藏或替换逻辑属于扩展自己的行为。已知插入点及语言标签取决于 Figma 宿主版本。
