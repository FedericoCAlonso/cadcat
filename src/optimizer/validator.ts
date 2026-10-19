import type { OptimizerInput, Layout, PlacedPartInstance, Rect } from './types';
import { resolveGrain } from './grain';
import { computeCutSize } from './cutSize';

export interface ValidationFailure {
  checkIndex: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationOutput {
  valid: boolean;
  errors: ValidationFailure[];
}

const EPSILON = 1e-4;

/**
 * Checks if a set of placements inside a bounding box is guillotine separable.
 * Returns { separable: boolean, maxStageDepth: number }.
 */
export function checkGuillotineSeparability(
  placements: readonly PlacedPartInstance[],
  box: Rect,
  kerfMm: number,
  currentStage = 1,
  lastCutDir: 'H' | 'V' | null = null,
): { separable: boolean; maxStageDepth: number } {
  if (placements.length <= 1) {
    return { separable: true, maxStageDepth: currentStage };
  }

  // Find candidate cuts
  // We can try vertical cuts and horizontal cuts.
  // A vertical cut at x with band width kerfMm:
  // splits parts into Left (p.x + p.w <= x + EPSILON) and Right (p.x >= x + kerfMm - EPSILON)
  // No part can cross the band [x, x + kerfMm].

  // Candidate x positions: right edge of any part
  const candidateXs = new Set<number>();
  for (const p of placements) {
    const x = p.x + p.w;
    if (x >= box.x && x + kerfMm <= box.x + box.w) {
      candidateXs.add(Math.round(x * 100) / 100);
    }
  }

  // Candidate y positions: top edge of any part
  const candidateYs = new Set<number>();
  for (const p of placements) {
    const y = p.y + p.h;
    if (y >= box.y && y + kerfMm <= box.y + box.h) {
      candidateYs.add(Math.round(y * 100) / 100);
    }
  }

  // Try cut directions. Prioritize continuing in the same direction or changing
  const tryVertical = (x: number): { separable: boolean; maxStageDepth: number } | null => {
    const left: PlacedPartInstance[] = [];
    const right: PlacedPartInstance[] = [];

    for (const p of placements) {
      if (p.x + p.w <= x + EPSILON) {
        left.push(p);
      } else if (p.x >= x + kerfMm - EPSILON) {
        right.push(p);
      } else {
        // Part crosses the cut line!
        return null;
      }
    }

    if (left.length === 0 || right.length === 0) {
      return null;
    }

    const nextStage = lastCutDir === 'V' ? currentStage : currentStage + (lastCutDir === null ? 0 : 1);
    const boxLeft: Rect = { x: box.x, y: box.y, w: x - box.x, h: box.h };
    const boxRight: Rect = { x: x + kerfMm, y: box.y, w: box.x + box.w - (x + kerfMm), h: box.h };

    const resLeft = checkGuillotineSeparability(left, boxLeft, kerfMm, nextStage, 'V');
    if (!resLeft.separable) return null;

    const resRight = checkGuillotineSeparability(right, boxRight, kerfMm, nextStage, 'V');
    if (!resRight.separable) return null;

    return {
      separable: true,
      maxStageDepth: Math.max(resLeft.maxStageDepth, resRight.maxStageDepth),
    };
  };

  const tryHorizontal = (y: number): { separable: boolean; maxStageDepth: number } | null => {
    const bottom: PlacedPartInstance[] = [];
    const top: PlacedPartInstance[] = [];

    for (const p of placements) {
      if (p.y + p.h <= y + EPSILON) {
        bottom.push(p);
      } else if (p.y >= y + kerfMm - EPSILON) {
        top.push(p);
      } else {
        // Part crosses the cut line!
        return null;
      }
    }

    if (bottom.length === 0 || top.length === 0) {
      return null;
    }

    const nextStage = lastCutDir === 'H' ? currentStage : currentStage + (lastCutDir === null ? 0 : 1);
    const boxBottom: Rect = { x: box.x, y: box.y, w: box.w, h: y - box.y };
    const boxTop: Rect = { x: box.x, y: y + kerfMm, w: box.w, h: box.y + box.h - (y + kerfMm) };

    const resBottom = checkGuillotineSeparability(bottom, boxBottom, kerfMm, nextStage, 'H');
    if (!resBottom.separable) return null;

    const resTop = checkGuillotineSeparability(top, boxTop, kerfMm, nextStage, 'H');
    if (!resTop.separable) return null;

    return {
      separable: true,
      maxStageDepth: Math.max(resBottom.maxStageDepth, resTop.maxStageDepth),
    };
  };

  // If we had a last cut direction, prefer continuing along it first
  if (lastCutDir === 'V') {
    for (const x of candidateXs) {
      const res = tryVertical(x);
      if (res) return res;
    }
    for (const y of candidateYs) {
      const res = tryHorizontal(y);
      if (res) return res;
    }
  } else {
    for (const y of candidateYs) {
      const res = tryHorizontal(y);
      if (res) return res;
    }
    for (const x of candidateXs) {
      const res = tryVertical(x);
      if (res) return res;
    }
  }

  return { separable: false, maxStageDepth: currentStage };
}

/**
 * Independent Validator (Section 8.1):
 * Must not import any code from the constructors.
 * Evaluates the 10 checks mandated by Section 8.1.
 */
export function validateLayout(input: OptimizerInput, layout: Layout): ValidationOutput {
  const errors: ValidationFailure[] = [];

  const partsMap = new Map(input.parts.map((p) => [p.id, p]));
  const unplacedFillerSet = new Set(layout.metrics?.unplacedFillers ?? []);

  // -------------------------------------------------------------
  // Check 1: Every part instance appears exactly once or is unplaced
  // -------------------------------------------------------------
  const instanceSeen = new Map<string, Set<number>>();
  for (const [sheetIdx, sheet] of layout.sheets.entries()) {
    for (const placement of sheet.placements) {
      const key = placement.partId;
      if (!partsMap.has(key)) {
        errors.push({
          checkIndex: 1,
          code: 'UNKNOWN_PART_PLACED',
          message: `Sheet ${sheetIdx} has placed part '${key}' which is not in input.parts`,
          details: { partId: key, sheetIdx },
        });
        continue;
      }
      if (!instanceSeen.has(key)) {
        instanceSeen.set(key, new Set());
      }
      const set = instanceSeen.get(key)!;
      if (set.has(placement.instance)) {
        errors.push({
          checkIndex: 1,
          code: 'DUPLICATE_INSTANCE_PLACED',
          message: `Part '${key}' instance ${placement.instance} placed multiple times`,
          details: { partId: key, instance: placement.instance },
        });
      }
      set.add(placement.instance);
    }
  }

  for (const part of input.parts) {
    const seen = instanceSeen.get(part.id) ?? new Set();
    const isUnplacedFiller = part.isFiller && unplacedFillerSet.has(part.id);

    if (isUnplacedFiller) {
      if (seen.size > 0) {
        errors.push({
          checkIndex: 1,
          code: 'FILLER_PLACED_AND_MARKED_UNPLACED',
          message: `Filler part '${part.id}' is both placed and listed in unplacedFillers`,
          details: { partId: part.id },
        });
      }
      continue;
    }

    if (seen.size !== part.quantity) {
      // If some instances are missing
      errors.push({
        checkIndex: 1,
        code: 'PART_INSTANCE_COUNT_MISMATCH',
        message: `Part '${part.id}' expects quantity ${part.quantity}, but found ${seen.size} placements`,
        details: { partId: part.id, expected: part.quantity, actual: seen.size },
      });
    }
  }

  // -------------------------------------------------------------
  // Check 6: Used sheets do not exceed available
  // -------------------------------------------------------------
  const usedCountByType = new Map<number, number>();
  for (const sheet of layout.sheets) {
    const idx = sheet.sheetTypeIndex;
    usedCountByType.set(idx, (usedCountByType.get(idx) ?? 0) + 1);
  }

  for (const [sheetIdx, count] of usedCountByType.entries()) {
    const sheetType = input.sheets[sheetIdx];
    if (!sheetType) {
      errors.push({
        checkIndex: 6,
        code: 'INVALID_SHEET_TYPE_INDEX',
        message: `Layout references non-existent sheetTypeIndex ${sheetIdx}`,
        details: { sheetTypeIndex: sheetIdx },
      });
    } else if (count > sheetType.available) {
      errors.push({
        checkIndex: 6,
        code: 'SHEET_AVAILABILITY_EXCEEDED',
        message: `Used ${count} sheets of type ${sheetIdx}, but only ${sheetType.available} are available`,
        details: { sheetTypeIndex: sheetIdx, used: count, available: sheetType.available },
      });
    }
  }

  // Iterate each sheet layout for checks 2, 3, 4, 5, 7, 8, 9, 10
  const trim = input.settings.trimMm;
  const kerf = input.settings.kerfMm;

  for (const [sIdx, sheet] of layout.sheets.entries()) {
    const sheetType = input.sheets[sheet.sheetTypeIndex];
    if (!sheetType) continue;

    const sheetLength = sheet.sheetLengthMm;
    const sheetWidth = sheet.sheetWidthMm;
    const usableMinX = trim.left;
    const usableMaxX = sheetLength - trim.right;
    const usableMinY = trim.bottom;
    const usableMaxY = sheetWidth - trim.top;

    // Check 2: Usable area bounds
    for (const p of sheet.placements) {
      if (
        p.x < usableMinX - EPSILON ||
        p.y < usableMinY - EPSILON ||
        p.x + p.w > usableMaxX + EPSILON ||
        p.y + p.h > usableMaxY + EPSILON
      ) {
        errors.push({
          checkIndex: 2,
          code: 'OUT_OF_USABLE_BOUNDS',
          message: `Placement of part '${p.partId}' (${p.x}, ${p.y}, ${p.w}, ${p.h}) exceeds usable area [${usableMinX}, ${usableMinY}, ${usableMaxX}, ${usableMaxY}] on sheet ${sIdx}`,
          details: { partId: p.partId, placement: p, sheetIdx: sIdx },
        });
      }
    }

    // Check 3: Non-overlap and kerf separation
    for (let i = 0; i < sheet.placements.length; i++) {
      const a = sheet.placements[i]!;
      for (let j = i + 1; j < sheet.placements.length; j++) {
        const b = sheet.placements[j]!;

        const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        if (xOverlap > EPSILON && yOverlap > EPSILON) {
          errors.push({
            checkIndex: 3,
            code: 'PARTS_OVERLAP',
            message: `Parts '${a.partId}' (#${a.instance}) and '${b.partId}' (#${b.instance}) overlap on sheet ${sIdx}`,
            details: { partA: a, partB: b, sheetIdx: sIdx, xOverlap, yOverlap },
          });
        } else if (kerf > 0) {
          // Kerf distance violation
          if (xOverlap > EPSILON && -yOverlap < kerf - EPSILON) {
            errors.push({
              checkIndex: 3,
              code: 'KERF_VIOLATION_Y',
              message: `Parts '${a.partId}' and '${b.partId}' have insufficient kerf gap in Y: ${-yOverlap.toFixed(2)}mm < ${kerf}mm`,
              details: { partA: a, partB: b, gap: -yOverlap, kerf },
            });
          }
          if (yOverlap > EPSILON && -xOverlap < kerf - EPSILON) {
            errors.push({
              checkIndex: 3,
              code: 'KERF_VIOLATION_X',
              message: `Parts '${a.partId}' and '${b.partId}' have insufficient kerf gap in X: ${-xOverlap.toFixed(2)}mm < ${kerf}mm`,
              details: { partA: a, partB: b, gap: -xOverlap, kerf },
            });
          }
        }
      }
    }

    // Check 4 & 5: Grain rule compliance and cut size accuracy
    for (const p of sheet.placements) {
      const part = partsMap.get(p.partId);
      if (!part) continue;

      const expectedCut = computeCutSize(part, input.settings.dimensionsAreFinished);
      const grainRes = resolveGrain(part, sheetType);

      if (!grainRes.canRotate && p.rotated) {
        errors.push({
          checkIndex: 4,
          code: 'GRAIN_RULE_VIOLATION',
          message: `Part '${part.id}' is rotated but grain rule forbids rotation on sheet ${sIdx}`,
          details: { partId: part.id, grain: part.grain, sheetGrain: sheetType.grain },
        });
      }

      const expectedW = p.rotated ? expectedCut.cutWidthMm : expectedCut.cutLengthMm;
      const expectedH = p.rotated ? expectedCut.cutLengthMm : expectedCut.cutWidthMm;

      if (Math.abs(p.w - expectedW) > EPSILON || Math.abs(p.h - expectedH) > EPSILON) {
        errors.push({
          checkIndex: 5,
          code: 'CUT_SIZE_MISMATCH',
          message: `Part '${part.id}' placement size [${p.w}x${p.h}] does not match expected cut size [${expectedW}x${expectedH}]`,
          details: { partId: part.id, actual: { w: p.w, h: p.h }, expected: { w: expectedW, h: expectedH } },
        });
      }
    }

    // Check 7 & 8: Guillotine separability and maxStages (for PANEL_SAW)
    if (input.settings.machine === 'PANEL_SAW') {
      const usableBox: Rect = {
        x: usableMinX,
        y: usableMinY,
        w: usableMaxX - usableMinX,
        h: usableMaxY - usableMinY,
      };

      const sepRes = checkGuillotineSeparability(sheet.placements, usableBox, kerf);
      if (!sepRes.separable) {
        errors.push({
          checkIndex: 7,
          code: 'NOT_GUILLOTINE_SEPARABLE',
          message: `Layout on sheet ${sIdx} cannot be fully separated by recursive guillotine cuts`,
          details: { sheetIdx: sIdx },
        });
      } else if (input.settings.maxStages > 0 && sepRes.maxStageDepth > input.settings.maxStages) {
        errors.push({
          checkIndex: 8,
          code: 'MAX_STAGES_EXCEEDED',
          message: `Layout cut depth (${sepRes.maxStageDepth}) exceeds maxStages (${input.settings.maxStages}) on sheet ${sIdx}`,
          details: { sheetIdx: sIdx, depth: sepRes.maxStageDepth, maxStages: input.settings.maxStages },
        });
      }
    }

    // Check 9: Cut sequence simulation
    if (sheet.cutSequence && sheet.cutSequence.length > 0) {
      // Simulate cut sequence from sheet boundaries
      // Count charged passes
      const chargedPasses = sheet.cutSequence.filter(
        (c) => !c.isTrim || input.settings.trimCutsAreCharged,
      ).length;

      if (sheet.passes !== undefined && sheet.passes !== chargedPasses) {
        errors.push({
          checkIndex: 9,
          code: 'PASSES_COUNT_MISMATCH',
          message: `Sheet ${sIdx} metrics passes (${sheet.passes}) does not match charged cuts count (${chargedPasses})`,
          details: { sheetIdx: sIdx, passes: sheet.passes, chargedPasses },
        });
      }
    }

    // Check 10: Area balance
    // Placed area + offcuts area + waste area + kerf area = usable sheet area
    const placedArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    const offcutsArea = (sheet.offcuts ?? []).reduce((sum, o) => sum + o.w * o.h, 0);
    const kerfArea = (sheet.cutSequence ?? [])
      .filter((c) => !c.isTrim)
      .reduce((sum, c) => sum + Math.abs(c.to - c.from) * kerf, 0);

    if (sheet.wasteAreaMm2 !== undefined && sheet.usedAreaMm2 !== undefined) {
      const recordedUsableTotal = placedArea + offcutsArea + sheet.wasteAreaMm2 + kerfArea;
      const usableArea = (usableMaxX - usableMinX) * (usableMaxY - usableMinY);
      if (Math.abs(recordedUsableTotal - usableArea) > usableArea * 0.05 + 1000) {
        errors.push({
          checkIndex: 10,
          code: 'AREA_BALANCE_ERROR',
          message: `Sheet ${sIdx} area balance discrepancy: placed (${placedArea}) + offcuts (${offcutsArea}) + waste (${sheet.wasteAreaMm2}) + kerf (${kerfArea}) != usable (${usableArea})`,
          details: { sheetIdx: sIdx, placedArea, offcutsArea, wasteArea: sheet.wasteAreaMm2, kerfArea, usableArea },
        });
      }
    }
  }

  // Layout level metrics checks
  if (layout.metrics) {
    if (layout.metrics.sheetsUsed !== layout.sheets.length) {
      errors.push({
        checkIndex: 10,
        code: 'METRICS_SHEETS_USED_MISMATCH',
        message: `Layout metrics sheetsUsed (${layout.metrics.sheetsUsed}) does not match actual sheets count (${layout.sheets.length})`,
        details: { reported: layout.metrics.sheetsUsed, actual: layout.sheets.length },
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
