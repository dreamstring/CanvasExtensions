# 面板状态模型

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

## 合并一次用户操作

`model.batch(() => { ... })` 将回调中的同步 patch 合并为一轮通知。回调内可读到刚更新的字段，订阅者在最外层 batch 结束后看到最终组合。compose 的字段 change 与其 onChange 中的同步联动默认使用此语义。回调抛错时，已写入的状态仍会派发；await 之后的写入是独立的一轮。

自绘控件同时依赖几个字段时，可用 `ctx.model.watchKeys(['left', 'right'], (values, previous, onCleanup) => ..., { immediate: true })`。只有列出的字段值发生变化才会再次通知。返回取消订阅函数，可交给自绘控件的 life.add。
