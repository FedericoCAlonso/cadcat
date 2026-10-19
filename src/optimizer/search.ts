import type {
  Settings,
  Layout,
  SheetLayout,
  Rect,
} from './types';
import type {
  MaterialGroup,
  PreprocessedPartInstance,
} from './preprocessor';
import { PRNG } from './prng';
import { ConstructorGuillotine, type PlacementScoreRule, type SplitRule } from './constructorGuillotine';
import { ConstructorCNC } from './constructorCNC';
import { computeLayoutCost, compareCandidates, type ScoreComponents } from './cost';

export interface SearchProgress {
  progress: number;
  elapsedMs: number;
  iterations: number;
  bestSheets: number;
}

export type CancelChecker = () => boolean;
export type ProgressCallback = (p: SearchProgress) => void;

interface CandidateSolution {
  sheets: SheetLayout[];
  unplacedParts: PreprocessedPartInstance[];
  score: ScoreComponents;
}

const SPLIT_RULES: readonly SplitRule[] = [
  'SHORTER_LEFTOVER_AXIS',
  'LONGER_LEFTOVER_AXIS',
  'SHORTER_AXIS',
  'LONGER_AXIS',
  'MAX_AREA',
];

const SCORE_RULES: readonly PlacementScoreRule[] = ['BSSF', 'BLSF', 'BAF'];

