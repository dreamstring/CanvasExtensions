# Native UI adapter — first pass

SDK: `FigmaExtensions.sdk.ui.install(shadowRoot)` installs shared control styling and returns cleanup. `sample()` refreshes passive measurements. `inspect()` reports value-only measurements and whether live samples or defaults are in use. No document text or input values are recorded.

Current coverage: labels, text/number inputs, select arrow and padding, checkbox checked state, button typography/heights, disabled/focus state, disclosure typography. Theme colors use Figma CSS variables. Native browser selects remain browser popups; this is not Figma's React dropdown implementation. Menus/popovers, color pickers, autocomplete, numeric drag interactions, tooltips and all hover/pressed variants have not been recovered.

Runtime adapter samples visible native right-sidebar inputs and labels without entering shadow roots or invoking handlers. It validates basic size ranges; missing native samples use declared defaults (11px text, 24px control). Default values are reconstruction choices, not recovered live facts. Shadow-DOM styles are centrally applied, rather than copied independently into every extension. Current sampling does not infer the correct style from every possible node type; real-client review remains necessary.

REA evidence: ev_36feae0663c6533ac941dbe0ce68c88d51929c66b81d5251b6f8b9ce98854fe7; summary ev_556654078f8634ad94604906ffd40ced64780408a9ab6997943f33311b875015.
Target was the previously extracted desktop_shell.js/CSS reference directory. REA JavaScript analysis hit a heap limit and established no recovered widget graph. CSS inspection found only three matching text_input rules in that shell stylesheet (`ui-checks/native-control-static.json`), insufficient to establish editor widget styles. Current Figma process has no observed CDP listening endpoint; no live REA style extraction was performed. Do not represent this pass as recovery of all original controls.

Remaining checklist: obtain selected-editor computed styles; compare text, input, select, checkbox, button and disclosure in dark/light, normal/hover/focus/disabled states; then investigate popover/menu/color/slider/segmented controls individually. Preserve element role, state, version, CSS rule source and geometry for each accepted sample. A screenshot-only adjustment cannot promote a control to fully native-equivalent.
