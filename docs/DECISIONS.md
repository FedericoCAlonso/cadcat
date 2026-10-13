# Architecture and Design Decisions

Document language: ASD-STE100 (Simplified Technical English).

## ADR-001: Strict TypeScript and Vitest

- **Status:** Accepted.
- **Context:** The application requires high reliability and offline support without server validation.
- **Decision:** Use TypeScript in strict mode. Use Vitest with `jsdom` and `fake-indexeddb` for unit tests.
- **Consequence:** Strict type checks prevent runtime errors. Tests run fast in memory.

## ADR-002: Service Worker and PWA Shell

- **Status:** Accepted.
- **Context:** The application must work without a network after initial load.
- **Decision:** Use `vite-plugin-pwa` with Workbox to generate the service worker and web app manifest. Precache all HTML, JavaScript, CSS, and asset files. Use a navigation route fallback to `index.html`.
- **Consequence:** The application loads offline. Updates apply cleanly with `autoUpdate`.

## ADR-003: Storage Layer with IndexedDB

- **Status:** Accepted.
- **Context:** The application has no server. It stores JSON objects locally.
- **Decision:** Implement a typed IndexedDB wrapper in `src/storage/db.ts`. Require an `id` string and a `schemaVersion` number on all stored items.
- **Consequence:** Data persists locally. The application can migrate data across schema versions.

## ADR-004: Runtime Validation with Zod

- **Status:** Accepted.
- **Context:** The application loads external JSON data and user input that must match data contracts.
- **Decision:** Use Zod schemas in `src/model/` for all entities. Infer TypeScript types from schemas.
- **Consequence:** Data gets checked at runtime on load. Invalid data gets rejected immediately.

## ADR-005: Shop Value Placeholder `TO_CONFIRM`

- **Status:** Accepted.
- **Context:** Shop values such as prices, clearances, and tolerances must not be invented.
- **Decision:** Define `shopValueSchema` as `number | 'TO_CONFIRM'`. Allow this union on unconfirmed parameters in catalogs.
- **Consequence:** Seed catalogs remain valid while explicitly marking values that the domain expert must verify.
