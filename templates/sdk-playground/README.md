# SDK Playground

复制此目录到管理器的扩展目录，重新扫描并启用 SDK Playground，应用后重新打开 Figma Design。此示例需要 Canvas Extensions SDK 2.5。面板无需选中图层，只编辑自己的设置。

选择「非对称」可载入左 12%、上 18%、右 32%、下 26% 的边距。拖动一条切线、滑块或输入百分比，观察另外两个控件与中心预览联动。「编辑边距」控制整组参数；「重置」恢复四边各 20%。

按 Tab 聚焦切线后可用方向键移动 1%，按住 Shift 移动 10%。Home 和 End 分别设置最小和最大厚度。同一方向的两条切线最多重合。键盘、鼠标以及数值编辑共用同一边距计算。

`main.js` 使用 `sdk.compose` 创建选择器、参数组、范围控件及自绘面板。自绘控件通过 `ctx.model.subscribe` 读取状态、`ctx.patch` 写回设置，并由 `life` 释放订阅和事件。可直接复用这些接口开发独立扩展。

## 面板形态实验

从顶部「测试场景」切换。每个场景模拟一种交互结构；使用插件自带的数据，只有设置会写入扩展存储。

| 场景 | 可试的操作 |
| --- | --- |
| 九宫参数表单 | 改一边的数值，拖动预览切线，用键盘微调 |
| 紧凑对齐工具条 | 用三个动作即时改变下方图形排列 |
| 素材浏览器 | 按关键词和类别过滤，在卡片与列表之间切换，查看详情和空状态 |
| 缓动曲线编辑器 | 拖动两个控制点，调整数值，在指定时间取样 |
| 任务队列 | 添加任务，观察模拟进度，中途取消再重新运行 |
| 分步向导 | 选择范围和格式，返回修改，再确认模拟输出 |

交互参考 Adobe 的 [Effects & Presets 与 Effect Controls](https://helpx.adobe.com/after-effects/desktop/apply-effects-and-animation-presets/effects-and-animation-presets/effects-animation-presets-overview.html)、[Graph Editor](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-basics/animation-basics.html) 和 [Render Queue](https://helpx.adobe.com/after-effects/desktop/render-and-export/basics-of-rendering-and-exporting/basics-rendering-exporting.html)。

0.3.0 新增「命令面板」和「图层矩阵」。可在命令面板搜索和执行模拟命令，在图层矩阵独立切换可见与锁定、观察计数后恢复初始状态。这两个面板只修改 Playground 自身状态。素材浏览器和只读队列复用 SDK 2.5 的集合控件。
