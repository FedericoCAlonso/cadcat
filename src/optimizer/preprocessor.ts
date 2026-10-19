import type { OptimizerInput, Part, SheetType, ErrorItem, Warning, GrainMode } from './types';
import { resolveGrain } from './grain';
import { computeCutSize } from './cutSize';

export interface PreprocessedPartInstance {
  partId: string;
  instance: number;
  cutLengthMm: number;
  cutWidthMm: number;
  finishedLengthMm: number;
  finishedWidthMm: number;
  materialKey: string;
  grain: GrainMode;
  visible?: boolean;
  isFiller: boolean;
  fillerMinCount: number;
  group?: string;
  label?: string;
  areaMm2: number;
}

export interface MaterialSheetInfo {
  sheetType: SheetType;
  sheetIndex: number;
  usableLengthMm: number;
  usableWidthMm: number;
}

export interface MaterialGroup {
  materialKey: string;
  normalInstances: PreprocessedPartInstance[];
  fillerInstances: PreprocessedPartInstance[];
  sheets: MaterialSheetInfo[];
}

export interface PreprocessedData {
  groups: MaterialGroup[];
  infeasiblePartIds: Set<string>;
  errors: ErrorItem[];
  warnings: Warning[];
}

/**
 * Preprocesses optimizer input:
 * 1. Groups by materialKey.
 * 2. Deducts edge bands to obtain cut size.
 * 3. Checks feasibility (PART_TOO_LARGE, PART_TOO_LARGE_GRAIN_LOCKED, PART_BELOW_MIN, STRIP_BELOW_MIN).
 * 4. Expands valid parts into individual instances.
 */
export function preprocess(input: OptimizerInput): PreprocessedData {
  const errors: ErrorItem[] = [];
  const warnings: Warning[] = [];
  const infeasiblePartIds = new Set<string>();

  const trim = input.settings.trimMm;
  const minPartMm = input.settings.minPartMm ?? 0;
  const minStripMm = input.settings.minStripMm ?? 0;

  // Group sheets by materialKey
  const sheetsByMaterial = new Map<string, MaterialSheetInfo[]>();
  for (const [index, sheet] of input.sheets.entries()) {
    const usableLength = sheet.lengthMm - trim.left - trim.right;
    const usableWidth = sheet.widthMm - trim.bottom - trim.top;

    const list = sheetsByMaterial.get(sheet.materialKey) ?? [];
    list.push({
      sheetType: sheet,
      sheetIndex: index,
      usableLengthMm: Math.max(0, usableLength),
      usableWidthMm: Math.max(0, usableWidth),
    });
    sheetsByMaterial.set(sheet.materialKey, list);
  }

  // Group parts by materialKey
  const partsByMaterial = new Map<string, Part[]>();
  for (const part of input.parts) {
    if (part.quantity <= 0) continue;
    const list = partsByMaterial.get(part.materialKey) ?? [];
    list.push(part);
    partsByMaterial.set(part.materialKey, list);
  }

  const groups: MaterialGroup[] = [];

  for (const [materialKey, parts] of partsByMaterial.entries()) {
    const availableSheets = sheetsByMaterial.get(materialKey) ?? [];

    if (availableSheets.length === 0) {
      for (const p of parts) {
        errors.push({
          code: 'NO_SHEET_FOR_MATERIAL',
          messageKey: 'optimizer.error.noSheetForMaterial',
          partId: p.id,
          details: { materialKey },
        });
        infeasiblePartIds.add(p.id);
      }
      continue;
    }

    const normalInstances: PreprocessedPartInstance[] = [];
    const fillerInstances: PreprocessedPartInstance[] = [];

    for (const part of parts) {
      const cutSize = computeCutSize(part, input.settings.dimensionsAreFinished);
      const { cutLengthMm, cutWidthMm, finishedLengthMm, finishedWidthMm } = cutSize;

      // 1. Check minimum part size
      if (cutLengthMm < minPartMm || cutWidthMm < minPartMm) {
        errors.push({
          code: 'PART_BELOW_MIN',
          messageKey: 'optimizer.error.partBelowMin',
          partId: part.id,
          details: { cutLengthMm, cutWidthMm, minPartMm },
        });
        infeasiblePartIds.add(part.id);
        continue;
      }

      // 2. Check minimum strip size
      if (cutLengthMm < minStripMm || cutWidthMm < minStripMm) {
        errors.push({
          code: 'STRIP_BELOW_MIN',
          messageKey: 'optimizer.error.stripBelowMin',
          partId: part.id,
          details: { cutLengthMm, cutWidthMm, minStripMm },
        });
        infeasiblePartIds.add(part.id);
        continue;
      }

      // 3. Check fit across available sheets
      let fitsAtLeastOneSheet = false;
      let grainLockedFitFound = false;

      for (const s of availableSheets) {
        const fitsUnrotated = cutLengthMm <= s.usableLengthMm && cutWidthMm <= s.usableWidthMm;
        const fitsRotated = cutWidthMm <= s.usableLengthMm && cutLengthMm <= s.usableWidthMm;

        const grainRes = resolveGrain(part, s.sheetType);

        if (fitsUnrotated) {
          fitsAtLeastOneSheet = true;
          break;
        } else if (fitsRotated) {
          if (grainRes.canRotate) {
            fitsAtLeastOneSheet = true;
            break;
          } else {
            grainLockedFitFound = true;
          }
        }
      }

      if (!fitsAtLeastOneSheet) {
        if (grainLockedFitFound) {
          errors.push({
            code: 'PART_TOO_LARGE_GRAIN_LOCKED',
            messageKey: 'optimizer.error.partTooLargeGrainLocked',
            partId: part.id,
            details: { cutLengthMm, cutWidthMm },
          });
        } else {
          errors.push({
            code: 'PART_TOO_LARGE',
            messageKey: 'optimizer.error.partTooLarge',
            partId: part.id,
            details: { cutLengthMm, cutWidthMm },
          });
        }
        infeasiblePartIds.add(part.id);
        continue;
      }

      // Expand into instances
      const areaMm2 = cutLengthMm * cutWidthMm;
      for (let i = 0; i < part.quantity; i++) {
        const instance: PreprocessedPartInstance = {
          partId: part.id,
          instance: i,
          cutLengthMm,
          cutWidthMm,
          finishedLengthMm,
          finishedWidthMm,
          materialKey: part.materialKey,
          grain: part.grain,
          visible: part.visible,
          isFiller: Boolean(part.isFiller),
          fillerMinCount: part.fillerMinCount ?? 0,
          group: part.group,
          label: part.label,
          areaMm2,
        };

        if (instance.isFiller) {
          fillerInstances.push(instance);
        } else {
          normalInstances.push(instance);
        }
      }
    }

    groups.push({
      materialKey,
      normalInstances,
      fillerInstances,
      sheets: availableSheets,
    });
  }

  return {
    groups,
    infeasiblePartIds,
    errors,
    warnings,
  };
}
