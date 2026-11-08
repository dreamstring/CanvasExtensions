# Maintenance

Development takes place directly on `main`. Use Conventional Commits:
`feat:`, `fix:`, `docs:`, `build:` or `ci:`.

Keep host and module versions independent. Add extension behavior under
`modules/<id>`; keep the shared framework free of module-specific dispatch.
Preserve lifecycle cleanup and review native capabilities explicitly.

Run `npm test`, the synthetic .NET checks, and the standalone build before
publishing. Do not commit build outputs, local Figma resources, logs, installation
records or private design captures. Binary releases are built from tagged source
by GitHub Actions.
