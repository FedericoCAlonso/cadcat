import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/optimizer/prng';
import { resolveGrain } from '../src/optimizer/grain';
import { computeCutSize } from '../src/optimizer/cutSize';
import { validateInput } from '../src/optimizer/inputValidation';
import { validateLayout } from '../src/optimizer/validator';
import type { OptimizerInput, Layout, SheetLayout } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('PRNG (Mulberry32)', () => {
  it('is deterministic: same seed gives identical sequence', () => {
    const prng1 = new PRNG(42);
    const prng2 = new PRNG(42);

    const seq1 = Array.from({ length: 10 }, () => prng1.next());
    const seq2 = Array.from({ length: 10 }, () => prng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('generates numbers within bounds', () => {
    const prng = new PRNG(12345);
    for (let i = 0; i < 100; i++) {
      const val = prng.nextInt(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('shuffles arrays deterministically', () => {
    const prng1 = new PRNG(99);
    const prng2 = new PRNG(99);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];

    expect(prng1.shuffle(arr)).toEqual(prng2.shuffle(arr));
  });
});

describe('Grain resolution (Section 5.3 table)', () => {
  it('allows rotation when sheet grain is NONE', () => {
    expect(resolveGrain({ grain: 'FIXED' }, { grain: 'NONE' })).toEqual({ canRotate: true, grainRelaxed: false });
    expect(resolveGrain({ grain: 'FREE' }, { grain: 'NONE' })).toEqual({ canRotate: true, grainRelaxed: false });
    expect(resolveGrain({ grain: 'AUTO', visible: true }, { grain: 'NONE' })).toEqual({ canRotate: true, grainRelaxed: false });
  });

  it('allows rotation when sheet grain is ALONG_LENGTH and part grain is FREE', () => {
    expect(resolveGrain({ grain: 'FREE' }, { grain: 'ALONG_LENGTH' })).toEqual({ canRotate: true, grainRelaxed: false });
  });

  it('forbids rotation when sheet grain is ALONG_LENGTH and part grain is FIXED', () => {
    expect(resolveGrain({ grain: 'FIXED' }, { grain: 'ALONG_LENGTH' })).toEqual({ canRotate: false, grainRelaxed: false });
  });

  it('forbids rotation when sheet grain is ALONG_LENGTH and part grain is AUTO with visible=true or undefined', () => {
    expect(resolveGrain({ grain: 'AUTO', visible: true }, { grain: 'ALONG_LENGTH' })).toEqual({ canRotate: false, grainRelaxed: false });
    expect(resolveGrain({ grain: 'AUTO' }, { grain: 'ALONG_LENGTH' })).toEqual({ canRotate: false, grainRelaxed: false });
  });

  it('allows rotation and marks relaxed when AUTO with visible=false', () => {
    expect(resolveGrain({ grain: 'AUTO', visible: false }, { grain: 'ALONG_LENGTH' })).toEqual({ canRotate: true, grainRelaxed: true });
  });
});

describe('Cut size deduction (Section 5.2)', () => {
  it('deducts edge bands when dimensionsAreFinished is true', () => {
    const part = {
      id: 'p1',
      lengthMm: 1000,
      widthMm: 500,
      quantity: 1,
      materialKey: 'm1',
      grain: 'FREE' as const,
      edges: {
        l1: { thicknessMm: 2 },
        l2: { thicknessMm: 1 },
        w1: { thicknessMm: 0.5 },
        w2: { thicknessMm: 0.5 },
      },
    };

    const res = computeCutSize(part, true);
    expect(res.cutLengthMm).toBe(997);
    expect(res.cutWidthMm).toBe(499);
    expect(res.finishedLengthMm).toBe(1000);
    expect(res.finishedWidthMm).toBe(500);
  });

  it('does not deduct edge bands when dimensionsAreFinished is false', () => {
    const part = {
      id: 'p1',
      lengthMm: 1000,
      widthMm: 500,
      quantity: 1,
      materialKey: 'm1',
      grain: 'FREE' as const,
      edges: {
        l1: { thicknessMm: 2 },
      },
    };

    const res = computeCutSize(part, false);
    expect(res.cutLengthMm).toBe(1000);
    expect(res.cutWidthMm).toBe(500);
  });
});

describe('Input validation (Section 8.6)', () => {
  const baseInput: OptimizerInput = {
    parts: [
      { id: 'part-1', lengthMm: 800, widthMm: 400, quantity: 2, materialKey: 'melamine-18', grain: 'FREE' },
    ],
    sheets: [
      { materialKey: 'melamine-18', lengthMm: 2750, widthMm: 1830, grain: 'ALONG_LENGTH', pricePerSheet: 50, available: 10 },
    ],
    settings: DEFAULT_OPTIMIZER_SETTINGS,
  };

  it('passes valid input', () => {
    const res = validateInput(baseInput);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('detects duplicate part IDs', () => {
    const input: OptimizerInput = {
      ...baseInput,
      parts: [
        { id: 'dup', lengthMm: 500, widthMm: 500, quantity: 1, materialKey: 'm1', grain: 'FREE' },
        { id: 'dup', lengthMm: 600, widthMm: 600, quantity: 1, materialKey: 'm1', grain: 'FREE' },
      ],
    };
    const res = validateInput(input);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'DUPLICATE_PART_ID')).toBe(true);
  });

  it('detects NaN or negative dimensions', () => {
    const input: OptimizerInput = {
      ...baseInput,
      parts: [
        { id: 'bad', lengthMm: -100, widthMm: NaN, quantity: 1, materialKey: 'm1', grain: 'FREE' },
      ],
    };
    const res = validateInput(input);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'INVALID_DIMENSION')).toBe(true);
  });
});

describe('Independent Validator and Mutation Tests (Section 8.1)', () => {
  const input: OptimizerInput = {
    parts: [
      { id: 'p1', lengthMm: 600, widthMm: 400, quantity: 1, materialKey: 'm1', grain: 'FIXED' },
      { id: 'p2', lengthMm: 600, widthMm: 400, quantity: 1, materialKey: 'm1', grain: 'FREE' },
    ],
    sheets: [
      { materialKey: 'm1', lengthMm: 2000, widthMm: 1000, grain: 'ALONG_LENGTH', pricePerSheet: 40, available: 5 },
    ],
    settings: {
      ...DEFAULT_OPTIMIZER_SETTINGS,
      kerfMm: 3,
      trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
      dimensionsAreFinished: false,
    },
  };

  function createValidLayout(): Layout {
    const sheet: SheetLayout = {
      sheetTypeIndex: 0,
      sheetLengthMm: 2000,
      sheetWidthMm: 1000,
      placements: [
        { partId: 'p1', instance: 0, x: 10, y: 10, w: 600, h: 400, rotated: false },
        { partId: 'p2', instance: 0, x: 10 + 600 + 3, y: 10, w: 600, h: 400, rotated: false },
      ],
      cutSequence: [],
    };

    return {
      sheets: [sheet],
      metrics: {
        sheetsUsed: 1,
        passes: 0,
        cutLengthM: 0,
        utilization: (600 * 400 * 2) / (2000 * 1000),
        utilizationExLast: 0,
        offcuts: [],
        lowerBoundSheets: 1,
        gapToBound: 0,
        cost: { sheets: 40, cuts: 0, credit: 0, total: 40 },
        unplacedFillers: [],
      },
    };
  }

  it('validates a correct layout', () => {
    const layout = createValidLayout();
    const res = validateLayout(input, layout);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('mutation 1: detects part overlap when moved by 1mm', () => {
    const layout = createValidLayout();
    // Move p2 to overlap p1
    layout.sheets[0]!.placements[1]!.x = 10 + 600 - 1; // 1mm overlap!

    const res = validateLayout(input, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'PARTS_OVERLAP')).toBe(true);
  });

  it('mutation 2: detects kerf distance violation when gap is less than kerf', () => {
    const layout = createValidLayout();
    // Kerf is 3mm, gap is 2mm
    layout.sheets[0]!.placements[1]!.x = 10 + 600 + 2;

    const res = validateLayout(input, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code.startsWith('KERF_VIOLATION'))).toBe(true);
  });

  it('mutation 3: detects rotation of grain-locked part', () => {
    const layout = createValidLayout();
    // p1 has grain: FIXED on ALONG_LENGTH sheet -> rotation forbidden
    layout.sheets[0]!.placements[0]!.rotated = true;
    layout.sheets[0]!.placements[0]!.w = 400;
    layout.sheets[0]!.placements[0]!.h = 600;

    const res = validateLayout(input, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'GRAIN_RULE_VIOLATION')).toBe(true);
  });

  it('mutation 4: detects deleted / missing part instance', () => {
    const layout = createValidLayout();
    layout.sheets[0]!.placements.pop(); // remove p2

    const res = validateLayout(input, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'PART_INSTANCE_COUNT_MISMATCH')).toBe(true);
  });

  it('mutation 5: detects out of usable bounds placement (exceeding trim)', () => {
    const layout = createValidLayout();
    // Sheet is 2000 x 1000, trim left is 10. Placing at x = 5 violates trim
    layout.sheets[0]!.placements[0]!.x = 5;

    const res = validateLayout(input, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'OUT_OF_USABLE_BOUNDS')).toBe(true);
  });

  it('mutation 6: detects non-guillotine pinwheel configuration', () => {
    // Pinwheel pattern with 4 parts interlocking around a central void: impossible to separate with edge-to-edge cut
    const pinwheelInput: OptimizerInput = {
      parts: [
        { id: 'w1', lengthMm: 300, widthMm: 100, quantity: 1, materialKey: 'm1', grain: 'FREE' },
        { id: 'w2', lengthMm: 100, widthMm: 300, quantity: 1, materialKey: 'm1', grain: 'FREE' },
        { id: 'w3', lengthMm: 300, widthMm: 100, quantity: 1, materialKey: 'm1', grain: 'FREE' },
        { id: 'w4', lengthMm: 100, widthMm: 300, quantity: 1, materialKey: 'm1', grain: 'FREE' },
      ],
      sheets: [
        { materialKey: 'm1', lengthMm: 1000, widthMm: 1000, grain: 'NONE', pricePerSheet: 10, available: 1 },
      ],
      settings: {
        ...DEFAULT_OPTIMIZER_SETTINGS,
        kerfMm: 0,
        trimMm: { top: 0, bottom: 0, left: 0, right: 0 },
        dimensionsAreFinished: false,
      },
    };

    // Standard interlocking pinwheel 400x400:
    // w1: [0, 300] x [0, 100]
    // w2: [300, 400] x [0, 300]
    // w3: [100, 400] x [300, 400]
    // w4: [0, 100] x [100, 400]
    // Void in center: [100, 300] x [100, 300]
    const layout: Layout = {
      sheets: [
        {
          sheetTypeIndex: 0,
          sheetLengthMm: 1000,
          sheetWidthMm: 1000,
          placements: [
            { partId: 'w1', instance: 0, x: 0, y: 0, w: 300, h: 100, rotated: false },
            { partId: 'w2', instance: 0, x: 300, y: 0, w: 100, h: 300, rotated: false },
            { partId: 'w3', instance: 0, x: 100, y: 300, w: 300, h: 100, rotated: false },
            { partId: 'w4', instance: 0, x: 0, y: 100, w: 100, h: 300, rotated: false },
          ],
          cutSequence: [],
        },
      ],
      metrics: {
        sheetsUsed: 1,
        passes: 0,
        cutLengthM: 0,
        utilization: 0.16,
        utilizationExLast: 0,
        offcuts: [],
        lowerBoundSheets: 1,
        gapToBound: 0,
        cost: { sheets: 10, cuts: 0, credit: 0, total: 10 },
        unplacedFillers: [],
      },
    };

    const res = validateLayout(pinwheelInput, layout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'NOT_GUILLOTINE_SEPARABLE')).toBe(true);
  });
});
