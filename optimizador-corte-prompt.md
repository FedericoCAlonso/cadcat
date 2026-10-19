# TASK: Build the sheet cutting optimizer for Mobilius

## 1. Goal

Build a cutting optimizer module for the Mobilius furniture design PWA.
The module takes a list of parts and a list of sheets.
It returns a cutting layout for each sheet, the cut sequence, and a cost breakdown.

Three types of user use the module:

- A workshop owner with his own saw or CNC. He wants to save material.
- A private person who sends the cut to a cutting service. He wants to save money.
- A cutting service or a store. It wants a clean parts list for its own software.

The user must be able to configure the module for his needs.
Do not hard-code one working method.

## 2. Rules for you (the agent)

1. Read the repository first. Use the language, the folder structure and the test tools that the project already uses. If the project has no preference, use TypeScript.
2. Write the module as a **pure library**. It must not use the DOM, IndexedDB or global state. Input and output must be JSON-serializable.
3. The module must run in a Web Worker. Add a thin worker wrapper with progress and cancel.
4. Use no external runtime dependency for the algorithm. Dev dependencies for tests are allowed.
5. Use millimeters for all lengths. Use integers or round to 0.1 mm. Document the choice.
6. Make every random choice depend on a seed. Same input and same seed must give the same result.
7. If a requirement is not clear, make the safest assumption, write it in `ASSUMPTIONS.md`, and continue. Do not stop to ask unless the work cannot continue.
8. Do not claim that a test passes if you did not run it. Report the real numbers.

## 3. Definitions

- **Sheet**: a board of one material and one thickness (for example 18 mm melamine, 2750 x 1830 mm).
- **Part**: a rectangular piece that the user needs.
- **Cut size**: the size that the saw cuts. It can differ from the finished size (see 5.2).
- **Pass (cut)**: one saw line that goes from one edge of the current rectangle to the opposite edge.
- **Guillotine layout**: a layout where all cuts are passes. This is the rule for a panel saw (vertical or horizontal).
- **Free layout**: a layout where cuts do not need to go from edge to edge. Only a CNC router or a free cutting method can make it.
- **Offcut**: a usable rectangle that stays after the cuts.
- **Filler part**: an optional part (for example an assembly gauge). It goes in waste areas. It must not cause a new sheet by default.
- **Visible part**: a part with at least one face or edge that the user sees in the finished furniture.

## 4. Data model

Write these types first. Change names if the project has other names. Keep all fields.

```ts
type GrainMode = 'FREE' | 'FIXED' | 'AUTO';      // part
type SheetGrain = 'NONE' | 'ALONG_LENGTH';        // sheet
type MachineKind = 'PANEL_SAW' | 'CNC' | 'MANUAL_FREE';
type Objective = 'MIN_MATERIAL' | 'MIN_COST' | 'MIN_CUTS' | 'BALANCED';

interface EdgeBand { thicknessMm: number; }         // null = no edge band

interface Part {
  id: string;                  // unique, stable, printable label
  label?: string;              // user name, for example "Side left"
  lengthMm: number;            // dimension along the grain direction
  widthMm: number;
  quantity: number;            // >= 1
  materialKey: string;         // material + thickness. Parts with different keys never share a sheet
  grain: GrainMode;
  visible?: boolean;           // used only if grain = AUTO. Default: true (safe)
  edges?: { l1?: EdgeBand|null; l2?: EdgeBand|null; w1?: EdgeBand|null; w2?: EdgeBand|null };
  isFiller?: boolean;          // optional part, low priority
  fillerMinCount?: number;     // 0 = fully optional
  group?: string;              // optional: keep parts of this group on the same sheet if possible
}

interface SheetType {
  materialKey: string;
  lengthMm: number;            // along the grain
  widthMm: number;
  grain: SheetGrain;
  pricePerSheet: number;
  available: number;           // Infinity allowed. A finite number is stock (offcuts, leftovers)
  isOffcut?: boolean;          // an offcut from stock. Price can be 0
}

interface Settings {
  machine: MachineKind;
  objective: Objective;
  weights?: { material: number; cuts: number; sheets: number }; // used by BALANCED
  kerfMm: number;                       // saw blade width. Default 3
  trimMm: { top: number; bottom: number; left: number; right: number }; // edge trim. Default 10 on each side
  trimCutsAreCharged: boolean;          // default true
  dimensionsAreFinished: boolean;       // true: part size includes edge band (see 5.2)
  maxStages: number;                    // 0 = no limit. 2 or 3 for staged saws
  minStripMm: number;                   // smallest strip the machine or service can cut
  minPartMm: number;                    // smallest part the service accepts
  cost: {
    pricePerCut: number;                // PANEL_SAW
    includedCuts: number;               // free cuts. Default 0
    minimumCharge: number;
    pricePerMeterCut: number;           // CNC
    offcutCreditPerM2: number;          // value of a usable offcut. Default 0
    minOffcutMm: number;                // smallest side that counts as usable offcut
  };
  fillersMayAddSheet: boolean;          // default false
  search: { timeBudgetMs: number; maxIterations: number; seed: number };
}
```

