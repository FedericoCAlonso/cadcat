import type {
  Rect,
  PlacedPartInstance,
  SheetLayout,
  CutOp,
  Settings,
  SheetType,
} from './types';
import type { PreprocessedPartInstance, MaterialSheetInfo } from './preprocessor';
import { resolveGrain } from './grain';

export interface CNCSheetState {
  sheetIndex: number;
  sheetTypeIndex: number;
  sheetType: SheetType;
  sheetLengthMm: number;
  sheetWidthMm: number;
  usableLengthMm: number;
  usableWidthMm: number;
  freeRects: Rect[];
  placements: PlacedPartInstance[];
}

const EPSILON = 1e-4;

/**
 * Constructor B: MaxRects algorithm for CNC and MANUAL_FREE (Section 6.3).
 * Non-guillotine free placement maintaining a maximal free rectangles set.
 */
export class ConstructorCNC {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  build(
    parts: readonly PreprocessedPartInstance[],
    availableSheets: readonly MaterialSheetInfo[],
    usedSheetCounts: Map<number, number>,
  ): {
    sheets: SheetLayout[];
    unplacedParts: PreprocessedPartInstance[];
  } {
    const sheets: CNCSheetState[] = [];
    const unplacedParts: PreprocessedPartInstance[] = [];
    // CNC kerf default 6mm if not set
    const kerf = this.settings.kerfMm > 0 ? this.settings.kerfMm : 6.0;

    const openSheet = (minRequiredW = 0, minRequiredH = 0): CNCSheetState | null => {
      let bestSheetInfo: MaterialSheetInfo | null = null;
      let minPrice = Infinity;

      for (const info of availableSheets) {
        const currentlyUsed = usedSheetCounts.get(info.sheetIndex) ?? 0;
        if (currentlyUsed >= info.sheetType.available) continue;

        const fitsNormal = minRequiredW <= info.usableLengthMm + EPSILON && minRequiredH <= info.usableWidthMm + EPSILON;
        const fitsRotated = minRequiredH <= info.usableLengthMm + EPSILON && minRequiredW <= info.usableWidthMm + EPSILON;
        if (!fitsNormal && !fitsRotated) continue;

        const price = info.sheetType.pricePerSheet ?? 0;
        if (price < minPrice) {
          minPrice = price;
          bestSheetInfo = info;
        }
      }

      if (!bestSheetInfo) return null;

      const count = usedSheetCounts.get(bestSheetInfo.sheetIndex) ?? 0;
      usedSheetCounts.set(bestSheetInfo.sheetIndex, count + 1);

      const trim = this.settings.trimMm;
      const initialFreeRect: Rect = {
        x: trim.left,
        y: trim.bottom,
        w: bestSheetInfo.usableLengthMm,
        h: bestSheetInfo.usableWidthMm,
      };

      const newState: CNCSheetState = {
        sheetIndex: sheets.length,
        sheetTypeIndex: bestSheetInfo.sheetIndex,
        sheetType: bestSheetInfo.sheetType,
        sheetLengthMm: bestSheetInfo.sheetType.lengthMm,
        sheetWidthMm: bestSheetInfo.sheetType.widthMm,
        usableLengthMm: bestSheetInfo.usableLengthMm,
        usableWidthMm: bestSheetInfo.usableWidthMm,
        freeRects: [initialFreeRect],
        placements: [],
      };

      sheets.push(newState);
      return newState;
    };

    for (const part of parts) {
      let candidate = this.findBestMaxRectCandidate(part, sheets);

      if (!candidate) {
        const newSheet = openSheet(part.cutLengthMm, part.cutWidthMm);
        if (newSheet) {
          candidate = this.findBestMaxRectCandidate(part, [newSheet]);
          if (candidate) {
            candidate.sheetIndex = sheets.length - 1;
          }
        }
      }

      if (!candidate) {
        unplacedParts.push(part);
        continue;
      }

      const sheet = sheets[candidate.sheetIndex]!;
      const px = candidate.x;
      const py = candidate.y;
      const pw = candidate.pw;
      const ph = candidate.ph;

      const placement: PlacedPartInstance = {
        partId: part.partId,
        instance: part.instance,
        x: px,
        y: py,
        w: pw,
        h: ph,
        rotated: candidate.rotated,
        cutLengthMm: part.cutLengthMm,
        cutWidthMm: part.cutWidthMm,
        finishedLengthMm: part.finishedLengthMm,
        finishedWidthMm: part.finishedWidthMm,
        isFiller: part.isFiller,
        grainRelaxed: !candidate.rotated ? false : resolveGrain(part, sheet.sheetType).grainRelaxed,
      };

      sheet.placements.push(placement);

      // Subdivide overlapping free rectangles
      this.splitFreeRectangles(sheet.freeRects, px, py, pw, ph, kerf);
      // Prune redundant contained rectangles
      this.pruneFreeRectangles(sheet.freeRects);
    }

    // Generate output SheetLayouts
    const resultSheets: SheetLayout[] = [];
    const minOffcutMm = this.settings.cost?.minOffcutMm ?? 300;

    for (const sheet of sheets) {
      let wasteAreaMm2 = 0;

      // Pick non-overlapping maximal free rectangles as usable offcuts
      const sortedFr = [...sheet.freeRects].sort((a, b) => b.w * b.h - a.w * a.h);
      const offcuts: Rect[] = [];

      for (const fr of sortedFr) {
        if (fr.w >= minOffcutMm && fr.h >= minOffcutMm) {
          const overlaps = offcuts.some(
            (o) =>
              Math.min(o.x + o.w, fr.x + fr.w) > Math.max(o.x, fr.x) + EPSILON &&
              Math.min(o.y + o.h, fr.y + fr.h) > Math.max(o.y, fr.y) + EPSILON,
          );
          if (!overlaps) {
            offcuts.push(fr);
          }
        }
      }

      const placedArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
      const usableArea = sheet.usableLengthMm * sheet.usableWidthMm;
      const offcutsArea = offcuts.reduce((s, o) => s + o.w * o.h, 0);
      wasteAreaMm2 = Math.max(0, usableArea - placedArea - offcutsArea);

      // CNC Cut length: perimeter of parts, subtracting edges that touch sheet boundary
      let totalCutLengthM = 0;
      const cuts: CutOp[] = [];

      for (const [idx, p] of sheet.placements.entries()) {
        const perimeterM = (2 * (p.w + p.h)) / 1000;
        totalCutLengthM += perimeterM;

        cuts.push({
          order: idx + 1,
          stage: 1,
          dir: 'H',
          pos: p.y,
          from: p.x,
          to: p.x + p.w,
          isTrim: false,
        });
      }

      resultSheets.push({
        sheetTypeIndex: sheet.sheetTypeIndex,
        sheetLengthMm: sheet.sheetLengthMm,
        sheetWidthMm: sheet.sheetWidthMm,
        isOffcut: sheet.sheetType.isOffcut,
        placements: sheet.placements,
        cutSequence: cuts,
        offcuts,
        wasteAreaMm2: Math.round(wasteAreaMm2),
        usedAreaMm2: placedArea,
        passes: cuts.length,
        cutLengthM: Math.round(totalCutLengthM * 100) / 100,
      });
    }

    return {
      sheets: resultSheets,
      unplacedParts,
    };
  }

