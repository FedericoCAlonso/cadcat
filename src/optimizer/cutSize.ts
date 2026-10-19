import type { Part } from './types';

export interface PartCutSize {
  cutLengthMm: number;
  cutWidthMm: number;
  finishedLengthMm: number;
  finishedWidthMm: number;
}

/**
 * Computes cut size from finished size and edge band thickness according to Section 5.2:
 * If dimensionsAreFinished is true:
 *   cutLength = lengthMm - (l1.thickness + l2.thickness)
 *   cutWidth = widthMm - (w1.thickness + w2.thickness)
 * If false:
 *   cut size = given size.
 */
export function computeCutSize(part: Part, dimensionsAreFinished: boolean): PartCutSize {
  const finishedLengthMm = part.lengthMm;
  const finishedWidthMm = part.widthMm;

  if (!dimensionsAreFinished) {
    return {
      cutLengthMm: finishedLengthMm,
      cutWidthMm: finishedWidthMm,
      finishedLengthMm,
      finishedWidthMm,
    };
  }

  const l1 = part.edges?.l1?.thicknessMm ?? 0;
  const l2 = part.edges?.l2?.thicknessMm ?? 0;
  const w1 = part.edges?.w1?.thicknessMm ?? 0;
  const w2 = part.edges?.w2?.thicknessMm ?? 0;

  const cutLengthMm = Math.round((finishedLengthMm - l1 - l2) * 10) / 10;
  const cutWidthMm = Math.round((finishedWidthMm - w1 - w2) * 10) / 10;

  return {
    cutLengthMm,
    cutWidthMm,
    finishedLengthMm,
    finishedWidthMm,
  };
}
