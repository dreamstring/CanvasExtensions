# SDK 2.0 更新

新的嵌套组合声明、原生样式证据与限制见 [SDK-COMPONENTS.md](SDK-COMPONENTS.md)。以下保留旧版接口说明以兼容已有扩展。

# Canvas Extensions SDK 1.0

主程序 0.4.0 提供宿主与 SDK。GIF 和纹理导出均为普通目录扩展，没有 ID 专用加载分支。

## 文件布局

`%LOCALAPPDATA%/FigmaGifAssistant/extensions/<id>/module.json` 和功能脚本。
首次启动从发布包复制两个示例；已存在的目录不会被覆盖。扩展修改后重新扫描，再退出 Figma、应用扩展并重新启动。运行中的 Figma 不会热更新。
更新扩展可直接替换对应目录文件，保留相同 ID；主程序版本无需改变。发布包中的模块是首次安装种子，不是更高优先级的隐藏副本。修改前建议复制目录备份；不要同时保留相同 ID 的两个目录。

## 最小示例

复制 `templates/sdk-example` 到扩展目录，重新扫描后启用。清单包含 schemaVersion、id、name、version、description、permission、scripts、commands、可选 nativeCapabilities。版本属于扩展自身。

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
