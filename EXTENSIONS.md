# Extension model

Both bundled modules and user-installed modules are ordinary extension folders.
`ExtensionCatalog` seeds missing bundled directories into
`%LOCALAPPDATA%\FigmaGifAssistant\extensions` once, then discovers all modules
from that directory. Existing folders are never silently overwritten.

Each module declares its independent version, ordered scripts, command names,
design access label and optional native capabilities in `module.json`. Only
enabled valid modules are composed into the installed local payload. Changes
take effect after reapplying and restarting Figma.

- `modules/`: bundled seed extensions, using the public manifest/SDK.
- `templates/`: examples for extension authors.
- `runtime/`: shared loader, sidebar host, SDK, theme and native capability bridge.
- `src/`: Windows manager and archive installer.
- `checks/`: portable mocked runtime checks and synthetic archive installer checks.

See [SDK.md](SDK.md) for the declarative API and lifecycle, and
[SDK-COMPONENTS.md](SDK-COMPONENTS.md) for composable panels. Native capability
names currently include `export-png`, `open-export-folder` and
`choose-export-folder`. The manifest is not an isolation sandbox.
