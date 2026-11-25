# Text Editor

A Windows-first, local-first document workspace built with Electron.

## Development

```bash
npm install
npm start
```

Run JavaScript syntax checks before opening a pull request:

```bash
npm run check
```

## Current foundation

- Electron main process with context isolation, sandboxing, disabled renderer Node integration, and external-link handling.
- A deliberately small preload bridge. Filesystem access will be added later through validated IPC methods rather than exposing Node APIs to the renderer.
- Vanilla JavaScript renderer retained from the starter application.
- Workspace Home, Documents, and Editor views.
- Reusable CSS custom properties for themes, surfaces, typography, and accent color.
- Light, dark, and system theme preferences, plus accent and default-font preferences.
- Existing rich-text editing behavior and browser-local document persistence retained while the storage layer is scheduled for a later phase.

## Architecture decisions

The renderer must not access Node.js or Electron APIs directly. Privileged operations belong in the main process and should be exposed through narrowly scoped preload methods with input validation.

The current editor and storage implementation are intentionally preserved as a starter foundation. Phase 3 will replace browser-local document persistence with an explicit local filesystem and database service. The editor UI should remain independent of that storage implementation.

## V1 scope boundaries

This branch implements the project foundation and initial design system/application shell (Phases 1 and 2). It does not claim to implement document database/filesystem management, import/export, advanced editor features, or production packaging.
