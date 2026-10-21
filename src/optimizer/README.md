# CadCat Sheet Cutting Optimizer

High-performance 2D sheet cutting optimization engine for furniture panels, panel saws, and CNC routers. Implemented as a pure, dependency-free TypeScript library that runs seamlessly in the browser (Web Worker) or Node.js.

---

## ⚙️ Settings Reference (One-Sentence Summary)

- `machine`: Defines the cutting equipment mode (`PANEL_SAW` for guillotine edge-to-edge passes, `CNC` or `MANUAL_FREE` for free-form MaxRects contouring).
- `objective`: The optimization goal (`MIN_MATERIAL` minimizes sheets and waste, `MIN_COST` minimizes overall invoice dollars, `MIN_CUTS` minimizes saw passes, and `BALANCED` uses custom weights).
- `weights`: Custom cost weighting coefficients (`material`, `cuts`, `sheets`) used when `objective` is set to `BALANCED`.
- `kerfMm`: The saw blade thickness or CNC tool cutter diameter in millimeters deducted on every cut line.
- `trimMm`: Edge trim margins (`top`, `bottom`, `left`, `right`) in millimeters removed from raw board borders to eliminate damaged edges.
- `trimCutsAreCharged`: Boolean indicating whether initial perimeter trim cuts count as billable passes.
- `dimensionsAreFinished`: When true, edge band thicknesses are subtracted from finished piece dimensions to obtain raw cut dimensions.
- `maxStages`: Restricts the recursive guillotine sawing depth to 2 or 3 stages for staged panel saws (0 disables stage restrictions).
- `minStripMm`: Minimum allowable strip width that can be safely processed by the saw carriage without chipping or kickback.
- `minPartMm`: Minimum part dimension accepted by workshop handling or cutting service rules.
- `cost.pricePerCut`: Charge per saw pass on panel saws once free included cuts are exhausted.
- `cost.includedCuts`: Number of free saw passes bundled into the base cutting service package.
- `cost.minimumCharge`: Minimum baseline billing charge applied to cutting orders.
- `cost.pricePerMeterCut`: Cutting rate per linear meter used in CNC routing calculations.
- `cost.offcutCreditPerM2`: Credit reimbursed per square meter for usable leftover remnants retained by the workshop.
- `cost.minOffcutMm`: Minimum length and width dimension required for a leftover rectangle to be classified as a usable offcut.
- `fillersMayAddSheet`: When false, filler parts (e.g. assembly gauges) are only nestled into waste spaces without opening extra sheets.
- `search.timeBudgetMs`: Maximum time budget in milliseconds allocated to the GRASP/Simulated Annealing search.
- `search.maxIterations`: Maximum number of random constructive and local search iterations executed before returning.
- `search.seed`: Deterministic pseudo-random seed guaranteeing that identical inputs yield identical layouts.

---

## 👤 User Configuration Examples

### 1. Workshop Owner (Saw / CNC, Saves Material)
A craftsman using a sliding table saw or CNC who wants maximum yield, minimal waste, and utilizes offcuts:
```ts
const workshopSettings: Settings = {
  machine: 'PANEL_SAW',
  objective: 'MIN_MATERIAL',
  kerfMm: 3.2,
  trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
  trimCutsAreCharged: false,
  dimensionsAreFinished: true,
  maxStages: 0,
  minStripMm: 30,
  minPartMm: 50,
  cost: {
    pricePerCut: 0,
    includedCuts: 0,
    minimumCharge: 0,
    pricePerMeterCut: 0,
    offcutCreditPerM2: 8.0,
    minOffcutMm: 400,
  },
  fillersMayAddSheet: false,
  search: { timeBudgetMs: 2000, maxIterations: 500, seed: 101 },
};
```

### 2. Private Person (Cutting Service, Saves Money)
A DIY maker purchasing boards and paying per cut, prioritizing minimum financial cost:
```ts
const diySettings: Settings = {
  machine: 'PANEL_SAW',
  objective: 'MIN_COST',
  kerfMm: 3.0,
  trimMm: { top: 15, bottom: 15, left: 15, right: 15 },
  trimCutsAreCharged: true,
  dimensionsAreFinished: true,
  maxStages: 3,
  minStripMm: 50,
  minPartMm: 70,
  cost: {
    pricePerCut: 1.5,
    includedCuts: 10,
    minimumCharge: 20.0,
    pricePerMeterCut: 0,
    offcutCreditPerM2: 0,
    minOffcutMm: 500,
  },
  fillersMayAddSheet: false,
  search: { timeBudgetMs: 1500, maxIterations: 300, seed: 42 },
};
```

### 3. Retail Cutting Service / Store (Clean Parts List & Fast Turnaround)
A commercial store preparing clean reference cutting plans with stage limits and minimal passes:
```ts
const storeSettings: Settings = {
  machine: 'PANEL_SAW',
  objective: 'MIN_CUTS',
  kerfMm: 4.0,
  trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
  trimCutsAreCharged: true,
  dimensionsAreFinished: false,
  maxStages: 2,
  minStripMm: 60,
  minPartMm: 100,
  cost: {
    pricePerCut: 2.0,
    includedCuts: 0,
    minimumCharge: 15.0,
    pricePerMeterCut: 0,
    offcutCreditPerM2: 5.0,
    minOffcutMm: 300,
  },
  fillersMayAddSheet: false,
  search: { timeBudgetMs: 1000, maxIterations: 200, seed: 999 },
};
```

---

## 🚀 Running Demos and Benchmarks

- **Run CLI Demo**:
  ```bash
  npx tsx src/optimizer/demo.ts
  ```
- **Run Benchmark Suite**:
  ```bash
  npx tsx src/optimizer/benchmark.ts
  ```
