# Box 九宫格填充

[返回项目](../../README.md) · [模块清单](module.json)

## 概览

版本 **0.1.7** · 模块 ID box · 权限 write-design。普通目录扩展，和 GIF、纹理导出及第三方模块使用相同清单与 SDK。原 Box 0.1.6 行为于 2026-11-08 经用户在 Figma 126.11.8 验收；0.1.7 是本次 SDK 迁移版本，已通过自动回归，尚未重新实机验收。

## 使用

在图片 Fill 弹窗点击九宫格图标。默认百分比模式，10 代表原图尺寸的 10%；Left、Top、Right、Bottom 都是边框厚度。也可切换为原图像素。输入时更新面板预览，Enter 或移开焦点后应用。调整对象尺寸后自动重绘；原尺寸下通常保持原外观。

## 参数与行为

边角固定，边沿及中间拉伸。两侧总和可以等于 100%，此时用接缝处的一个完整像素填充中间区域；不能超过 100%。百分比和原图采样保留精度，九块共用整数输出边界，避免 GPU 抗锯齿暗缝。

输出是普通 PNG 图片填充，并非原生 Shader。扩展停用后最后结果继续显示、可导出，但不会随尺寸重新生成。

## 数据与权限

节点 shared plugin data（canvasExtensions / box）保存参数。为保留原图资源引用，会在同一对象增加一项不可见 IMAGE 填充，不增加图层。恢复原图时仅移除与记录完全一致的保留项；其他填充不被删除。已有填充被外部修改时拒绝覆盖。

早期版本只有 hash 而丢失原图的对象，可明确选择“以当前图片重建 Box”。这以当前可读图片为新源，不能找回已经丢失的原图；恢复按钮会说明回到重建前图片。

## 限制

最大输出边长 8192，面积 16,777,216 像素。当前要求单选图片填充对象；同一对象含 Pattern 填充时会拒绝写入。调整尺寸采用轮询及合并重绘，不能保证原生 GPU 帧率。原图滤镜、透明度和混合模式沿用，原有 Fill/Fit/Crop/Tile 映射在 Box 生效时由九宫格替代。

需要宿主 SDK 2.1（主程序 0.7.0 起）。模块采用公共任务、图片与生命周期能力；旧主程序无法加载这些新增调用，升级时先更新主程序并重新应用。

## 开发

- rules.js：纯九宫格几何、百分比换算和像素对齐。
- renderer.js：缓存原图、单编码队列、过期请求取消、填充与参数写回。
- picker.js：原生 Fill 弹窗定位、图标及控件生命周期。
- main.js：参数编辑、键盘隔离、预览、恢复和尺寸监听。

## 验证

运行 npm test：包含几何、单队列、编辑焦点、恢复、过期异步保护、真实 Skia 像素测试和弹窗挂载模拟。

运行 npm run test:box-gpu：使用独立无头 Chromium 配置。可用 BOX_CHROME 指定浏览器程序，不读取个人浏览器配置。测试会说明当前后端是否复现旧 GPU 缝隙。

已用实际原图验证 118×52 → 959×340、10/10/90/90：GPU 分数边界令接缝 alpha 从 178 降到 158；对齐输出边界后恢复为 178。原图不在仓库或发行包中。生成的测试纹理在 artifacts 下，不参与发布。

## English

A normal SDK directory module for nine-slice image fills. Percentages describe border thickness, not UV end coordinates. Source pixels remain cached and referenced by an invisible native image paint for restoration. Resize requests coalesce; stale encodes cannot overwrite edits or restores. The generated PNG survives disabling the module, but live resize redraw requires the extension. Shared integer destination boundaries fix GPU-antialiasing seams while retaining fractional source coordinates. The earlier Box 0.1.6 behavior was accepted on Figma 126.11.8. The 0.1.7 SDK migration has automated regression coverage, not renewed live Figma acceptance.
