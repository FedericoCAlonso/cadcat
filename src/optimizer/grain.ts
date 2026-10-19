import type { Part, SheetType } from './types';

export interface ResolvedGrainResult {
  canRotate: boolean;
  grainRelaxed: boolean;
}

/**
 * Resolves the rotation rule for a given part on a given sheet according to Section 5.3:
 *
 * | Sheet grain   | Part grain | Visible         | Rotation allowed |
 * |---------------|------------|-----------------|------------------|
 * | NONE          | any        | any             | yes              |
 * | ALONG_LENGTH  | FREE       | any             | yes              |
 * | ALONG_LENGTH  | FIXED      | any             | no               |
 * | ALONG_LENGTH  | AUTO       | true or unknown | no               |
 * | ALONG_LENGTH  | AUTO       | false           | yes (relaxed)    |
 */
export function resolveGrain(part: Pick<Part, 'grain' | 'visible'>, sheet: Pick<SheetType, 'grain'>): ResolvedGrainResult {
  if (sheet.grain === 'NONE') {
    return { canRotate: true, grainRelaxed: false };
  }

  // sheet.grain === 'ALONG_LENGTH'
  switch (part.grain) {
    case 'FREE':
      return { canRotate: true, grainRelaxed: false };
    case 'FIXED':
      return { canRotate: false, grainRelaxed: false };
    case 'AUTO': {
      const isVisible = part.visible !== false; // default true if undefined
      if (!isVisible) {
        return { canRotate: true, grainRelaxed: true };
      }
      return { canRotate: false, grainRelaxed: false };
    }
    default:
      return { canRotate: true, grainRelaxed: false };
  }
}
