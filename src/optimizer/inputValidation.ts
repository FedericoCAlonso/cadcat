import type { OptimizerInput, ErrorItem, Warning } from './types';

export interface InputValidationResult {
  valid: boolean;
  errors: ErrorItem[];
  warnings: Warning[];
}

function isInvalidNumber(val: unknown, allowZero = false): boolean {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
    return true;
  }
  return allowZero ? val < 0 : val <= 0;
}

/**
 * Validates the raw input object according to Section 8.6:
 * - Checks for null/missing objects.
 * - Detects NaN, negative, or invalid numbers with field names.
 * - Detects duplicate part IDs.
 * - Validates sheets, settings, and edge bands.
 */
export function validateInput(input: OptimizerInput): InputValidationResult {
  const errors: ErrorItem[] = [];
  const warnings: Warning[] = [];

  if (!input || typeof input !== 'object') {
    errors.push({
      code: 'INVALID_INPUT',
      messageKey: 'optimizer.error.invalidInput',
      details: { field: 'input' },
    });
    return { valid: false, errors, warnings };
  }

  // 1. Validate parts
  if (!Array.isArray(input.parts)) {
    errors.push({
      code: 'INVALID_PARTS_LIST',
      messageKey: 'optimizer.error.invalidPartsList',
      details: { field: 'parts' },
    });
  } else {
    const seenIds = new Set<string>();

    for (const [index, part] of input.parts.entries()) {
      if (!part || typeof part !== 'object') {
        errors.push({
          code: 'INVALID_PART',
          messageKey: 'optimizer.error.invalidPart',
          details: { index },
        });
        continue;
      }

      // Check part ID
      if (typeof part.id !== 'string' || part.id.trim() === '') {
        errors.push({
          code: 'MISSING_PART_ID',
          messageKey: 'optimizer.error.missingPartId',
          details: { index, field: 'parts.id' },
        });
      } else {
        if (seenIds.has(part.id)) {
          errors.push({
            code: 'DUPLICATE_PART_ID',
            messageKey: 'optimizer.error.duplicatePartId',
            partId: part.id,
            details: { partId: part.id },
          });
        }
        seenIds.add(part.id);
      }

      // Check lengthMm and widthMm
      if (isInvalidNumber(part.lengthMm)) {
        errors.push({
          code: 'INVALID_DIMENSION',
          messageKey: 'optimizer.error.invalidDimension',
          partId: part.id,
          details: { field: 'lengthMm', value: part.lengthMm },
        });
      }
      if (isInvalidNumber(part.widthMm)) {
        errors.push({
          code: 'INVALID_DIMENSION',
          messageKey: 'optimizer.error.invalidDimension',
          partId: part.id,
          details: { field: 'widthMm', value: part.widthMm },
        });
      }

      // Check quantity
      if (typeof part.quantity !== 'number' || Number.isNaN(part.quantity) || part.quantity < 0 || !Number.isInteger(part.quantity)) {
        errors.push({
          code: 'INVALID_QUANTITY',
          messageKey: 'optimizer.error.invalidQuantity',
          partId: part.id,
          details: { field: 'quantity', value: part.quantity },
        });
      } else if (part.quantity === 0) {
        warnings.push({
          code: 'ZERO_QUANTITY_PART',
          messageKey: 'optimizer.warning.zeroQuantity',
          partId: part.id,
          details: { partId: part.id },
        });
      }

      // Check grain
      if (part.grain !== 'FREE' && part.grain !== 'FIXED' && part.grain !== 'AUTO') {
        errors.push({
          code: 'INVALID_GRAIN_MODE',
          messageKey: 'optimizer.error.invalidGrainMode',
          partId: part.id,
          details: { field: 'grain', value: part.grain },
        });
      }

      // Check materialKey
      if (typeof part.materialKey !== 'string' || part.materialKey.trim() === '') {
        errors.push({
          code: 'MISSING_MATERIAL_KEY',
          messageKey: 'optimizer.error.missingMaterialKey',
          partId: part.id,
          details: { field: 'materialKey' },
        });
      }

      // Check edge bands if present
      if (part.edges) {
        const edgeKeys = ['l1', 'l2', 'w1', 'w2'] as const;
        for (const ek of edgeKeys) {
          const edge = part.edges[ek];
          if (edge) {
            if (isInvalidNumber(edge.thicknessMm, true)) {
              errors.push({
                code: 'INVALID_EDGE_THICKNESS',
                messageKey: 'optimizer.error.invalidEdgeThickness',
                partId: part.id,
                details: { edge: ek, field: `edges.${ek}.thicknessMm`, value: edge.thicknessMm },
              });
            }
          }
        }
      }
    }
  }

  // 2. Validate sheets
  if (!Array.isArray(input.sheets)) {
    errors.push({
      code: 'INVALID_SHEETS_LIST',
      messageKey: 'optimizer.error.invalidSheetsList',
      details: { field: 'sheets' },
    });
  } else {
    for (const [index, sheet] of input.sheets.entries()) {
      if (!sheet || typeof sheet !== 'object') {
        errors.push({
          code: 'INVALID_SHEET',
          messageKey: 'optimizer.error.invalidSheet',
          details: { index },
        });
        continue;
      }

      if (typeof sheet.materialKey !== 'string' || sheet.materialKey.trim() === '') {
        errors.push({
          code: 'MISSING_SHEET_MATERIAL_KEY',
          messageKey: 'optimizer.error.missingSheetMaterialKey',
          details: { index, field: 'sheets.materialKey' },
        });
      }

      if (isInvalidNumber(sheet.lengthMm)) {
        errors.push({
          code: 'INVALID_SHEET_DIMENSION',
          messageKey: 'optimizer.error.invalidSheetDimension',
          details: { index, field: 'sheets.lengthMm', value: sheet.lengthMm },
        });
      }
      if (isInvalidNumber(sheet.widthMm)) {
        errors.push({
          code: 'INVALID_SHEET_DIMENSION',
          messageKey: 'optimizer.error.invalidSheetDimension',
          details: { index, field: 'sheets.widthMm', value: sheet.widthMm },
        });
      }

      if (typeof sheet.available !== 'number' || Number.isNaN(sheet.available) || sheet.available < 0) {
        errors.push({
          code: 'INVALID_SHEET_AVAILABILITY',
          messageKey: 'optimizer.error.invalidSheetAvailability',
          details: { index, field: 'sheets.available', value: sheet.available },
        });
      }

      if (sheet.grain !== 'NONE' && sheet.grain !== 'ALONG_LENGTH') {
        errors.push({
          code: 'INVALID_SHEET_GRAIN',
          messageKey: 'optimizer.error.invalidSheetGrain',
          details: { index, field: 'sheets.grain', value: sheet.grain },
        });
      }

      if (isInvalidNumber(sheet.pricePerSheet, true)) {
        errors.push({
          code: 'INVALID_SHEET_PRICE',
          messageKey: 'optimizer.error.invalidSheetPrice',
          details: { index, field: 'sheets.pricePerSheet', value: sheet.pricePerSheet },
        });
      }
    }
  }

  // 3. Validate settings
  const settings = input.settings;
  if (!settings || typeof settings !== 'object') {
    errors.push({
      code: 'MISSING_SETTINGS',
      messageKey: 'optimizer.error.missingSettings',
      details: { field: 'settings' },
    });
  } else {
    if (isInvalidNumber(settings.kerfMm, true)) {
      errors.push({
        code: 'INVALID_SETTING',
        messageKey: 'optimizer.error.invalidSetting',
        details: { field: 'settings.kerfMm', value: settings.kerfMm },
      });
    }

    if (!settings.trimMm || typeof settings.trimMm !== 'object') {
      errors.push({
        code: 'INVALID_SETTING',
        messageKey: 'optimizer.error.invalidSetting',
        details: { field: 'settings.trimMm' },
      });
    } else {
      const trimSides = ['top', 'bottom', 'left', 'right'] as const;
      for (const side of trimSides) {
        if (isInvalidNumber(settings.trimMm[side], true)) {
          errors.push({
            code: 'INVALID_SETTING',
            messageKey: 'optimizer.error.invalidSetting',
            details: { field: `settings.trimMm.${side}`, value: settings.trimMm[side] },
          });
        }
      }
    }

    if (isInvalidNumber(settings.minStripMm, true)) {
      errors.push({
        code: 'INVALID_SETTING',
        messageKey: 'optimizer.error.invalidSetting',
        details: { field: 'settings.minStripMm', value: settings.minStripMm },
      });
    }
    if (isInvalidNumber(settings.minPartMm, true)) {
      errors.push({
        code: 'INVALID_SETTING',
        messageKey: 'optimizer.error.invalidSetting',
        details: { field: 'settings.minPartMm', value: settings.minPartMm },
      });
    }

    if (settings.cost) {
      const costFields = ['pricePerCut', 'includedCuts', 'minimumCharge', 'pricePerMeterCut', 'offcutCreditPerM2', 'minOffcutMm'] as const;
      for (const cf of costFields) {
        if (isInvalidNumber(settings.cost[cf], true)) {
          errors.push({
            code: 'INVALID_COST_SETTING',
            messageKey: 'optimizer.error.invalidCostSetting',
            details: { field: `settings.cost.${cf}`, value: settings.cost[cf] },
          });
        }
      }
    }

    if (settings.search) {
      if (isInvalidNumber(settings.search.timeBudgetMs, true)) {
        errors.push({
          code: 'INVALID_SEARCH_SETTING',
          messageKey: 'optimizer.error.invalidSearchSetting',
          details: { field: 'settings.search.timeBudgetMs', value: settings.search.timeBudgetMs },
        });
      }
      if (isInvalidNumber(settings.search.maxIterations, true)) {
        errors.push({
          code: 'INVALID_SEARCH_SETTING',
          messageKey: 'optimizer.error.invalidSearchSetting',
          details: { field: 'settings.search.maxIterations', value: settings.search.maxIterations },
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
