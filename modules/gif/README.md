# GIF 画布预览

[返回项目](../../README.md) · [模块清单](module.json)

## 概览

版本 **0.2.10** · 模块 ID `gif` · 权限 `read-design`。与其他预装和外置扩展使用相同加载机制。

## 使用

启用、应用扩展并重新打开 Figma Design 文档。选中图片或容器，在 GIF preview 点击 Preview 累加播放；Stop 只停止所选对象及子层。切换选区保留其他播放，切换页面清理播放。

## 参数与行为

选区稳定 250ms 后自动识别，只读取直接选中的图片，不遍历容器子层。每次最多读取 8 张未缓存图片，串行读取，250ms 后不再启动新读取。容器及剩余图片点击 Preview 再识别。签名缓存复用；识别不启动动画。旧任务取消后，已经开始的完整图片读取无法强制中断。

## 数据与权限

浏览器图片覆盖层跟随画布和对象几何，不修改设计节点。Stop 释放所选预览资源；页面切换与销毁清理资源。管理器无需常驻。

## 限制

当前支持无子层的 Rectangle、Frame、Component、Instance，Fill/Fit 映射。填充旋转、蒙版及部分混合模式不支持；复杂裁剪、层级和透明底图有限制。单张大图读取仍可能有短暂开销，播放有解码和布局开销。

## 开发

- `engine.js`：签名、缓存、资源、播放和几何同步。
- `sidebar.js`：侧栏、选区防抖、状态与命令。
- `main.js`：模块注册。
- 命令：`previewSelection`、`stop`；参阅 [SDK](../../SDK.md)。

## 验证

运行 `npm test`。模拟编辑器覆盖读取预算、缓存、取消、防抖、累加播放、所选停止、坐标及资源清理；不代表所有 Figma 版本的性能实测。既有播放经用户实机验收，本次空闲优化通过自动回归测试。

## English

Read-only GIF preview 0.2.10 uses browser overlays without changing design nodes. Preview adds animations; Stop affects the selection. Idle detection is debounced and bounded, while container descendants require Preview. Complex compositing is limited. Source files and validation scope are listed above.
