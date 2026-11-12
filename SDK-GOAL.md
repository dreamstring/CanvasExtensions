# SDK 公共能力扩展目标

目标：现有三个扩展改用共享能力，删除重复实现，保留用户已验收的功能。稳定公共层与 Figma 内部能力适配层分开。

## 必须完成

- 选区任务：防抖、可选子层遍历、旧任务取消、事件与轮询回退。
- 异步队列：按键合并、串行资源工作、最新结果写回、失效与销毁。
- 图片资源：格式签名、并发读取去重、有界缓存、解码及释放。
- 图片处理：缩放、分片绘制、PNG 编码；由 Box 与导出实际复用。
- 安全修改：快照、外部修改校验、受控写回与失败回滚。
- 文件输出：选择/打开目录、批次、进度和取消，保留本地权限白名单。
- 面板组件：公共折叠区、目录框、图片预览和禁用联动；实际迁移。
- 三个扩展迁移，SDK 文档、模板、能力边界和回归测试同步。

## 通用储备能力（用户追加）

提供职责明确但不强制现有扩展使用的公共 API：订阅与资源清理、撤销提交边界、可取消进度任务，以及带能力检测的节点/图片操作。每项必须有可运行示例或测试；不能将存在函数名当作实机兼容证据。

## 完成证据

逐项检查公共实现、现有扩展调用点、删除的重复代码、失败/竞态测试、文档与模板。自动测试、WPF 构建、合成安装检查通过。依赖 Figma 的接口明确标识运行形状检测或实机验证范围；无需接管正在使用的设计文件。

## 实现与验证记录

| 范围 | 公共实现与迁移证据 |
| --- | --- |
| 选区 | editor-services.watchSelection / selectionNodes / selectionContains；GIF 与导出迁移，嵌套 Stop 回归 |
| 任务队列 | services.latestTask；Box 与导出预览迁移，过期写回及销毁测试 |
| 图片资源 | imageResources / editorImages；GIF 与 Box 共享接口，并发读取、缓存上限与释放测试 |
| 图片处理 | nineSlice / surface / pngBlob / resizePng；Box GPU 接缝、真实 Skia PNG 导出测试 |
| 安全写入 | paintSnapshot / writePaints；Box 应用与恢复迁移，外部修改拒绝与失败回滚测试 |
| 本地输出 | exportFiles；导出批次迁移，取消与异常清理测试，原生权限校验保留 |
| 公共 UI | directoryField / preview / stylePreview；导出与 Box 迁移，声明式 path / imagePreview 测试 |
| 通用储备 | scope、progressTask、undoGroup、resolveNode、loadFonts；独立成功、失败、取消与清理测试 |
| 分层和交付 | services.js 不依赖 Figma；editor-services.js 适配编辑器；SDK-SERVICES.md 和 services-example 随包 |

主程序 0.7.0，SDK 2.1；GIF 0.2.11、纹理导出 0.2.7、Box 0.1.7 独立版本，清单声明 minimumSdk。重复的选区延时、缓存、编码队列、批次清理与目录/预览控件已迁到公共层。

验证范围：自动回归、真实 Skia PNG、Chromium GPU 九宫接缝、C# 清单与安装安全检查、WPF 和 standalone 构建。SDK 新版尚未重新注入真实 Figma 验收；能力存在检测不能代替跨版本实机验证。此目标不包含发行 Release 或改动正在使用的 Figma 安装。