  private findBestMaxRectCandidate(
    part: PreprocessedPartInstance,
    sheets: CNCSheetState[],
  ): { sheetIndex: number; x: number; y: number; pw: number; ph: number; rotated: boolean } | null {
    let bestFit: {
      sheetIndex: number;
      x: number;
      y: number;
      pw: number;
      ph: number;
      rotated: boolean;
      score1: number;
      score2: number;
    } | null = null;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx]!;
      const grainRes = resolveGrain(part, sheet.sheetType);

      for (const fr of sheet.freeRects) {
        // Try unrotated
        if (part.cutLengthMm <= fr.w + EPSILON && part.cutWidthMm <= fr.h + EPSILON) {
          const s1 = Math.min(fr.w - part.cutLengthMm, fr.h - part.cutWidthMm);
          const s2 = Math.max(fr.w - part.cutLengthMm, fr.h - part.cutWidthMm);

          if (!bestFit || s1 < bestFit.score1 - EPSILON || (Math.abs(s1 - bestFit.score1) <= EPSILON && s2 < bestFit.score2 - EPSILON)) {
            bestFit = {
              sheetIndex: sIdx,
              x: fr.x,
              y: fr.y,
              pw: part.cutLengthMm,
              ph: part.cutWidthMm,
              rotated: false,
              score1: s1,
              score2: s2,
            };
          }
        }

        // Try rotated
        if (grainRes.canRotate) {
          if (part.cutWidthMm <= fr.w + EPSILON && part.cutLengthMm <= fr.h + EPSILON) {
            const s1 = Math.min(fr.w - part.cutWidthMm, fr.h - part.cutLengthMm);
            const s2 = Math.max(fr.w - part.cutWidthMm, fr.h - part.cutLengthMm);

            if (!bestFit || s1 < bestFit.score1 - EPSILON || (Math.abs(s1 - bestFit.score1) <= EPSILON && s2 < bestFit.score2 - EPSILON)) {
              bestFit = {
                sheetIndex: sIdx,
                x: fr.x,
                y: fr.y,
                pw: part.cutWidthMm,
                ph: part.cutLengthMm,
                rotated: true,
                score1: s1,
                score2: s2,
              };
            }
          }
        }
      }
    }

    return bestFit;
  }

  private splitFreeRectangles(
    freeRects: Rect[],
    px: number,
    py: number,
    pw: number,
    ph: number,
    kerf: number,
  ): void {
    const count = freeRects.length;
    for (let i = count - 1; i >= 0; i--) {
      const fr = freeRects[i]!;

      // Check if fr intersects placedWithKerf
      if (
        px < fr.x + fr.w &&
        px + pw + kerf > fr.x &&
        py < fr.y + fr.h &&
        py + ph + kerf > fr.y
      ) {
        // Remove current rectangle
        freeRects.splice(i, 1);

        // Split into up to 4 maximal sub-rectangles:
        // 1. Above
        if (py + ph + kerf < fr.y + fr.h) {
          freeRects.push({
            x: fr.x,
            y: py + ph + kerf,
            w: fr.w,
            h: fr.y + fr.h - (py + ph + kerf),
          });
        }
        // 2. Below
        if (py > fr.y) {
          freeRects.push({
            x: fr.x,
            y: fr.y,
            w: fr.w,
            h: py - fr.y,
          });
        }
        // 3. Left
        if (px > fr.x) {
          freeRects.push({
            x: fr.x,
            y: fr.y,
            w: px - fr.x,
            h: fr.h,
          });
        }
        // 4. Right
        if (px + pw + kerf < fr.x + fr.w) {
          freeRects.push({
            x: px + pw + kerf,
            y: fr.y,
            w: fr.x + fr.w - (px + pw + kerf),
            h: fr.h,
          });
        }
      }
    }
  }

  private pruneFreeRectangles(freeRects: Rect[]): void {
    for (let i = 0; i < freeRects.length; i++) {
      const a = freeRects[i]!;
      for (let j = i + 1; j < freeRects.length; j++) {
        const b = freeRects[j]!;

        // If a is inside b
        if (
          a.x >= b.x - EPSILON &&
          a.y >= b.y - EPSILON &&
          a.x + a.w <= b.x + b.w + EPSILON &&
          a.y + a.h <= b.y + b.h + EPSILON
        ) {
          freeRects.splice(i, 1);
          i--;
          break;
        }

        // If b is inside a
        if (
          b.x >= a.x - EPSILON &&
          b.y >= a.y - EPSILON &&
          b.x + b.w <= a.x + a.w + EPSILON &&
          b.y + b.h <= a.y + a.h + EPSILON
        ) {
          freeRects.splice(j, 1);
          j--;
        }
      }
    }
  }
}
