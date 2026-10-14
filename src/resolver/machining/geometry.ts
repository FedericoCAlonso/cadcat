import { type Piece, type Joint, type MachiningConfig } from '../../model';
import { type ResolvedPiece } from '../resolver';
import { determinePieceSpatialSize } from '../spatial3d';

/**
 * Derives spacing intervals along a joint of length L using configurable thresholds.
 * 2 points for <= maxSpanWithoutCenterMm, 3 points for > maxSpanWithoutCenterMm.
 * Short pieces use proportional margins to avoid overlap.
 */
export function calculateJointDrillSpacings(
  contactLengthMm: number,
  endSetbackMm = 50,
  maxSpanWithoutCenterMm = 600,
  shortThresholdMm = 110,
  shortMarginMm = 25,
  minJointLengthMm = 50,
): number[] {
  if (contactLengthMm <= minJointLengthMm) {
    return [Math.round(contactLengthMm / 2)];
  }
  if (contactLengthMm <= shortThresholdMm) {
    const margin = Math.min(shortMarginMm, Math.floor(contactLengthMm / 3));
    return [margin, contactLengthMm - margin];
  }
  if (contactLengthMm <= maxSpanWithoutCenterMm) {
    return [endSetbackMm, contactLengthMm - endSetbackMm];
  }
  return [
    endSetbackMm,
    Math.round(contactLengthMm / 2),
    contactLengthMm - endSetbackMm,
  ];
}

/**
 * Helper to get drill spacings using values from MachiningConfig.
 */
export function calculateDrillSpacingsFromConfig(
  contactLengthMm: number,
  config: MachiningConfig,
): number[] {
  return calculateJointDrillSpacings(
    contactLengthMm,
    config.jointDrillMarginMm ?? 50,
    config.maxSpanWithoutCenterDrillMm ?? 600,
    config.shortPieceThresholdMm ?? 110,
    config.shortPieceMaxMarginMm ?? 25,
    config.minJointLengthMm ?? 50,
  );
}

/**
 * Derives the spatial contact line between two joined pieces:
 * - yContact: contact height on pieceA's local face coordinate
 * - zStart: starting offset on pieceA's local depth coordinate
 * - contactLen: length of contact interface along depth
 */
export function deriveContactGeometry(
  pieceA: Piece | ResolvedPiece,
  pieceB: Piece | ResolvedPiece,
  joint: Joint,
): { yContact: number; zStart: number; contactLen: number } {
  const sizeB = determinePieceSpatialSize(pieceB);

  const posA = 'positionMm' in pieceA && pieceA.positionMm ? pieceA.positionMm : undefined;
  const posB = 'positionMm' in pieceB && pieceB.positionMm ? pieceB.positionMm : undefined;

  let yContact: number;
  let zStart: number;
  let contactLen: number;

  if (posA && posB) {
    // Exact 3D spatial positions from ResolvedPiece
    yContact = Math.round(posB.y - posA.y + sizeB.y / 2);
    zStart = Math.max(0, Math.round(posB.z - posA.z));
    contactLen = Math.round(sizeB.z);
    if (contactLen <= 0) {
      contactLen = Math.round(sizeB.x > 0 ? sizeB.x : 500);
    }
  } else {
    // Fallback derivation based on piece contour points and semantic roles
    const aPoints = pieceA.contour.points;
    const aHeight = Math.abs(aPoints[2]?.y ?? 800);
    const aWidth = Math.abs(aPoints[1]?.x ?? 560);

    const bPoints = pieceB.contour.points;
    const bWidth = Math.abs(bPoints[1]?.x ?? 500);
    const bHeight = Math.abs(bPoints[2]?.y ?? 500);
    contactLen = joint.b.faceId.includes('edge') ? bHeight : bWidth;

    const bRole = pieceB.role.toLowerCase();
    if (bRole.includes('roof') || bRole.includes('top')) {
      yContact = Math.round(aHeight - pieceB.thicknessMm / 2);
      zStart = bRole.includes('rail-back') ? Math.max(0, Math.round(aWidth - contactLen)) : 0;
    } else if (bRole.includes('shelf')) {
      yContact = joint.offsetMm ?? Math.round(aHeight / 2);
      zStart = 0;
    } else {
      yContact = Math.round(pieceB.thicknessMm / 2);
      zStart = 0;
    }
  }

  return { yContact, zStart, contactLen };
}

/**
 * Determines whether a given face identifier maps to Face A, Face B, or an Edge.
 */
export function deriveFaceType(faceId: string): 'face-A' | 'face-B' | 'edge' {
  const lower = faceId.toLowerCase();
  if (lower.includes('edge')) {
    return 'edge';
  }
  if (
    lower === 'face-b' ||
    lower === 'outer' ||
    lower === 'bottom' ||
    lower === 'bottom-face' ||
    lower === 'rear-face' ||
    lower === 'back'
  ) {
    return 'face-B';
  }
  return 'face-A';
}
