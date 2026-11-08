# Figma editor component library investigation

## Boundary

Goal: build reusable primitives and declarative compositions, rather than independently styling every extension. Not all editor CSS families are public UI primitives. A class mapping alone is not a complete component contract, and the existence of a hover selector does not validate keyboard behavior.

## Recovered resources

- Editor bundle: `work/figma-web-readonly/figma_app.js` (previously acquired, 8.3MB). Babel AST extraction recovered 74 UI-related modules and 2,248 distinct CSS class references. `work/figma-ui-recovered/provenance.json` records original SHA256 and exact character/UTF-8 byte ranges; original bodies were not executed.
- CSS URL selected from the user's now-closed Figma cache: `https://www.figma.com/webpack-artifacts/assets/figma_app-c52dee5f11cfe0ae.min.css`.
- The downloaded CSS was parsed with Chromium CSSOM in our own hidden Electron window, with network blocked. 27,045 style rules and 1,477 named class families were inventoried. These counts are not counts of public components. CSS hash and source URL are in `ui-checks/component-style-inventory.json`.
- REA analyzed exact recovered modules 947289 (combo box class composition), 872314 (properties panel), 64985 (panel title input), 665497 (type/dimension panel). Parent evidence `ev_28206a713d5276a952a956fba8d382f04a7735715ff651573b87ad1256cbc127`, summary `ev_f0e9a60b864f6bccb8598540700a7464b460340417b3756528c30ee9b6700f74`. Four files parsed successfully without repeating the previous whole-bundle heap failure. Dependencies and remaining modules are outside this analysis, not proven absent.

## Facts from shipped CSS

- UI3 body-medium font size uses `.6875rem` (11 CSS pixels at a 16px root), not one universal font size for all labels and headings.
- Radius-medium uses `.3125rem` (5px at the same root).
- `--spacer-4` is `1.5rem`; raw input UI3 height follows that token.
- A combo box consists of multiple class-composed parts: container, input, select overlay, chevron, focus/disabled variants. A browser select with a background arrow cannot be considered behaviorally equivalent.
- UI3 dimension chevron container is explicitly 24px square; select chevron sizing varies with its container/context. A single guessed arrow size for every control is incorrect.
- Segmented controls have 1px gaps and independent edge radii; their implementation combines named and atomic CSS classes.

## Composition target

Layer 1: typography/color/spacing/radius/icon tokens, with source identity.
Layer 2: label, text/number field, checkbox, button/icon button, disclosure, select/combobox, segmented control, slider, tooltip and menu primitives.
Layer 3: field rows, unit/axis inputs, path picker, collapsible section, progress/status, image preview, and action groups.
Layer 4: declarative panel schema using those parts, with state binding, validation, enable/visible conditions and automatic cleanup.

Keep extracted class hashes behind an adapter. Extension authors should declare semantic controls, never depend on Figma's minified React exports. Figma internal React components require context, providers, stores and side effects; do not execute their factories inside the SDK as if they were standalone widgets.

## State matrix and remaining acceptance

For each primitive: dark/light × normal/hover/focus/pressed/disabled, plus checked/mixed/selected/open as applicable. Validate pointer and keyboard interaction, focus order, Esc/Enter/arrow behavior, overflow, zoom/DPI and cleanup. Preserve CSS rule, component part, state, runtime geometry and screenshot separately.

0.5.0 includes a bounded passive reference recorder (at most 12 samples per loaded editor). It records right-sidebar control styles, states and icon geometry, theme tokens and readable stylesheet rules. It excludes input values and document text; it does not click or edit. Main process writes `<payload>.ui-<webcontents>.reference.json` and a rolling `.state.json` beside the existing payload. Cross-origin CSS failures are explicit. This is investigation instrumentation, not evidence that all components are implemented.

Next dependency: start the real editor after applying the recorder, select a normal design object, and leave it open for 10 seconds. Compare sampled current-build class hashes and computed values to the downloaded CSS before promoting any new primitive. Open native selects/popovers only as needed for their own state coverage; missing components remain on the checklist.