Output:

```ts
interface Result {
  alternatives: Layout[];      // up to 3: best by material, best by cuts, best by cost (can repeat)
  selectedIndex: number;       // the one that matches Settings.objective
  warnings: Warning[];         // typed, with code and part id
  errors: ErrorItem[];         // for example PART_TOO_LARGE
  stats: { elapsedMs: number; iterations: number; seed: number };
}

interface Layout {
  sheets: SheetLayout[];       // one entry for each used sheet
  metrics: {
    sheetsUsed: number; passes: number; cutLengthM: number;
    utilization: number;             // placed area / used sheet area
    utilizationExLast: number;       // same, but the last sheet is not counted
    offcuts: Rect[];                 // usable offcuts, with size
    lowerBoundSheets: number;        // see 6.8
    gapToBound: number;
    cost: { sheets: number; cuts: number; credit: number; total: number };
    unplacedFillers: string[];
  };
}

interface SheetLayout {
  sheetTypeIndex: number;
  placements: { partId: string; instance: number; x: number; y: number; w: number; h: number; rotated: boolean }[];
  cutSequence: CutOp[];        // ordered. See 6.7
}

interface CutOp { order: number; stage: number; dir: 'H'|'V'; pos: number; from: number; to: number; isTrim: boolean; }
```

## 5. Pre-processing

### 5.1 Grouping
Group parts by `materialKey`. Optimize each group alone. Merge the results in the output.

### 5.2 Cut size
If `dimensionsAreFinished` is true:
`cutLength = lengthMm - (l1.thickness + l2.thickness)`
`cutWidth = widthMm - (w1.thickness + w2.thickness)`
If it is false, cut size = given size.
Keep both sizes in the output. Show the finished size and the cut size on the printed plan.

### 5.3 Grain resolution
For each part, resolve the final rotation rule:

| Sheet grain | Part grain | Visible | Rotation allowed |
|---|---|---|---|
| NONE | any | any | yes |
| ALONG_LENGTH | FREE | any | yes |
| ALONG_LENGTH | FIXED | any | no (length along sheet length) |
| ALONG_LENGTH | AUTO | true or unknown | no |
| ALONG_LENGTH | AUTO | false | yes |

Add a function `resolveGrain(part, sheet)`. Test it alone.

### 5.4 Feasibility check
Return an error (do not throw) for each part that cannot fit:
- `PART_TOO_LARGE`: the part does not fit in the usable area of any sheet.
- `PART_TOO_LARGE_GRAIN_LOCKED`: the part fits only if rotated, and the grain rule forbids it.
- `PART_BELOW_MIN`: the part is smaller than `minPartMm`.
- `STRIP_BELOW_MIN`: a strip smaller than `minStripMm` is unavoidable.
Continue with the other parts.

### 5.5 Expansion
Expand each part into `quantity` instances. Keep `partId` and `instance` index.

## 6. Algorithm

Use a **constructive heuristic + randomized search**. Do not use exact methods (ILP, column generation).

