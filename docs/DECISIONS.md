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

## ADR-006: Shelf Deflection Verification

- **Status:** Accepted.
- **Context:** Long or thin shelves bend excessively under storage load. The user needs design feedback without blocking production.
- **Decision:** Implement Euler-Bernoulli beam theory deflection check in `src/resolver/deflection.ts`. Use simply supported uniform load formula $\delta = \frac{5 \cdot W \cdot L^3}{384 \cdot E \cdot I}$. Evaluate against limits $\min(L / \text{maxDeflectionRatio}, \text{maxAbsoluteDeflectionMm})$. Show warnings only (never block generation) in Piece List and 3D Viewport inspector. Mark limits as `TO_CONFIRM`.
- **Consequence:** Designers receive immediate feedback when shelf spans or thicknesses risk excessive sag.

## ADR-007: Guillotine Cut Pass Counting and Pass Optimization Architecture

- **Status:** Accepted.
- **Context:** Workshop costing requires cutting operations to be priced per saw pass or per cut length. Cutting time on panel saws depends on the number of continuous straight cuts across sheets rather than area alone.
- **Decision:**
  1. Add `optimizationGoal` (`'min-waste' | 'min-passes'`) to `NestingConfig`.
  2. Implement guillotine cut pass counting in `src/workers/guillotineNesting.ts`. Merge collinear cut lines within saw kerf tolerance across strips. Add 4 perimeter passes for sheet squaring trims.
  3. When `optimizationGoal` is `'min-passes'`, sort pieces by cut height to produce continuous horizontal rip strips, minimizing blade repositioning. When `'min-waste'`, use First-Fit-Decreasing by piece area.
  4. In `src/resolver/cost.ts`, calculate `cutPassCost = totalCutPasses * pricePerCutPass` when `pricePerCutPass` is confirmed, and include it in `ModuleCostSummary` and `grandTotal`.
- **Consequence:** Workshop operators can choose between material savings and saw cycle time reduction, and cost estimates accurately reflect physical saw labor.

## ADR-008: Automatic Assembly Gauge Derivation and Two-Pass Offcut Nesting

- **Status:** Accepted.
- **Context:** Manual assembly in the workshop requires measuring distances repeatedly with tape measures, which introduces human error and slows assembly. Auxiliary gauge strips cut to exact clear spans eliminate manual measuring. Additionally, cutting gauges from primary full sheets increases waste, while unused board offcuts can supply these narrow strips at zero additional sheet material cost.
- **Decision:**
  1. Add `isAuxiliary?: boolean` to the `Piece` schema and interface.
  2. Implement automatic gauge derivation in `src/resolver/gauges.ts`. Analyze the resolved `JointGraph` and piece coordinates to identify clear spans between facing parallel panels. Group identical spans under unique gauge identifiers (`G1`, `G2`, etc.). Generate auxiliary gauge pieces with `role: 'assembly-gauge'` and width defined by `MachiningConfig.defaultGaugeWidthMm`.
  3. Filter auxiliary pieces out of customer Bill of Materials (`src/resolver/bom.ts`), but keep them in the workshop cut list and cut layout.
  4. In `src/workers/guillotineNesting.ts`, implement two-pass nesting: pack primary customer pieces first, then nest auxiliary pieces into unused offcut rectangles.
  5. In `src/resolver/cost.ts`, charge zero sheet material cost for boards that contain only offcut pieces (`fitsInOffcut: true`). Include only the saw pass cost for auxiliary pieces.
  6. In `src/resolver/assemblySheet.ts` and `src/ui/AssemblySheetView.tsx`, generate sequential numbered assembly instructions referencing gauges, provide an SVG diagram, and support PDF workshop guide export.
- **Consequence:** Assembly accuracy improves and tape measure errors are eliminated. Auxiliary gauges reuse scrap offcuts without increasing board purchase costs, and workshop operators receive step-by-step assembly guides.

## ADR-009: Parametric Template Variants and Workshop Hardware Integration

- **Status:** Accepted.
- **Context:** Furniture modules require different hardware mounting configurations, such as applied versus inset drawer fronts, and full-overlay, half-overlay, or inset hinged doors. Hardcoding clearances in templates prevents workshop customization. Different slide systems (telescopic ball-bearing, concealed undermount, and metal box sides) demand different lateral clearances and vertical box offsets.
- **Decision:**
  1. Add `hardwareConfigSchema` to `ProjectConfig` with customizable clearances for slides (`telescopic`, `undermount`, `metal-box`), reveals, and door gaps. Store defaults in `src/config/defaultProjectConfig.json`.
  2. In `src/resolver/templates/drawer.ts` and `src/resolver/templates/drawerUnit.ts`, support `frontMount: 'applied' | 'inset'` and `slideType: 'telescopic' | 'undermount' | 'metal-box' | 'roller'`. Inset fronts position the drawer box recessed behind the inset front with configurable offset.
  3. In `src/resolver/templates/door.ts` and `src/resolver/templates/doorCabinet.ts`, support `mountType: 'full-overlay' | 'half-overlay' | 'inset'`. Compute door width and positions from carcase thickness and project configuration reveals. Derive hinge vertical margins from `hardware.doorHingeMarginMm` and cup setbacks from `machining.hingeCupEdgeSetbackMm`.
  4. Expose hardware and clearance adjustments in `src/ui/ProjectSettingsView.tsx` under Material Design 3 inputs.
- **Consequence:** Modules dynamically adapt to different door and drawer hardware standards without hardcoded assumptions. The system is ready for the Phase 3 visual Template Editor.
