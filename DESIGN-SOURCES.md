# 界面参考与来源

- Figma 官方 CSS Variables and Theming：https://developers.figma.com/docs/plugins/css-variables/
  采用语义色、深浅主题、背景/文字/边框层级。该公开文档不等于完整的桌面 UI3 组件规范。
- Figma Plugin DS：https://github.com/thomas-lowry/figma-plugin-ds
  Tom Lowry 的开源 Figma 插件 UI 库，非官方完整桌面组件包。使用其中 image/component/settings/theme 等 SVG 几何，转换为 WPF 矢量路径，保留 MIT 许可。
- Inter：https://github.com/rsms/inter
  从本机 Figma 原始资源提取 Inter 字体，并转换为 WPF 可用静态 TTF；保留 SIL Open Font License。
- NN/g Visibility of System Status：https://www.nngroup.com/articles/visibility-system-status/
  显示助手版本、已安装增强版本、待应用状态、连接状态及操作反馈。
- NN/g Progressive Disclosure：https://www.nngroup.com/articles/progressive-disclosure/
  扩展列表作为首页，计划与日志收进独立页面和可展开详情。

界面为 WPF 实现，未复制完整网页或将远程网页作为软件运行依赖。深浅主题、按钮高度、分隔线、图标与信息密度按上述资料及用户提供的实际 Figma 截图适配。