### 6.1 Usable area
Usable area of a sheet = sheet size minus the trim on each side.
Kerf: every cut removes `kerfMm`. Two parts that touch one cut line are `kerfMm` apart.

### 6.2 Constructor A: free guillotine rectangles (PANEL_SAW, default)
1. Keep a list of free rectangles. At the start, there is one: the usable area.
2. Take parts in the order given by the search (see 6.4).
3. For each part, test each free rectangle and each allowed rotation. Choose the position with the best score. Default score: **Best Short Side Fit**. Make the score replaceable (also: Best Area Fit, Best Long Side Fit).
4. Place the part in the bottom-left corner of the free rectangle.
5. Split the remaining free space with a guillotine cut. Each placement creates two new free rectangles. Make the **split rule** replaceable: shorter leftover axis, longer leftover axis, shorter axis, longer axis, max area. The search chooses it.
6. Subtract `kerfMm` on both new cut lines.
7. If no free rectangle on any open sheet fits the part, open a new sheet. Choose the sheet type with the lowest price that fits. Respect `available`.
8. After each placement, merge free rectangles that touch and form a larger rectangle (only when the merge keeps the guillotine property).

If `maxStages > 0`, use a staged variant: place parts in strips (stage 1 = strips along one direction, stage 2 = cross cuts, stage 3 = trim of the piece). Implement the stage limit as a filter on the split rule. The search chooses the first cut direction (H or V).

### 6.3 Constructor B: free layout (CNC, MANUAL_FREE)
Use **MaxRects** with Best Short Side Fit. Use the same search and cost function.
Kerf for CNC is the tool diameter. Set `kerfMm` by default to 6 for CNC.
Do not use guillotine splitting for this constructor.
The cut length is the perimeter of each part that is not on the sheet edge. Document how you count shared edges.

### 6.4 Search: GRASP with iterated local search
1. Build the first solution with the order "largest area first".
2. Repeat until `timeBudgetMs` or `maxIterations` ends, or until the lower bound is reached:
   1. Create a candidate order. Use one of: sort by area, by longest side, by width, by perimeter. Add noise: swap or move a few parts.
   2. For each part with free rotation, flip the preferred rotation with a small probability.
   3. Choose at random: first cut direction, score function, split rule.
   4. Build the layout with the constructor.
   5. Compute the cost (see 6.5).
   6. Local search: take the worst filled sheet. Try to move its parts to the free space of other sheets. If the sheet becomes empty, remove it.
   7. Accept the candidate with simulated annealing. Cool the temperature during the run.
3. Keep an **elite set**. Keep the best layout for each objective: material, cuts, cost.
4. Check the clock at least every 20 ms. Support cancel from the worker.

### 6.5 Cost function
Compute these values for each layout:

```
sheetCost    = sum(price of each used sheet)
cutCost      = max(minimumCharge, max(0, passes - includedCuts) * pricePerCut)    // PANEL_SAW
             = cutLengthM * pricePerMeterCut                                       // CNC
creditOffcut = sum(area of usable offcuts in m2) * offcutCreditPerM2
totalCost    = sheetCost + cutCost - creditOffcut
```

A pass counts if it is a trim cut and `trimCutsAreCharged` is true, or if it is not a trim cut.

The **search score** for each objective:

| Objective | Score (lower is better) |
|---|---|
| MIN_MATERIAL | 1) sheets used 2) waste area 3) passes (tie break) |
| MIN_CUTS | 1) passes 2) sheets used 3) waste area (tie break) |
| MIN_COST | totalCost, then sheets used |
| BALANCED | w.material * wasteArea + w.sheets * sheetsUsed + w.cuts * passes |

Use a lexicographic compare for MIN_MATERIAL and MIN_CUTS.
Prefer layouts that leave **one large offcut** over many small ones. Use the largest offcut area as a second tie break.

### 6.6 Filler parts (assembly gauges)
1. Place all normal parts first.
2. Then try to place filler parts in the free rectangles. Use the smallest free rectangle that fits.
3. If a filler does not fit and `fillersMayAddSheet` is false, do not place it. Put its id in `unplacedFillers` and add a warning.
4. If `fillerMinCount` is more than 0, the module must place at least that count. It can then add a sheet.
5. Show the extra cost of the fillers in the result: cost with fillers minus cost without fillers.

