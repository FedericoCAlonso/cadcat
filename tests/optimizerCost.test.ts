import { describe, it, expect } from 'vitest';
import { computeLayoutCost, compareCandidates } from '../src/optimizer/cost';
import type { Settings } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Cost computation (Section 6.5 & 8.2)', () => {
  const baseSettings: Settings = {
    ...DEFAULT_OPTIMIZER_SETTINGS,
    machine: 'PANEL_SAW',
    cost: {
      pricePerCut: 2.0,
      includedCuts: 5,
      minimumCharge: 15.0,
      pricePerMeterCut: 3.0,
      offcutCreditPerM2: 5.0,
      minOffcutMm: 300,
    },
  };

  it('computes cut cost with includedCuts and minimumCharge for PANEL_SAW', () => {
    // 8 passes, 5 included -> 3 chargeable cuts * $2 = $6.
    // But minimumCharge is $15 -> cutCost should be $15.
    const resMin = computeLayoutCost({
      sheets: [{ sheetType: { materialKey: 'm1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 10 } }],
      totalPasses: 8,
      totalCutLengthM: 10,
      offcuts: [],
      settings: baseSettings,
    });

    expect(resMin.sheets).toBe(50);
    expect(resMin.cuts).toBe(15);
    expect(resMin.credit).toBe(0);
    expect(resMin.total).toBe(65);

    // 20 passes, 5 included -> 15 chargeable cuts * $2 = $30 > minimumCharge ($15) -> cutCost $30.
    const resHigher = computeLayoutCost({
      sheets: [{ sheetType: { materialKey: 'm1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 50, available: 10 } }],
      totalPasses: 20,
      totalCutLengthM: 25,
      offcuts: [],
      settings: baseSettings,
    });

    expect(resHigher.cuts).toBe(30);
    expect(resHigher.total).toBe(80);
  });

  it('computes cut cost per meter for CNC', () => {
    const cncSettings: Settings = {
      ...baseSettings,
      machine: 'CNC',
    };

    // 12 meters * $3/meter = $36.
    const res = computeLayoutCost({
      sheets: [{ sheetType: { materialKey: 'm1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 100, available: 5 } }],
      totalPasses: 10,
      totalCutLengthM: 12,
      offcuts: [],
      settings: cncSettings,
    });

    expect(res.sheets).toBe(100);
    expect(res.cuts).toBe(36);
    expect(res.total).toBe(136);
  });

  it('applies offcut credit', () => {
    // One offcut of 1000 x 1000 mm = 1 m2 * $5/m2 credit = $5 credit.
    const res = computeLayoutCost({
      sheets: [{ sheetType: { materialKey: 'm1', lengthMm: 2000, widthMm: 1000, grain: 'NONE', pricePerSheet: 100, available: 5 } }],
      totalPasses: 15,
      totalCutLengthM: 15,
      offcuts: [{ x: 1000, y: 0, w: 1000, h: 1000 }],
      settings: baseSettings,
    });

    // 15 passes - 5 included = 10 * 2 = 20.
    // sheets = 100, cuts = 20, credit = 5 -> total = 115.
    expect(res.cuts).toBe(20);
    expect(res.credit).toBe(5);
    expect(res.total).toBe(115);
  });

  it('compares candidates under MIN_MATERIAL, MIN_CUTS, MIN_COST, and BALANCED', () => {
    const candA = { sheetsUsed: 1, wasteAreaMm2: 200_000, passes: 10, totalCost: 70, largestOffcutAreaMm2: 500_000 };
    const candB = { sheetsUsed: 1, wasteAreaMm2: 150_000, passes: 15, totalCost: 80, largestOffcutAreaMm2: 400_000 };

    // Under MIN_MATERIAL: candB has less waste area -> candB is better (score < 0 for B)
    expect(compareCandidates(candB, candA, 'MIN_MATERIAL')).toBeLessThan(0);

    // Under MIN_CUTS: candA has fewer passes (10 vs 15) -> candA is better
    expect(compareCandidates(candA, candB, 'MIN_CUTS')).toBeLessThan(0);

    // Under MIN_COST: candA has lower totalCost ($70 vs $80) -> candA is better
    expect(compareCandidates(candA, candB, 'MIN_COST')).toBeLessThan(0);

    // Under BALANCED: weighted combination
    const cmp = compareCandidates(candA, candB, 'BALANCED', { material: 1.0, cuts: 10.0, sheets: 100.0 });
    expect(cmp).toBeLessThan(0);
  });
});
