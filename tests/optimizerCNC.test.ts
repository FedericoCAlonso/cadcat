import { describe, it, expect } from 'vitest';
import { optimize } from '../src/optimizer/engine';
import { validateLayout } from '../src/optimizer/validator';
import type { OptimizerInput } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Constructor B (CNC / MaxRects) - Section 6.3', () => {
  it('places pieces using free layout for CNC machine', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'part-1', lengthMm: 400, widthMm: 300, quantity: 2, materialKey: 'ply-18', grain: 'FREE' },
        { id: 'part-2', lengthMm: 500, widthMm: 200, quantity: 1, materialKey: 'ply-18', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'ply-18', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 60, available: 5 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        machine: 'CNC',
        kerfMm: 6.0, // standard CNC tool diameter
        cost: {
          ...DEFAULT_OPTIMIZER_SETTINGS.cost,
          pricePerMeterCut: 2.5,
        },
      },
    };

    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    expect(res.alternatives).toHaveLength(3);

    const layout = res.alternatives[res.selectedIndex]!;
    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0]!.placements).toHaveLength(3);

    // Validate layout with independent validator
    const val = validateLayout(input, layout);
    expect(val.valid).toBe(true);

    // Verify CNC cut cost matches cut length * pricePerMeterCut
    const expectedCutCost = Math.round(layout.metrics.cutLengthM * 2.5 * 100) / 100;
    expect(layout.metrics.cost.cuts).toBe(expectedCutCost);
  });
});