### 6.7 Cut sequence
Build the cut sequence from the layout. Each `CutOp` has a stage, a direction, a position and a length.
Rules:
- Start with trim cuts (if the trim is more than 0).
- Then do stage 1 cuts, then stage 2, then stage 3.
- Inside a stage, order the cuts from one side to the other.
- Executing the sequence on the sheet must give exactly the placed parts and the offcuts. Test this (see 8).
This list is for a manual operator. Make the measure of each cut easy to read.

### 6.8 Lower bound
`lowerBoundSheets = ceil(sum(partCutAreas) / usableAreaOfBestSheet)`.
Report it in the result. Report `gapToBound = sheetsUsed - lowerBoundSheets`.
If `sheetsUsed == lowerBoundSheets`, stop the search at once.

## 7. Quality of the user experience in the result

1. Return warnings with a code and a human-readable key. Do not return free text only.
2. Give each part a short printable label that matches the assembly plan.
3. Mark filler parts in the layout.
4. Mark which parts had the grain rule relaxed because they are not visible. The user must see this.
5. The result must say that the layout is a **reference** when the machine is `PANEL_SAW` and the user sends the cut to a service. Add a field `isReference` in the export. The service can change the layout.

## 8. Test plan (quality gates)

Write the tests **before** the algorithm when you can. Use the project test runner. Add `fast-check` (or the equivalent) for property tests.

### 8.1 Independent validator (most important)
Write `validateLayout(input, layout)` in a separate file. It must not import code from the constructors.
It must check:
1. Every part instance appears exactly once, or is in the unplaced list with a reason.
2. Every placement is inside the usable area of its sheet.
3. No two placements overlap. Parts are at least `kerfMm` apart (when kerf > 0).
4. Rotation obeys the resolved grain rule.
5. Cut size matches section 5.2.
6. Sheets used do not exceed `available`.
7. For `PANEL_SAW`: the layout is **guillotine-separable**. Use a recursive test: in a rectangle, find a line (a band of kerf width) that crosses no part and splits the parts into two non-empty groups. Repeat in each group. If a group has more than one part and has no such line, the layout is invalid.
8. For `maxStages > 0`: the depth of the cut tree is not more than `maxStages`.
9. The cut sequence, when simulated on the sheet, gives exactly the placements. The `passes` count in the metrics equals the number of charged cuts in the sequence.
10. Area balance: placed area + waste area + kerf and trim area = used sheet area (tolerance 0.1 mm per rectangle).

Call `validateLayout` in **every** test. Call it in development builds after every optimization.
Add **mutation tests**: change a valid layout on purpose (move a part by 1 mm so it overlaps, rotate a grain-locked part, delete a part, add an edge-to-edge-violating position). The validator must find each fault.

### 8.2 Unit tests
- `resolveGrain`: the full table in 5.3.
- Cut size with edge band: all four edges, with and without `dimensionsAreFinished`.
- Cost function: each objective, `includedCuts`, `minimumCharge`, offcut credit, CNC meter price.
- Pass counting with and without charged trim cuts.
- Feasibility errors: `PART_TOO_LARGE`, `PART_TOO_LARGE_GRAIN_LOCKED`, `PART_BELOW_MIN`.
- Free rectangle split and merge: no overlap, area is conserved.

### 8.3 Known-answer tests (golden)
Create small instances with a known best result. Examples:
1. Four parts that tile one sheet exactly (set kerf = 0 and trim = 0): 1 sheet, utilization 100%, 3 passes.
2. The same case with kerf 3: the module must report the parts that no longer fit, or use the smaller sizes, and must not produce an overlap.
3. Ten identical strips from one sheet: the module must give the known maximum count per sheet.
4. A case where the best material layout uses more passes than the best cuts layout. The `MIN_MATERIAL` result must have sheets <= the `MIN_CUTS` result. The `MIN_CUTS` result must have passes <= the `MIN_MATERIAL` result.
5. A textured sheet with parts that fit only if some are rotated. `FIXED` gives more sheets. `AUTO` with `visible = false` gives fewer or equal sheets. Never more.
6. A filler part that fits in waste: the sheet count does not change. A filler that does not fit: it is in `unplacedFillers` and the sheet count does not change.
7. Two materials in one input: the result never mixes them on one sheet.

