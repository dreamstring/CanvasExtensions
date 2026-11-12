# Canvas Extensions

A modular extension injector for **Figma Desktop on Windows**.

[下载 Standalone / Releases](https://github.com/dreamstring/CanvasExtensions/releases/latest) · [SDK](SDK.md) · [组件接口](SDK-COMPONENTS.md) · [English](#english)

![Canvas Extensions extension manager](docs/screenshots/extensions.png)

## 中文

Canvas Extensions 是一个通用的 Figma 桌面端扩展注入器。主程序负责安装与恢复、扩展发现和开关；公共运行层提供侧栏挂载、主题控件、状态保存、命令和生命周期。具体功能由扩展实现。

**预装扩展与外置扩展使用同一种写法。** 三个附送扩展首次启动时释放到用户扩展目录，之后按普通 `module.json` 加载；没有专用业务加载分支，也不会覆盖用户已修改的扩展。

| 预装扩展 | 独立版本 | 功能 |
| --- | --- | --- |
| [GIF 画布预览](modules/gif/README.md) | 0.2.10 | 在画布上预览 GIF，累加播放、停止所选，切换选择保留其他播放 |
| [纹理批量导出](modules/texture-export/README.md) | 0.2.6 | PNG 批量导出，16 倍数／二次幂尺寸、取整规则、命名前缀、手动尺寸和输出目录 |
| [Box 九宫格填充](modules/box/README.md) | 0.1.6 | 图片填充中设置百分比／像素边距，保留边角并随对象尺寸重绘，支持恢复原图 |

当前发行包：**0.6.6-r2**。`r2` 表示同一主程序版本的第二次打包修订；主程序和各扩展仍独立编号。

### 安装和使用

1. 从 Release 下载 `CanvasExtensions-0.6.6-r2-win-x64.exe`。Windows x64 自包含单文件，无需另装 .NET。
2. 打开程序，在扩展列表选择启用项。在“安装与诊断”确认 Figma 安装位置并检查兼容性。
3. 保存设计，正常退出 Figma，点击“应用扩展（注入）”，然后重新打开 Figma Design 文档。
4. 在 Figma 右侧属性栏使用扩展。成功安装后每次打开文档自动加载，管理器无需常驻。

新增、停用或更新扩展后，需要重新应用并重启 Figma。Figma 自身更新替换了安装资源时，也需要重新选择新版本并应用。可通过“恢复原始资源”移除加载入口。

原始资源、安装记录与扩展存放在 `%LOCALAPPDATA%\FigmaGifAssistant`。保留此历史目录名以兼容现有用户。程序修改 `resources/app.asar` 的加载入口，保留原始备份，不修改 Figma.exe。未知版本通过结构检查也不代表运行兼容；详情见 [多版本说明](MULTI-VERSION.md)。

“安装与诊断”的“使用填写的路径”旁提供“移除所选版本…”：先在列表选择版本，保存并退出全部 Figma 进程，确认后仅将对应 app-版本号目录移入回收站。其他版本、账户数据、扩展和备份保留；更新器可能再次下载被移除的版本。该功能从主程序 0.6.7 起提供。

### 扩展使用说明

- **[GIF 画布预览](modules/gif/README.md)**：Preview 累加播放，Stop 停止所选；直接图片自动识别，容器按需识别。
- **[纹理批量导出](modules/texture-export/README.md)**：设置尺寸、命名与目录，预览后批量输出 PNG。
- **[Box 九宫格填充](modules/box/README.md)**：在图片 Fill 弹窗设置四边厚度，保留边角，尺寸变化重绘，支持恢复原图。

每个模块文档统一包含：概览、使用、参数与行为、数据与权限、限制、开发、验证及英文摘要。

### 开发扩展

复制 `templates/sdk-example` 到“打开扩展目录”所指的目录，然后修改清单和脚本：

```text
extensions/my-tool/
  module.json
  main.js
```

```json
{
  "schemaVersion": 1,
  "id": "my-tool",
  "name": "My tool",
  "version": "0.1.0",
  "description": "A custom extension",
  "permission": "read-design",
  "scripts": ["main.js"],
  "commands": []
}
```

```js
window.FigmaExtensions.sdk.define({
  id: 'my-tool',
  defaults: { amount: 100 },
  panel: {
    title: 'My tool',
    visible: ctx => ctx.selection().length > 0,
    rows: [[{ key: 'amount', type: 'number', label: 'Amount' }]]
  }
});
```

重新扫描、启用、应用扩展后生效。字体、主题、禁用态、持久化与事件清理由 SDK 处理。复杂面板可使用组合接口与底层 API。参阅 [SDK](SDK.md)、[组合组件](SDK-COMPONENTS.md) 和 `templates/`。

### 构建

需要 Windows、.NET SDK 9、Node.js 22。直接在仓库根目录运行：

```powershell
npm ci
npm test
dotnet run --project checks/Checks.csproj -c Release
pwsh -File build-standalone.ps1
```

单文件产物位于 `share/`。检查使用模拟 Electron、DOM、合成 ASAR 和 Skia 像素渲染，不读取或修改本机 Figma。另可运行 `npm run test:box-gpu`，在独立无头 Chromium 配置中检查 GPU 接缝。构建与发布可在 GitHub Actions 完成。保持主程序和扩展独立版本；扩展业务更新不必同步提升主程序版本。

### 当前边界

依赖 Figma 内部编辑器接口和 DOM，客户端升级后可能需要适配。GIF 通过浏览器覆盖层播放；复杂遮罩、合成层级和透明底图存在限制。扩展权限清单是能力声明，不是代码隔离沙箱，只加载可信扩展。默认关闭调研用的控件样式采集。软件为独立项目，与 Figma 官方无隶属关系。

## English

Canvas Extensions is a general-purpose extension injector and manager for Figma Desktop on Windows. The host manages installation, backup/restore and module selection. A shared SDK supplies themed sidebar panels, composable controls, persistence, commands and cleanup.

The three bundled extensions—GIF canvas preview, texture batch export and Box nine-slice fill—are ordinary directory modules. They are seeded into the same user extension folder and use the same manifest and SDK as third-party extensions. Existing local edits are preserved. Host and extension versions are independent.

Download the standalone Windows x64 EXE from Releases. Select your Figma installation, save your design and quit Figma, apply the selected extensions, then reopen a Design document. Installed extensions load automatically; the manager does not need to stay running. Reapply after changing modules or when a Figma update replaces its application archive.

Build on Windows with .NET 9 and Node.js 22 using the commands above. Tests use synthetic inputs, mocked editor surfaces and real Skia raster pixels. `npm run test:box-gpu` optionally checks fractional-margin seams in an isolated headless Chromium profile. Start an extension from `templates/sdk-example`; see [SDK.md](SDK.md) and [SDK-COMPONENTS.md](SDK-COMPONENTS.md). Runtime compatibility depends on Figma's internal APIs; structural compatibility alone is not a guarantee.

Module guides: [GIF](modules/gif/README.md) · [Texture export](modules/texture-export/README.md) · [Box](modules/box/README.md). Each follows the same documentation structure. Bundle revisions such as 0.6.6-r2 do not change host/module versions.

## License

Copyright © 2026 Dring Qian (dreamstring). Project code: **GPL-3.0-only**, see [LICENSE](LICENSE). Distributed derivatives must provide corresponding source under GPL. Private modifications do not require public release. Font and icon licenses are retained in `references/`; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

