# SDK 2.0: composable panels

## Usage

Copy `templates/composed-panel` into the extensions directory to experiment, then enable it. It is not enabled automatically. Existing `sdk.define()` and low-level `sdk.panel()` remain available.

```js
window.FigmaExtensions.sdk.compose({
  id: 'my-tool',
  defaults: { manual: false, width: 64, height: 64 },
  panel: {
    title: 'My tool', collapsible: true, collapsed: true,
    content: [
      { type: 'checkbox', key: 'manual', label: '手动尺寸' },
      { type: 'row', children: [
        { type: 'number', key: 'width', label: '宽度', min: 1,
          enabled: ctx => ctx.state.manual },
        { type: 'number', key: 'height', label: '高度', min: 1,
          enabled: ctx => ctx.state.manual }
      ] },
      { type: 'button', key: 'run', label: '执行',
        onClick: ctx => ctx.status(`${ctx.state.width} × ${ctx.state.height}`) }
    ]
  }
});
```

Compositions use a nested shadow root, so the legacy generic form stylesheet cannot override their individual styles. Internal Figma class hashes are not part of this authoring API.

## Available declarations

| type | Properties |
|---|---|
| row | children, columns (defaults to child count) |
| column | children |
| label | text |
| text / number | key, label, placeholder; number supports min/max/step |
| checkbox | key, label |
| select | key, label, options: `{value,label}[]` |
| slider | key, label, min/max/step |
| segmented | key, label, options: `{value,label}[]` |
| button | key, label, icon, variant: primary/outline/default, onClick, tooltip |
| iconButton | key, label (accessible name), icon, onClick |
| disclosure | title, open, children |

Bound controls and buttons support `enabled(ctx)` and `visible(ctx)`. Settings auto-save by extension ID. Async button actions temporarily disable controls and report errors; a rejected action restores controls. Page/selection listeners and mounted views are removed on disposal. `scope` remains available for extra cleanup.

`sdk.ui.icon(name)` returns a 24px SVG. Current source-derived registry: plus, chevronDown, visibility. These paths were captured from actual native sidebar controls; generic unknown icons are not silently substituted.

## Evidence and acceptance levels

Actual Figma sample: 64 native sidebar controls, 27,259 readable CSSOM rules including 27,045 editor stylesheet rules. The live stylesheet URL matches the previously downloaded artifact. `ui-checks/live-reference-summary.json` contains value-only summaries. No input values or design text were captured.

Native typography tokens: medium 11px / weight 450, small 9px, strong weight 550. Controls use 24px height and radius token 5px where applicable; these values are not imposed on unrelated widgets. Captured native plus and chevron SVG canvases are 24px (the painted glyph is smaller).

`runtime/component-reference.js` stores source identity, tokens, three icon definitions, and 1,012 selected style rules, including numeric inputs, combo boxes, raw fields, native icon buttons, menus, tooltips and sliders. This is a reference catalog, not a claim that all represented widgets are implemented. Original Figma factories are never executed.

Own hidden Electron test: nested composition renders, checkbox enables/disables number fields, edited values persist, panel mounts without module errors, source-derived icons use 24px canvases. Dark/light screenshots: `ui-checks/composed-kit-dark.png` and `composed-kit-light.png`. These are our own gallery, not screenshots proving Figma pixel equivalence.

Remaining: full native mouse/keyboard state comparison; normal checkbox (live sample was a visibility toggle, not the standard checked box); native-style select popovers; tooltip replacement for browser title; slider thumb/track behavior; color picker; unit/scrub inputs; mixed values; drag reorder; scrolling/overflow and extra DPI cases. Current select uses HTML select popup semantics; disclosure and segmented selection are our implementation. Do not claim full Figma equivalence for these behaviors.

## Versioning

Host/SDK changes: host version 0.5.1. This pass does not bump GIF or texture module versions. Existing extensions continue using their own custom panel bodies; adopting `compose()` can be done independently after visual regression checks. No silent rewrite of their business logic.

SDK 2.1 增加 path、imagePreview 声明与公共目录/预览组件，详见 [公共服务](SDK-SERVICES.md#公共控件与清理)。