Save the layout of each golden test as a snapshot. A change in a snapshot must be a conscious decision.

### 8.4 Property tests
Generate random instances: 1 to 120 parts, random sizes from 50 mm to 90% of the sheet, random grain modes, random settings. For each instance, assert:
1. `validateLayout` passes.
2. Same seed gives the same result (deep equal).
3. `sheetsUsed >= lowerBoundSheets`.
4. More time budget never gives a worse result for the same seed (or: the best of N runs is never worse than a single run).
5. If you add a part, the total area used does not decrease.
6. Switching `AUTO + hidden` parts to `FREE` gives the same layout validity and sheets <= the `FIXED` case.

Run at least 500 random cases in the normal test run. Run 5000 in a nightly script.

### 8.5 Benchmark and quality targets
Create a benchmark script with:
- 10 realistic furniture sets (kitchen base cabinet, wardrobe, desk, bookshelf, drawer set). Include real part sizes. Use the 2750 x 1830 mm sheet.
- 3 public guillotine cutting instances from the literature, if you can get them without a network problem. If not, generate synthetic ones with known structure and say so.

Measure and print: sheets used, lower bound, utilization, passes, run time.
**Initial targets** (tune them after the first measurement and write the real numbers in `BENCHMARK.md`):
- Sheets used <= lower bound + 1 in at least 95% of the realistic sets.
- Utilization (excluding the last sheet) of 85% or more on the realistic sets with `grain = NONE`.
- `MIN_CUTS` gives fewer or equal passes than `MIN_MATERIAL` in 100% of the sets.
- Default search finishes in 3 seconds or less for 150 parts on a mid-range laptop. Report the device.
- Cancel from the worker stops the run in 200 ms or less.

### 8.6 Edge cases
Test each of these. The module must not crash. It must return a clear error or warning.
- Empty parts list. Quantity 0. Quantity 500.
- Part exactly the size of the usable area.
- Part 1 mm larger than the usable area.
- All parts identical.
- A sheet type with `available = 1` and too many parts (must report that the stock is not enough).
- Kerf 0 and kerf 10.
- Very long thin strips below `minStripMm`.
- Non-integer sizes (for example 349.5 mm).
- Duplicate part ids (must return a validation error).
- NaN, negative or missing values in the input (must return a validation error with the field name).

### 8.7 Definition of done
The work is done only when all of these are true:
1. All tests in 8.1 to 8.6 pass. Show the output.
2. The module has no import from the DOM or from storage.
3. `ASSUMPTIONS.md` and `BENCHMARK.md` exist with real numbers.
4. A README explains each setting in one sentence and gives one example for each of the three user types in section 1.
5. A demo script reads a JSON input and prints an ASCII or SVG plan for each sheet, and the cut sequence.

## 9. Work order

1. Types, input validation and the independent validator, with the mutation tests.
2. Pre-processing (cut size, grain, feasibility) with unit tests.
3. Constructor A with a fixed order. Pass all golden tests.
4. Cost function and the three objectives.
5. Search (GRASP + local search + annealing). Run the property tests.
6. Fillers, offcut credit, multiple sheet types and stock.
7. Cut sequence and its simulation test.
8. Constructor B for CNC.
9. Worker wrapper, progress, cancel.
10. Benchmark, README, final report.

After each step, run all tests and report in the form: *step, tests run, tests passed, problems*.

## 10. Out of scope (do not build now)

- Stacked cutting (cut of several sheets in one pass).
- Defects in the sheet (holes, damaged areas).
- Part shapes that are not rectangles.
- User interface. The UI team will use the `Result` type.
- Online sync, accounts, or any network call.

## 11. Final report format

At the end, give: a list of files created, the measured benchmark table, the assumptions that you made, the known limits, and the three most important risks that you see.
