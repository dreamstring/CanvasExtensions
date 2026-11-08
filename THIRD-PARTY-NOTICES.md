# Third-party notices

- **Inter font**: SIL Open Font License 1.1. License retained in
  `references/Inter-LICENSE.txt`. The packaged static font is used by the WPF UI.
- **Figma Plugin DS icons** by Thomas Lowry and contributors: MIT. License
  retained in `references/figma-plugin-ds-LICENSE.txt`. Selected SVG paths are
  adapted in `src/Assets/Icons.xaml`.
- **Microsoft .NET runtime**: the self-contained EXE includes .NET runtime
  components under their upstream licenses. See https://github.com/dotnet/runtime
  for license and third-party notices.

Figma is a trademark of its respective owner. No Figma executable, application
archive, private document, user installation record or client backup is shipped.
Style reference data describes observed UI dimensions and tokens; it is not a
license to redistribute Figma's application code. See DESIGN-SOURCES.md.

Development-only raster tests use `@napi-rs/canvas` (MIT) and its Skia dependencies. Their licenses remain in the installed npm packages; lockfile pins the test dependency. These packages and test textures are not included in the standalone runtime.
