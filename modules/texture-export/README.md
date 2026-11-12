# 纹理批量导出

[返回项目](../../README.md) · [模块清单](module.json)

## 概览

版本 **0.2.7** · 模块 ID `texture-export` · 权限 `read-design`，另声明受限的 PNG 写入、选择和打开目录能力。普通目录扩展。

## 使用

启用、应用扩展并重启 Figma。选中对象，展开 Texture export，设置规则、取整、前缀、中间名称和输出目录。目录可选择并保存。可勾选手动尺寸；核对命名与 Preview 后导出。

## 参数与行为

16 倍数默认最近尺寸，等距向上，最小 16；二次幂默认向上，最小 1。均可选择最近／向下／向上，并分别记住偏好。手动宽高仍经过所选规则换算。默认前缀 `T_UI_`，中间名称可留空，序号按最终宽高分别累计。

| 原尺寸 | 16 倍数（最近） | 二次幂（向上） |
| --- | --- | --- |
| 63×65 | T_UI_xxx_64x64_001.png | T_UI_xxx_64x128_001.png |
| 64×65 | T_UI_xxx_64x64_002.png | T_UI_xxx_64x128_002.png |
| 15×47 | T_UI_xxx_16x48_001.png | T_UI_xxx_16x64_001.png |

## 数据与权限

Figma 导出 PNG，Chromium Canvas 缩放编码，Electron 写入指定目录。不改变画布尺寸，不经过服务器，管理器无需常驻。设置存于本机偏好；同名自动续号、排他创建。取消保留已成功输出的文件。

## 限制

仅 PNG，边长上限 8192，每批最多 1000 个选中对象。直接缩放可能改变宽高比例。依赖 Figma 导出接口和加载器，不提供任意代码执行或任意类型文件写入。

需要宿主 SDK 2.1（主程序 0.7.0 起）。模块采用公共任务、图片与生命周期能力；旧主程序无法加载这些新增调用，升级时先更新主程序并重新应用。

## 开发

- `rules.js`：尺寸换算、命名及批次计划。
- `main.js`：面板、设置、预览、导出与取消。
- 命令：`exportSelection`；本地能力见 [清单](module.json) 和 [SDK](../../SDK.md)。

## 验证

运行 `npm test`。覆盖尺寸、取整、序号、排他写入、冲突、路径与会话边界。历史集成检查包含隐藏 Chromium Canvas 和加载器桥接；替身测试不等于任意用户文档实测。

## English

Texture export 0.2.7 resizes selected PNG exports to multiples of 16 or powers of two and writes named batches to a remembered directory. Manual dimensions use the same rounding rules. Design nodes remain unchanged. Limits, capabilities and validation scope are listed above.
