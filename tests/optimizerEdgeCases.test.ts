import { describe, it, expect } from 'vitest';
import { optimize } from '../src/optimizer/engine';
import { validateLayout } from '../src/optimizer/validator';
import type { OptimizerInput } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Optimizer Edge Cases (Section 8.6)', () => {
  const baseSheet = {
    materialKey: 'm1',
    lengthMm: 2000,
    widthMm: 1000,
    grain: 'NONE' as const,
    pricePerSheet: 50,
    available: 10,
  };

  it('handles empty parts list gracefully', () => {
    const input: OptimizerInput = {
      parts: [],
      sheets: [baseSheet],
      settings: DEFAULT_OPTIMIZER_SETTINGS,
    };
    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    expect(res.alternatives).toHaveLength(0);
  });

  it('handles parts with quantity 0 gracefully', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'zero-qty', lengthMm: 400, widthMm: 300, quantity: 0, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [baseSheet],
      settings: DEFAULT_OPTIMIZER_SETTINGS,
    };
    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings.some((w) => w.code === 'ZERO_QUANTITY_PART')).toBe(true);
  });

  it('handles part exactly the size of usable area', () => {
    const trim = { top: 10, bottom: 10, left: 10, right: 10 };
    const usableL = 2000 - 20; // 1980
    const usableW = 1000 - 20; // 980

    const input: OptimizerInput = {
      parts: [
        { id: 'exact', lengthMm: usableL, widthMm: usableW, quantity: 1, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [baseSheet],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        trimMm: trim,
        dimensionsAreFinished: false,
      },
    };

    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    const layout = res.alternatives[0]!;
    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0]!.placements).toHaveLength(1);

    const val = validateLayout(input, layout);
    expect(val.valid).toBe(true);
  });

  it('handles part 1mm larger than usable area with clear error', () => {
    const usableL = 2000 - 20; // 1980
    const usableW = 1000 - 20; // 980

    const input: OptimizerInput = {
      parts: [
        { id: 'too-big', lengthMm: usableL + 1, widthMm: usableW, quantity: 1, materialKey: 'm1', grain: 'FIXED' },
      ],
      sheets: [
        { ...baseSheet, grain: 'ALONG_LENGTH' },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
        dimensionsAreFinished: false,
      },
    };

    const res = optimize(input);
    expect(res.errors.some((e) => e.code === 'PART_TOO_LARGE' || e.code === 'PART_TOO_LARGE_GRAIN_LOCKED')).toBe(true);
  });

  it('handles kerf 0 and kerf 10 without crashes', () => {
    for (const kerf of [0, 10]) {
      const input: OptimizerInput = {
        parts: [
          { id: 'p1', lengthMm: 400, widthMm: 300, quantity: 2, materialKey: 'm1', grain: 'FREE' },
        ],
        sheets: [baseSheet],
        settings: {
          ...DEFAULT_OPTIMIZER_SETTINGS,
          kerfMm: kerf,
          dimensionsAreFinished: false,
        },
      };

      const res = optimize(input);
      expect(res.errors).toHaveLength(0);
      const val = validateLayout(input, res.alternatives[0]!);
      expect(val.valid).toBe(true);
    }
  });

  it('handles non-integer dimensions (e.g. 349.5 mm)', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'fractional', lengthMm: 349.5, widthMm: 199.5, quantity: 2, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [baseSheet],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        dimensionsAreFinished: false,
      },
    };

    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    const val = validateLayout(input, res.alternatives[0]!);
    expect(val.valid).toBe(true);
  });

  it('handles stock limit (available = 1) with more parts than fit', () => {
    // 10 parts of 1000 x 500 cannot fit on 1 sheet of 2000 x 1000
    const input: OptimizerInput = {
      parts: [
        { id: 'lots', lengthMm: 1000, widthMm: 500, quantity: 10, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [
        { ...baseSheet, available: 1 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        dimensionsAreFinished: false,
      },
    };

    const res = optimize(input);
    expect(res.alternatives[0]!.sheets).toHaveLength(1);
    // Placements should not exceed what fits on the single sheet
    expect(res.alternatives[0]!.sheets[0]!.placements.length).toBeLessThan(10);
  });

  it('handles quantity 100 identical parts efficiently', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'bulk', lengthMm: 300, widthMm: 200, quantity: 100, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [baseSheet],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        search: { timeBudgetMs: 500, maxIterations: 10, seed: 123 },
        dimensionsAreFinished: false,
      },
    };

    const res = optimize(input);
    expect(res.errors).toHaveLength(0);
    const val = validateLayout(input, res.alternatives[0]!);
    expect(val.valid).toBe(true);
  });
});
