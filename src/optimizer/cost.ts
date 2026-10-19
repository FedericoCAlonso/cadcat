import type {
  Settings,
  SheetType,
  Rect,
  LayoutMetricsCost,
  Objective,
  SettingsWeights,
} from './types';

export interface ComputeCostParams {
  sheets: { sheetType: SheetType; passes?: number; cutLengthM?: number }[];
  totalPasses: number;
  totalCutLengthM: number;
  offcuts: Rect[];
  settings: Settings;
}

export const DEFAULT_WEIGHTS: SettingsWeights = {
  material: 1.0,
  cuts: 0.1,
  sheets: 1000.0,
};

/**
 * Computes cost breakdown for a layout according to Section 6.5:
 * sheetCost    = sum(price of each used sheet)
 * cutCost      = max(minimumCharge, max(0, passes - includedCuts) * pricePerCut)  (PANEL_SAW)
 *              = cutLengthM * pricePerMeterCut                                     (CNC)
 * creditOffcut = sum(area of usable offcuts in m2) * offcutCreditPerM2
 * totalCost    = sheetCost + cutCost - creditOffcut
 */
export function computeLayoutCost(params: ComputeCostParams): LayoutMetricsCost {
  const { sheets, totalPasses, totalCutLengthM, offcuts, settings } = params;
  const costCfg = settings.cost;

  // 1. Sheet cost
  let sheetCost = 0;
  for (const s of sheets) {
    sheetCost += s.sheetType.pricePerSheet ?? 0;
  }

  // 2. Cut cost
  let cutCost = 0;
  if (settings.machine === 'CNC') {
    cutCost = (totalCutLengthM ?? 0) * (costCfg?.pricePerMeterCut ?? 0);
  } else {
    // PANEL_SAW or MANUAL_FREE
    const chargeableCuts = Math.max(0, (totalPasses ?? 0) - (costCfg?.includedCuts ?? 0));
    const calculatedCutCharge = chargeableCuts * (costCfg?.pricePerCut ?? 0);
    cutCost = Math.max(costCfg?.minimumCharge ?? 0, calculatedCutCharge);
  }

  // 3. Offcut credit
  let creditOffcut = 0;
  const creditPerM2 = costCfg?.offcutCreditPerM2 ?? 0;
  if (creditPerM2 > 0 && offcuts && offcuts.length > 0) {
    let totalOffcutAreaM2 = 0;
    for (const off of offcuts) {
      totalOffcutAreaM2 += (off.w * off.h) / 1_000_000;
    }
    creditOffcut = totalOffcutAreaM2 * creditPerM2;
  }

  // 4. Total cost
  const total = Math.max(0, sheetCost + cutCost - creditOffcut);

  return {
    sheets: Math.round(sheetCost * 100) / 100,
    cuts: Math.round(cutCost * 100) / 100,
    credit: Math.round(creditOffcut * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export interface ScoreComponents {
  sheetsUsed: number;
  wasteAreaMm2: number;
  passes: number;
  totalCost: number;
  largestOffcutAreaMm2: number;
}

/**
 * Compares two candidate layouts A and B under an objective.
 * Returns negative if A is better than B, positive if B is better than A, 0 if equal.
 *
 * | Objective    | Score (lower is better)                                     |
 * |--------------|-------------------------------------------------------------|
 * | MIN_MATERIAL | 1) sheets used 2) waste area 3) passes (tie break)          |
 * | MIN_CUTS     | 1) passes 2) sheets used 3) waste area (tie break)          |
 * | MIN_COST     | totalCost, then sheets used                                 |
 * | BALANCED     | w.material * wasteArea + w.sheets * sheetsUsed + w.cuts * p |
 *
 * In all cases, prefer layouts that leave one large offcut (largestOffcutArea higher is better as tie break).
 */
export function compareCandidates(
  a: ScoreComponents,
  b: ScoreComponents,
  objective: Objective,
  weights?: SettingsWeights,
): number {
  if (objective === 'MIN_MATERIAL') {
    if (a.sheetsUsed !== b.sheetsUsed) return a.sheetsUsed - b.sheetsUsed;
    if (Math.abs(a.wasteAreaMm2 - b.wasteAreaMm2) > 10) return a.wasteAreaMm2 - b.wasteAreaMm2;
    if (a.passes !== b.passes) return a.passes - b.passes;
    // Tie break: prefer larger single offcut (descending)
    return b.largestOffcutAreaMm2 - a.largestOffcutAreaMm2;
  }

  if (objective === 'MIN_CUTS') {
    if (a.passes !== b.passes) return a.passes - b.passes;
    if (a.sheetsUsed !== b.sheetsUsed) return a.sheetsUsed - b.sheetsUsed;
    if (Math.abs(a.wasteAreaMm2 - b.wasteAreaMm2) > 10) return a.wasteAreaMm2 - b.wasteAreaMm2;
    return b.largestOffcutAreaMm2 - a.largestOffcutAreaMm2;
  }

  if (objective === 'MIN_COST') {
    if (Math.abs(a.totalCost - b.totalCost) > 0.01) return a.totalCost - b.totalCost;
    if (a.sheetsUsed !== b.sheetsUsed) return a.sheetsUsed - b.sheetsUsed;
    if (a.passes !== b.passes) return a.passes - b.passes;
    return b.largestOffcutAreaMm2 - a.largestOffcutAreaMm2;
  }

  // BALANCED
  const w = weights ?? DEFAULT_WEIGHTS;
  // Convert waste area to m2 to keep numbers balanced
  const scoreA = w.material * (a.wasteAreaMm2 / 1_000_000) + w.sheets * a.sheetsUsed + w.cuts * a.passes;
  const scoreB = w.material * (b.wasteAreaMm2 / 1_000_000) + w.sheets * b.sheetsUsed + w.cuts * b.passes;

  if (Math.abs(scoreA - scoreB) > 0.001) return scoreA - scoreB;
  return b.largestOffcutAreaMm2 - a.largestOffcutAreaMm2;
}
