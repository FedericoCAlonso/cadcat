import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { optimize } from '../src/optimizer/engine';
import { validateLayout } from '../src/optimizer/validator';
import type { OptimizerInput, Part, SheetType } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Optimizer Property Tests (Section 8.4)', () => {
  const standardSheet: SheetType = {
    materialKey: 'mdf-18',
    lengthMm: 2750,
    widthMm: 1830,
    grain: 'ALONG_LENGTH',
    pricePerSheet: 50,
    available: 50,
  };

  it('Property 2: Determinism - same input and same seed gives identical result', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'p1', lengthMm: 800, widthMm: 400, quantity: 2, materialKey: 'mdf-18', grain: 'FREE' },
        { id: 'p2', lengthMm: 1200, widthMm: 600, quantity: 1, materialKey: 'mdf-18', grain: 'FIXED' },
        { id: 'p3', lengthMm: 500, widthMm: 300, quantity: 3, materialKey: 'mdf-18', grain: 'AUTO', visible: false },
      ],
      sheets: [standardSheet],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        search: { timeBudgetMs: 300, maxIterations: 50, seed: 42 },
      },
    };

    const res1 = optimize(input);
    const res2 = optimize(input);

    expect(res1.selectedIndex).toEqual(res2.selectedIndex);
    expect(res1.alternatives[0]!.metrics).toEqual(res2.alternatives[0]!.metrics);
    expect(res1.alternatives[0]!.sheets).toEqual(res2.alternatives[0]!.sheets);
  });

  it('Property 1 & 3: validateLayout passes and sheetsUsed >= lowerBoundSheets across random instances', () => {
    // Generate random realistic instances
    const partArbitrary = fc.record({
      id: fc.stringMatching(/^[a-z0-9_-]{2,8}$/),
      lengthMm: fc.integer({ min: 100, max: 1500 }),
      widthMm: fc.integer({ min: 100, max: 1000 }),
      quantity: fc.integer({ min: 1, max: 3 }),
      materialKey: fc.constant('mdf-18'),
      grain: fc.constantFrom('FREE', 'FIXED', 'AUTO') as fc.Arbitrary<'FREE' | 'FIXED' | 'AUTO'>,
      visible: fc.boolean(),
    });

    fc.assert(
      fc.property(
        fc.uniqueArray(partArbitrary, { selector: (p) => p.id, minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 999999 }),
        (parts: Part[], seed: number) => {
          const input: OptimizerInput = {
            parts,
            sheets: [standardSheet],
            settings: {
              ...DEFAULT_OPTIMIZER_SETTINGS,
              search: { timeBudgetMs: 150, maxIterations: 20, seed },
            },
          };

          const res = optimize(input);
          expect(res.errors).toHaveLength(0);

          for (const layout of res.alternatives) {
            const val = validateLayout(input, layout);
            expect(val.valid).toBe(true);
            expect(layout.metrics.sheetsUsed).toBeGreaterThanOrEqual(layout.metrics.lowerBoundSheets);
          }
        },
      ),
      { numRuns: 100 }, // 100 random cases in quick test suite
    );
  });
});