export class SearchEngine {
  private prng: PRNG;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
    this.prng = new PRNG(settings.search.seed ?? 123456789);
  }

  /**
   * Optimizes a single material group using GRASP + ILS + Simulated Annealing.
   */
  optimizeGroup(
    group: MaterialGroup,
    checkCancel?: CancelChecker,
    onProgress?: ProgressCallback,
  ): {
    bestLayout: Layout;
    bestByMaterial: Layout;
    bestByCuts: Layout;
    bestByCost: Layout;
    unplacedFillers: string[];
    iterations: number;
  } {
    const startTime = performance.now();
    const timeBudgetMs = this.settings.search.timeBudgetMs ?? 2000;
    const maxIterations = this.settings.search.maxIterations ?? 500;

    // 1. Lower bound calculation (Section 6.8)
    const bestSheet = group.sheets.reduce((best, s) => {
      const area = s.usableLengthMm * s.usableWidthMm;
      return area > best.area ? { s, area } : best;
    }, { s: group.sheets[0]!, area: 0 });

    const totalNormalArea = group.normalInstances.reduce((sum, p) => sum + p.areaMm2, 0);
    const lowerBoundSheets = bestSheet.area > 0 ? Math.ceil(totalNormalArea / bestSheet.area) : 0;

    // 2. Initial order: largest area first
    const initialParts = [...group.normalInstances].sort((a, b) => b.areaMm2 - a.areaMm2);

    let current = this.evaluateCandidate(initialParts, group, 'BSSF', 'SHORTER_LEFTOVER_AXIS', 'V');
    let bestMaterial = current;
    let bestCuts = current;
    let bestCost = current;
    let bestSelected = current;

    // Simulated annealing initial temperature
    let temperature = 1.0;
    const coolingRate = 0.992;
    let iterations = 0;
    let lastClockCheck = startTime;

    // Check if lower bound already reached
    if (current.sheets.length <= lowerBoundSheets) {
      // Optimum sheet count reached!
    } else {
      for (let iter = 1; iter <= maxIterations; iter++) {
        iterations = iter;
        const now = performance.now();

        // Check clock & cancellation every ~20ms
        if (now - lastClockCheck > 20) {
          lastClockCheck = now;
          if (now - startTime >= timeBudgetMs || (checkCancel && checkCancel())) {
            break;
          }
          if (onProgress) {
            onProgress({
              progress: Math.min(1.0, (now - startTime) / timeBudgetMs),
              elapsedMs: now - startTime,
              iterations: iter,
              bestSheets: bestSelected.sheets.length,
            });
          }
        }

        // 3. Create candidate order (sort + noise)
        const candidateParts = this.generateCandidateOrder(group.normalInstances);

        // Random constructor parameters
        const scoreRule = this.prng.pick(SCORE_RULES);
        const splitRule = this.prng.pick(SPLIT_RULES);
        const firstCutDir = this.prng.nextBool() ? 'H' : 'V';

        let candidate = this.evaluateCandidate(candidateParts, group, scoreRule, splitRule, firstCutDir);

        // 4. Local search: try removing the worst filled sheet if candidate has > 1 sheet
        if (candidate.sheets.length > 1) {
          candidate = this.localSearchPack(candidate, group, scoreRule, splitRule);
        }

        // 5. Update elite set
        if (compareCandidates(candidate.score, bestMaterial.score, 'MIN_MATERIAL') < 0) {
          bestMaterial = candidate;
        }
        if (compareCandidates(candidate.score, bestCuts.score, 'MIN_CUTS') < 0) {
          bestCuts = candidate;
        }
        if (compareCandidates(candidate.score, bestCost.score, 'MIN_COST') < 0) {
          bestCost = candidate;
        }

        // Compare against currently selected objective
        const diff = compareCandidates(candidate.score, current.score, this.settings.objective, this.settings.weights);
        if (diff < 0) {
          current = candidate;
          if (compareCandidates(candidate.score, bestSelected.score, this.settings.objective, this.settings.weights) < 0) {
            bestSelected = candidate;
          }
        } else {
          // Simulated annealing acceptance
          const prob = Math.exp(-diff / Math.max(0.001, temperature));
          if (this.prng.next() < prob) {
            current = candidate;
          }
        }

        temperature *= coolingRate;

        // Early exit if sheetsUsed reached lower bound under MIN_MATERIAL
        if (bestSelected.sheets.length <= lowerBoundSheets && this.settings.objective === 'MIN_MATERIAL') {
          break;
        }
      }
    }

    // 6. Handle fillers on the final layouts (Section 6.6)
    const { layout: finalLayout, unplacedFillers } = this.placeFillers(bestSelected, group, lowerBoundSheets);
    const layoutMaterial = this.placeFillers(bestMaterial, group, lowerBoundSheets).layout;
    const layoutCuts = this.placeFillers(bestCuts, group, lowerBoundSheets).layout;
    const layoutCost = this.placeFillers(bestCost, group, lowerBoundSheets).layout;

    return {
      bestLayout: finalLayout,
      bestByMaterial: layoutMaterial,
      bestByCuts: layoutCuts,
      bestByCost: layoutCost,
      unplacedFillers,
      iterations,
    };
  }

  private generateCandidateOrder(normalParts: readonly PreprocessedPartInstance[]): PreprocessedPartInstance[] {
    const list = [...normalParts];

    // Pick sort criterion
    const mode = this.prng.nextInt(0, 3);
    switch (mode) {
      case 0: // area descending
        list.sort((a, b) => b.areaMm2 - a.areaMm2);
        break;
      case 1: // longest side descending
        list.sort((a, b) => Math.max(b.cutLengthMm, b.cutWidthMm) - Math.max(a.cutLengthMm, a.cutWidthMm));
        break;
      case 2: // width descending
        list.sort((a, b) => b.cutWidthMm - a.cutWidthMm);
        break;
      case 3: // perimeter descending
        list.sort((a, b) => (b.cutLengthMm + b.cutWidthMm) - (a.cutLengthMm + a.cutWidthMm));
        break;
    }

    // Add noise: swap 1 or 2 pairs
    const swaps = this.prng.nextInt(1, 2);
    for (let i = 0; i < swaps; i++) {
      if (list.length > 1) {
        const idx1 = this.prng.nextInt(0, list.length - 1);
        const idx2 = this.prng.nextInt(0, list.length - 1);
        const tmp = list[idx1]!;
        list[idx1] = list[idx2]!;
        list[idx2] = tmp;
      }
    }

    return list;
  }

  private evaluateCandidate(
    parts: PreprocessedPartInstance[],
    group: MaterialGroup,
    scoreRule: PlacementScoreRule,
    splitRule: SplitRule,
    firstCutDir: 'H' | 'V',
  ): CandidateSolution {
    const usedCounts = new Map<number, number>();

    let sheets: SheetLayout[];
    let unplacedParts: PreprocessedPartInstance[];

    if (this.settings.machine === 'CNC' || this.settings.machine === 'MANUAL_FREE') {
      const cnc = new ConstructorCNC(this.settings);
      const res = cnc.build(parts, group.sheets, usedCounts);
      sheets = res.sheets;
      unplacedParts = res.unplacedParts;
    } else {
      const guillotine = new ConstructorGuillotine(this.settings, {
        scoreRule,
        splitRule,
        firstCutDir,
      });
      const res = guillotine.build(parts, group.sheets, usedCounts);
      sheets = res.sheets;
      unplacedParts = res.unplacedParts;
    }

    // Compute metrics and score components
    let totalWasteArea = 0;
    let totalPasses = 0;
    let totalCutLengthM = 0;
    let maxOffcutArea = 0;
    const allOffcuts: Rect[] = [];

    const sheetTypesUsed: { sheetType: (typeof group.sheets)[0]['sheetType']; passes?: number; cutLengthM?: number }[] = [];

    for (const s of sheets) {
      totalWasteArea += s.wasteAreaMm2 ?? 0;
      totalPasses += s.passes ?? 0;
      totalCutLengthM += s.cutLengthM ?? 0;
      if (s.offcuts) {
        for (const off of s.offcuts) {
          allOffcuts.push(off);
          const area = off.w * off.h;
          if (area > maxOffcutArea) maxOffcutArea = area;
        }
      }
      sheetTypesUsed.push({
        sheetType: group.sheets[s.sheetTypeIndex]!.sheetType,
        passes: s.passes,
        cutLengthM: s.cutLengthM,
      });
    }

    const cost = computeLayoutCost({
      sheets: sheetTypesUsed,
      totalPasses,
      totalCutLengthM,
      offcuts: allOffcuts,
      settings: this.settings,
    });

    const score: ScoreComponents = {
      sheetsUsed: sheets.length + unplacedParts.length * 10,
      wasteAreaMm2: totalWasteArea,
      passes: totalPasses,
      totalCost: cost.total,
      largestOffcutAreaMm2: maxOffcutArea,
    };

    return { sheets, unplacedParts, score };
  }

  private localSearchPack(
    cand: CandidateSolution,
    group: MaterialGroup,
    scoreRule: PlacementScoreRule,
    splitRule: SplitRule,
  ): CandidateSolution {
    if (cand.sheets.length <= 1) return cand;

    // Find worst filled sheet (lowest placed area)
    let worstIdx = 0;
    let minPlacedArea = Infinity;

    for (let i = 0; i < cand.sheets.length; i++) {
      const area = cand.sheets[i]!.usedAreaMm2 ?? 0;
      if (area < minPlacedArea) {
        minPlacedArea = area;
        worstIdx = i;
      }
    }

    const worstSheet = cand.sheets[worstIdx]!;
    // If the worst sheet has few parts (e.g. <= 3), try to remove it and place its parts into the remaining sheets
    if (worstSheet.placements.length > 4) {
      return cand;
    }

    // Extract all parts from all sheets except worstSheet, put worstSheet's parts first
    const partsMap = new Map(group.normalInstances.map((p) => [`${p.partId}-${p.instance}`, p]));
    const worstParts: PreprocessedPartInstance[] = [];
    const otherParts: PreprocessedPartInstance[] = [];

    for (const p of worstSheet.placements) {
      const inst = partsMap.get(`${p.partId}-${p.instance}`);
      if (inst) worstParts.push(inst);
    }

    for (let i = 0; i < cand.sheets.length; i++) {
      if (i === worstIdx) continue;
      for (const p of cand.sheets[i]!.placements) {
        const inst = partsMap.get(`${p.partId}-${p.instance}`);
        if (inst) otherParts.push(inst);
      }
    }

    // Try packing with other parts first, then worst parts (or vice versa)
    const reordered = [...otherParts, ...worstParts];
    const repacked = this.evaluateCandidate(reordered, group, scoreRule, splitRule, 'V');

    if (repacked.sheets.length < cand.sheets.length && repacked.unplacedParts.length === 0) {
      return repacked;
    }

    return cand;
  }

  private placeFillers(
    candidate: CandidateSolution,
    group: MaterialGroup,
    lowerBoundSheets: number,
  ): { layout: Layout; unplacedFillers: string[] } {
    const unplacedFillers: string[] = [];
    const fillerParts = [...group.fillerInstances];
    const sheets = candidate.sheets.map((s) => ({
      ...s,
      placements: [...s.placements],
      offcuts: s.offcuts ? [...s.offcuts] : [],
    }));

    // Place fillers into existing free offcuts / waste if possible
    for (const filler of fillerParts) {
      let placed = false;

      for (const sheet of sheets) {
        if (!sheet.offcuts || sheet.offcuts.length === 0) continue;

        // Find smallest offcut that fits
        let bestOffcutIdx = -1;
        let minArea = Infinity;
        let rotated = false;

        for (let i = 0; i < sheet.offcuts.length; i++) {
          const off = sheet.offcuts[i]!;
          const fitsNormal = filler.cutLengthMm <= off.w && filler.cutWidthMm <= off.h;
          const fitsRotated = filler.cutWidthMm <= off.w && filler.cutLengthMm <= off.h;

          if (fitsNormal || fitsRotated) {
            const area = off.w * off.h;
            if (area < minArea) {
              minArea = area;
              bestOffcutIdx = i;
              rotated = !fitsNormal;
            }
          }
        }

        if (bestOffcutIdx >= 0) {
          const off = sheet.offcuts[bestOffcutIdx]!;
          const pw = rotated ? filler.cutWidthMm : filler.cutLengthMm;
          const ph = rotated ? filler.cutLengthMm : filler.cutWidthMm;

          sheet.placements.push({
            partId: filler.partId,
            instance: filler.instance,
            x: off.x,
            y: off.y,
            w: pw,
            h: ph,
            rotated,
            cutLengthMm: filler.cutLengthMm,
            cutWidthMm: filler.cutWidthMm,
            finishedLengthMm: filler.finishedLengthMm,
            finishedWidthMm: filler.finishedWidthMm,
            isFiller: true,
          });

          // Shrink offcut
          const remW = off.w - pw;
          const remH = off.h - ph;
          sheet.offcuts.splice(bestOffcutIdx, 1);
          const minOffcutMm = this.settings.cost?.minOffcutMm ?? 300;

          if (remW >= minOffcutMm && ph >= minOffcutMm) {
            sheet.offcuts.push({ x: off.x + pw, y: off.y, w: remW, h: ph });
          }
          if (off.w >= minOffcutMm && remH >= minOffcutMm) {
            sheet.offcuts.push({ x: off.x, y: off.y + ph, w: off.w, h: remH });
          }

          placed = true;
          break;
        }
      }

      if (!placed) {
        unplacedFillers.push(filler.partId);
      }
    }

    // Recalculate metrics
    let totalPlacedArea = 0;
    let totalPasses = 0;
    let totalCutLengthM = 0;
    const allOffcuts: Rect[] = [];

    for (const s of sheets) {
      totalPasses += s.passes ?? 0;
      totalCutLengthM += s.cutLengthM ?? 0;
      if (s.offcuts) {
        allOffcuts.push(...s.offcuts);
      }
      totalPlacedArea += s.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    }

    const totalSheetArea = sheets.reduce(
      (sum, s) => sum + s.sheetLengthMm * s.sheetWidthMm,
      0,
    );
    const utilization = totalSheetArea > 0 ? totalPlacedArea / totalSheetArea : 0;

    let utilizationExLast = utilization;
    if (sheets.length > 1) {
      const sheetsExLast = sheets.slice(0, -1);
      const placedEx = sheetsExLast.reduce(
        (sum, s) => sum + s.placements.reduce((pSum, p) => pSum + p.w * p.h, 0),
        0,
      );
      const areaEx = sheetsExLast.reduce((sum, s) => sum + s.sheetLengthMm * s.sheetWidthMm, 0);
      utilizationExLast = areaEx > 0 ? placedEx / areaEx : 0;
    }

    const cost = computeLayoutCost({
      sheets: sheets.map((s) => ({
        sheetType: group.sheets[s.sheetTypeIndex]!.sheetType,
        passes: s.passes,
        cutLengthM: s.cutLengthM,
      })),
      totalPasses,
      totalCutLengthM,
      offcuts: allOffcuts,
      settings: this.settings,
    });

    const layout: Layout = {
      sheets,
      metrics: {
        sheetsUsed: sheets.length,
        passes: totalPasses,
        cutLengthM: Math.round(totalCutLengthM * 100) / 100,
        utilization: Math.round(utilization * 1000) / 1000,
        utilizationExLast: Math.round(utilizationExLast * 1000) / 1000,
        offcuts: allOffcuts,
        lowerBoundSheets,
        gapToBound: Math.max(0, sheets.length - lowerBoundSheets),
        cost,
        unplacedFillers,
      },
    };

    return { layout, unplacedFillers };
  }
}
