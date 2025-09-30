# BMR Slicer Web

BMR Slicer Web is a Next.js 15 App Router experience for exploring mesh slicing, estimating resin
usage, and exporting reports completely in the browser. The project combines Three.js rendering,
Dexie persistence stubs, Comlink powered workers, and Zustand based state management to offer a
responsive preview of print-ready layers.

## Features

- 🔪 **Geometry slicing** – derive cross-sections from STL or BufferGeometry JSON assets and render
  them in WebGL.
- 📊 **Estimation engine** – compute layer-by-layer metrics, resin consumption, mass, and print
  duration using configurable parameters.
- 🧠 **Stateful viewer** – manage uploaded meshes, layer selections, and export flows with a typed
  Zustand store.
- 📦 **Report exports** – download JSON + CSV summaries for sharing or archival.
- 🧵 **Worker offloading** – lightweight clients route geometry slicing and estimation through
  dedicated Comlink workers to keep the UI responsive.
- 🧪 **Testing-ready** – Vitest unit suite and Playwright smoke tests with scripts wired to pnpm.

## Project structure

```
app/                # App Router routes and layout
components/         # Client components for layout, viewer, and summaries
lib/                # Logger, configuration, and worker helpers
modules/            # Domain logic (geometry, estimate, export, store, viewer)
public/             # PWA manifest and favicon
styles/             # Global stylesheet
workers/            # Comlink entrypoints for geometry + estimation
tests/ & e2e/       # Vitest unit tests and Playwright specs
```

## Getting started

> Requirements: Node.js 20+, pnpm 8+ (via corepack), and a browser with WebGL.

Install dependencies and initialize Husky hooks:

```bash
pnpm install
pnpm prepare
```

Run the development server:

```bash
pnpm dev
```

The app is available at [http://localhost:3000](http://localhost:3000). Upload a mesh to the
viewer, explore generated layers, and export reports.

## Available commands

| Command              | Description                                         |
| -------------------- | --------------------------------------------------- |
| `pnpm dev`           | Start the Next.js dev server with Turbopack         |
| `pnpm build`         | Create a production build                           |
| `pnpm start`         | Serve the production build                          |
| `pnpm lint`          | Run ESLint against the codebase                     |
| `pnpm type-check`    | Execute TypeScript project checks                   |
| `pnpm test`          | Run Vitest unit tests (jsdom environment)           |
| `pnpm coverage`      | Generate coverage reports via Vitest                |
| `pnpm e2e`           | Build the app and launch Playwright tests           |
| `pnpm format`        | Format files with Prettier                          |
| `pnpm release`       | Trigger release-please for changelog automation     |

## Offline experience

Building the project (`pnpm build`) generates a production service worker via `next-pwa`. When the
app is served (`pnpm start`), the worker precaches the application shell and uses runtime caching
strategies to keep geometry assets available offline (`CacheFirst`) and fall back to cached API
responses when the network is unreachable (`NetworkFirst`). After visiting a page once, you can
toggle your browser offline and refresh to keep interacting with the viewer UI and previously
fetched data.

The Playwright suite includes an offline smoke test that loads the home page, waits for the service
worker to take control, and then reloads the page with `page.context().setOffline(true)` to confirm
the cached shell renders as expected.

## Testing

Unit tests live under `tests/` and are powered by Vitest with jsdom. Worker-facing modules are
covered with proxy stubs to ensure the Zustand store delegates geometry + estimation work to the
background threads. End-to-end smoke checks reside in `e2e/` and are executed by Playwright using
the same pnpm workspace scripts. Configure `PLAYWRIGHT_BASE_URL` to point at a deployed environment
when running against staging.

## Tooling highlights

- **ESLint + Prettier** using shared config, lint-staged, and Husky pre-commit hooks.
- **Vitest** for rapid unit feedback with React testing utilities.
- **Playwright** for E2E verification of navigation and health endpoints.
- **Release Please** configuration for automated semantic releases.

## Browser support

Modern evergreen browsers with WebGL 2 are supported. Worker offloading will automatically run in
browsers that expose the Worker API; the UI gracefully falls back to main-thread computation.

## License

This project is provided as part of the BMR Slicer workspace and inherits the repository license.
