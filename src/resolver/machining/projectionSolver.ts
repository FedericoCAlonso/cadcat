import type { Piece } from '../../model';
import type { SpatialPieceBox } from '../spatial3d';
import type { PieceContactProjection } from './snapTypes';

/**
 * Translates piece role to friendly Argentine Spanish workshop terminology.
 */
function translateRoleToLabel(role: string, id: string): string {
  const r = role.toLowerCase();
  if (r.includes('shelf')) {
    const numMatch = id.match(/\d+/);
    return numMatch ? `Estante ${numMatch[0]}` : 'Estante';
  }
  if (r === 'bottom') return 'Piso inferior';
  if (r === 'roof' || r === 'top') return 'Techo / Tapa superior';
  if (r.includes('rail-front')) return 'Faja frontal';
  if (r.includes('rail-back')) return 'Faja trasera';
  if (r.includes('hanging-rail')) return 'Riel de colgado';
  if (r.includes('brace-middle')) return 'Refuerzo central';
  if (r.includes('plinth')) return 'Zócalo';
  if (r.includes('partition')) return 'Parante vertical';
  if (r.includes('transom')) return 'Travesaño';
  if (r.includes('side-left')) return 'Lateral izquierdo';
  if (r.includes('side-right')) return 'Lateral derecho';
  if (r.includes('back')) return 'Fondo posterior';
  return role;
}

/**
 * Calculates 2D contact footprint projections of other pieces touching the target piece.
 * Identifies the touching face (Face A or Face B), dimensions, and centerline (T/2).
 */
export function calculatePieceContactProjections(
  targetPieceId: string,
  _targetPiece: Piece | undefined,
  boxes: SpatialPieceBox[],
  toleranceMm = 1.5,
): PieceContactProjection[] {
  const targetBox = boxes.find((b) => b.pieceId === targetPieceId);
  if (!targetBox) return [];

  const projections: PieceContactProjection[] = [];

  // Determine normal axis (thickness axis) of target piece
  const { x: sx, y: sy, z: sz } = targetBox.sizeMm;
  let normal: 'x' | 'y' | 'z' = 'x';
  let uAxis: 'x' | 'y' | 'z' = 'z';
  let vAxis: 'x' | 'y' | 'z' = 'y';

  if (sx <= sy && sx <= sz) {
    // Standing in YZ plane (vertical side / partition)
    normal = 'x';
    uAxis = 'z'; // Horizontal in piece contour is depth along Z
    vAxis = 'y'; // Vertical in piece contour is height along Y
  } else if (sy <= sx && sy <= sz) {
    // Lying in XZ plane (shelf / bottom / roof)
    normal = 'y';
    uAxis = 'x'; // Horizontal in contour is width along X
    vAxis = 'z'; // Vertical in contour is depth along Z
  } else {
    // Standing in XY plane (doors, back panel, plinth)
    normal = 'z';
    uAxis = 'x'; // Width along X
    vAxis = 'y'; // Height along Y
  }

  const targetMinNorm = targetBox.positionMm[normal];
  const targetMaxNorm = targetMinNorm + targetBox.sizeMm[normal];
  const targetMinU = targetBox.positionMm[uAxis];
  const targetMaxU = targetMinU + targetBox.sizeMm[uAxis];
  const targetMinV = targetBox.positionMm[vAxis];
  const targetMaxV = targetMinV + targetBox.sizeMm[vAxis];

  for (const other of boxes) {
    if (other.pieceId === targetPieceId) continue;

    const otherMinNorm = other.positionMm[normal];
    const otherMaxNorm = otherMinNorm + other.sizeMm[normal];

    // Check contact along normal axis
    // Face A: contacts positive normal side (inner face for side-left)
    // Face B: contacts negative normal side (outer face)
    let contactFace: 'face-A' | 'face-B' | null = null;

    if (Math.abs(otherMinNorm - targetMaxNorm) <= toleranceMm) {
      contactFace = 'face-A';
    } else if (Math.abs(otherMaxNorm - targetMinNorm) <= toleranceMm) {
      contactFace = 'face-B';
    } else if (
      otherMinNorm <= targetMaxNorm + toleranceMm &&
      otherMaxNorm >= targetMinNorm - toleranceMm &&
      Math.abs(other.sizeMm[normal] - targetBox.sizeMm[normal]) > 0
    ) {
      // Partial edge joint (e.g. confirmat butt joint)
      contactFace = 'face-A';
    }

    if (!contactFace) continue;

    // Check overlap along U and V axes
    const otherMinU = other.positionMm[uAxis];
    const otherMaxU = otherMinU + other.sizeMm[uAxis];
    const otherMinV = other.positionMm[vAxis];
    const otherMaxV = otherMinV + other.sizeMm[vAxis];

    const startU = Math.max(targetMinU, otherMinU);
    const endU = Math.min(targetMaxU, otherMaxU);
    const overlapU = endU - startU;

    const startV = Math.max(targetMinV, otherMinV);
    const endV = Math.min(targetMaxV, otherMaxV);
    const overlapV = endV - startV;

    if (overlapU > toleranceMm && overlapV > toleranceMm) {
      const xMm = Math.round(startU - targetMinU);
      const widthMm = Math.round(overlapU);
      const yMm = Math.round(startV - targetMinV);
      const heightMm = Math.round(overlapV);

      const isHorizontal = widthMm >= heightMm;
      const thicknessMm = Math.min(widthMm, heightMm);
      const centerLineMm = isHorizontal
        ? Math.round(yMm + heightMm / 2)
        : Math.round(xMm + widthMm / 2);

      const roleLabel = translateRoleToLabel(other.role, other.pieceId);

      projections.push({
        id: `proj-${targetPieceId}-${other.pieceId}`,
        sourcePieceId: other.pieceId,
        sourceRole: other.role,
        label: `${roleLabel} (${thicknessMm} mm)`,
        face: contactFace,
        xMm,
        yMm,
        widthMm,
        heightMm,
        thicknessMm,
        axis: isHorizontal ? 'horizontal' : 'vertical',
        centerLineMm,
      });
    }
  }

  return projections;
}
