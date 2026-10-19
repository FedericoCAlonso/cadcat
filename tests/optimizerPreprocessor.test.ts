import { describe, it, expect } from 'vitest';
import { preprocess } from '../src/optimizer/preprocessor';
import type { OptimizerInput } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Optimizer Preprocessor (Section 5)', () => {
  const baseSettings = {
    ...DEFAULT_OPTIMIZER_SETTINGS,
    minPartMm: 50,
    minStripMm: 50,
    trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
  };

  it('groups parts and sheets by materialKey and expands instances', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'p1', lengthMm: 400, widthMm: 300, quantity: 2, materialKey: 'mat-A', grain: 'FREE' },
        { id: 'p2', lengthMm: 500, widthMm: 200, quantity: 1, materialKey: 'mat-B', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 5 },
        { materialKey: 'mat-B', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 40, available: 5 },
      ],
      settings: baseSettings,
    };

    const res = preprocess(input);
    expect(res.errors).toHaveLength(0);
    expect(res.groups).toHaveLength(2);

    const groupA = res.groups.find((g) => g.materialKey === 'mat-A');
    expect(groupA).toBeDefined();
    expect(groupA!.normalInstances).toHaveLength(2);
    expect(groupA!.normalInstances[0]!.instance).toBe(0);
    expect(groupA!.normalInstances[1]!.instance).toBe(1);

    const groupB = res.groups.find((g) => g.materialKey === 'mat-B');
    expect(groupB).toBeDefined();
    expect(groupB!.normalInstances).toHaveLength(1);
  });

  it('detects PART_TOO_LARGE when piece exceeds sheet dimensions', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'huge', lengthMm: 3000, widthMm: 2500, quantity: 1, materialKey: 'mat-A', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2750, widthMm: 1830, grain: 'NONE', pricePerSheet: 50, available: 5 },
      ],
      settings: baseSettings,
    };

    const res = preprocess(input);
    expect(res.errors.some((e) => e.code === 'PART_TOO_LARGE')).toBe(true);
    expect(res.infeasiblePartIds.has('huge')).toBe(true);
  });

  it('detects PART_TOO_LARGE_GRAIN_LOCKED when piece would fit rotated but grain is FIXED', () => {
    // Usable area: 2000 - 20 = 1980 in X, 1000 - 20 = 980 in Y
    // Part is 1200 x 600.
    // If unrotated: length 1200 <= 1980, width 600 <= 980 (fits!).
    // Now make part 1200 x 1500:
    // Unrotated: length 1200 <= 1980, width 1500 > 980 (does not fit unrotated).
    // Rotated: length 1500 <= 1980, width 1200 > 980 (still does not fit).
    // Now make part 800 x 1200:
    // Unrotated: length 800 <= 1980, width 1200 > 980 (does not fit unrotated).
    // Rotated: width 1200 <= 1980, height 800 <= 980 (fits rotated!).
    // But if grain is FIXED and sheet grain is ALONG_LENGTH -> cannot rotate!
    const input: OptimizerInput = {
      parts: [
        { id: 'locked', lengthMm: 800, widthMm: 1200, quantity: 1, materialKey: 'mat-A', grain: 'FIXED' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2000, widthMm: 1000, grain: 'ALONG_LENGTH', pricePerSheet: 50, available: 5 },
      ],
      settings: baseSettings,
    };

    const res = preprocess(input);
    expect(res.errors.some((e) => e.code === 'PART_TOO_LARGE_GRAIN_LOCKED')).toBe(true);
    expect(res.infeasiblePartIds.has('locked')).toBe(true);
  });

  it('detects PART_BELOW_MIN when piece size is below minPartMm', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'tiny', lengthMm: 40, widthMm: 100, quantity: 1, materialKey: 'mat-A', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 5 },
      ],
      settings: {
        ...baseSettings,
        minPartMm: 50,
      },
    };

    const res = preprocess(input);
    expect(res.errors.some((e) => e.code === 'PART_BELOW_MIN')).toBe(true);
    expect(res.infeasiblePartIds.has('tiny')).toBe(true);
  });

  it('detects STRIP_BELOW_MIN when strip size is below minStripMm', () => {
    const input: OptimizerInput = {
      parts: [
        { id: 'thin-strip', lengthMm: 300, widthMm: 30, quantity: 1, materialKey: 'mat-A', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'mat-A', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 5 },
      ],
      settings: {
        ...baseSettings,
        minPartMm: 20,
        minStripMm: 50,
      },
    };

    const res = preprocess(input);
    expect(res.errors.some((e) => e.code === 'STRIP_BELOW_MIN')).toBe(true);
    expect(res.infeasiblePartIds.has('thin-strip')).toBe(true);
  });
});
