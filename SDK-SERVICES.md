# SDK 2.1 公共服务

[SDK 总览](SDK.md) · [组件声明](SDK-COMPONENTS.md) · [工作目标](SDK-GOAL.md)

入口为 `window.FigmaExtensions.sdk.services`（下文 `S`）；需要主程序 0.7.0 起提供的 SDK 2.1。模块清单声明 `minimumSdk: "2.1"`。宿主会拒绝高于自身支持版本的要求；旧宿主不理解此字段，因此请先升级主程序再替换模块。

## 分层与验证范围

- `runtime/services.js` 稳定公共层：任务、清理、进度、缓存、九宫几何、PNG 处理和批次协议。
- `runtime/editor-services.js` Figma 适配层：`watchSelection`、`editorImages`、`paintSnapshot/writePaints` 与 `sdk.capabilities`。能力检测只证明运行时接口形状，不证明所有 Figma 版本行为兼容。
- 本地文件能力：仍由模块 ID 和 nativeCapabilities 白名单限制；SDK 不新增任意磁盘访问或代码执行。
- 自动测试覆盖模拟编辑器、真实 Skia PNG 和合成本地文件。SDK 重构后的运行尚未重新在用户 Figma 设计中验收。

## 选区

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

## 任务队列与进度

`S.latestTask({concurrency:1})` 返回 `run(key, work, {delay:0})`、`cancel(key)`、`dispose()` 和 `busy`。同 key 的新请求替代旧请求；全队列限制资源并发。旧任务立即以 `{status:'cancelled'}` 结束，已启动的工作最终释放资源后才运行排队工作。正常结果为 `{status:'completed',value}`；当前任务失败拒绝 Promise，过期失败被丢弃。

`work(task)` 的 `current()` 检查有效性，`check()` 抛出 STALE_TASK，`commit(fn)` 只保护同步提交入口。它不提供任意副作用的自动撤销。销毁后不接受新工作。

`S.progressTask()` 是额外通用能力：`run(items, async(item,task,index)=>value, onProgress)` 顺序处理并报告 `{completed,total}`；可 `cancel()`、`dispose()`，结果沿用 latestTask 协议。它不负责回滚已完成项。

## 图片资源

```js
const images = S.editorImages(figma, {decode:createImageBitmap, maxSignatures:512, maxBitmaps:1});
const type = await images.identify(hash); // gif/png/jpeg/webp/unknown
await images.withBitmap(hash, async bitmap => { /* 使用期间不被释放 */ });
images.dispose();
```

`knownFormat(hash)` 不读取；`bytes(hash)` 合并同 hash 的并发读取，读取结束即不再缓存原始字节；`remember(hash,bytes)` 记录格式。格式签名缓存有界。解码缓存有使用租约，只有没有使用者时才淘汰或 close；销毁期间在途解码完成后仍会清理。`size` 提供 signatures/bitmaps/inFlight 诊断。

`S.imageResources({read,decode,...})` 是不依赖 Figma 的版本。`S.format(bytes)` 只识别签名，不证明整个文件可解码；原图不存在与解码失败均抛错，不静默使用其他图片。

## 图片处理

- `S.resizePng(bytes,width,height,{decode,document,Reader})` 返回 PNG base64，负责释放 bitmap 和临时画布。
- `S.surface(bitmap,width,height,{document,parts,smoothing})` 创建画布并绘制；返回 `{canvas,dispose}`。尺寸是 1–8192 的整数；调用方仍需限制面积/内存。
- `S.pngBlob(canvas)` 与 `S.base64(blob,Reader)` 分开提供 PNG 编码和转换。
- `S.nineSlice.pixels(sw,sh,margins,unit)` 换算边距；`S.nineSlice.plan(...)` 生成 drawImage 分片参数。四项均是厚度，支持 100% 合计时的接缝像素，共用整数目标边界。原始算法和像素回归从 Box 迁移而来。

这些 API 不改设计对象。

## 安全填充写回与撤销边界

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

## 预留的节点与字体适配

`S.resolveNode(api,id)` 优先调用 getNodeByIdAsync，旧环境回退 getNodeById；不存在返回宿主的 null，缺少接口则报错。`S.loadFonts(api,names,{current})` 校验并去重 family/style，按序调用 loadFontAsync；取消只停止后续加载。这些接口不修改文字或节点，当前仅有适配器模拟测试，没有在本次迁移中进行实机字体写入验证。

## 本地输出

```js
const files = S.exportFiles(id, {native:(id,op,payload)=>host.nativeRequest(id,op,payload)});
await files.run(plan, {
  directory, encode:async item => pngBase64,
  cancelled:()=>cancelled, onProgress:({completed,total,name})=>showProgress(completed,total,name)
});
```

`plan` 包含 name/width/height；返回 `{completed,cancelled}`。prepare/write/finish/cancel 协议及失败清理在 SDK 内，磁盘排他写入、同名续号、路径/PNG 检查和窗口归属在受限原生端。编码失败仍关闭会话，错误对象含 completed；取消不会删除已输出文件。模块自行提供命名策略；`files.chooseFolder(directory)`、`openFolder(directory)` 仍需对应清单权限。

## 公共控件与清理

`sdk.components.directoryField({label,value,placeholder,choose,onChange,onError})` 返回 root/input/button、setDisabled、dispose。选择取消或控件销毁后不写回；禁用和选择中状态同时影响按钮与输入框。

`sdk.components.preview({title,open})` 返回 root/body/summary/dispose，提供统一折叠入口；`stylePreview(image,{maxHeight})` 统一透明棋盘与图片尺寸。实际目录选择与预览调用已迁入纹理导出，Box 复用图片预览样式。

`sdk.compose` 新增声明控件 `{type:'path',key,label}` 和 `{type:'imagePreview',key,label,source:ctx=>url}`，继续支持原有 row/column/disclosure/checkbox/number/slider/select/button。path 自动使用模块的 choose-export-folder 能力；imagePreview 的资源 URL 由作者管理。

现有 `sdk.scope` 增加 `listen(target,event,fn,options)`、`timeout(fn,ms)`、`url(blob)`，分别清理事件、计时器与 Blob URL。`S.scope()` 提供不依赖编辑器的 add/listen/dispose。停用后添加清理项会立即执行，重复 dispose 无副作用。

## 调用点与示例

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
