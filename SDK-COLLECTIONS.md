# 集合查询、选择与面板控件

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

## 声明式控件

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
