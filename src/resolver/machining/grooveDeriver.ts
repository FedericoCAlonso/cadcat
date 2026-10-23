import { type Piece, type Joint } from '../../model';
import { type CustomGrooveOperation } from '../../model/operation';
import type { ResolvedPiece } from '../resolver';
import type { Position3D } from '../tree';
import { determinePieceSpatialSize, resolvePieceOrientation } from '../spatial3d';
import { getPieceFaceNormalSign } from './faceNormal';

type AnyPiece = Piece | ResolvedPiece;

/** A backing panel slides into grooves; a rear rail (id ending in '-rail-back') receives them. */
function isBackingPanel(piece: AnyPiece): boolean {
  if (piece.role.includes('rail')) return false;
  return piece.role === 'back' || piece.role.includes('back') || piece.id.endsWith('-back');
}

function getPosition(piece: AnyPiece): Position3D | undefined {
  if ('positionMm' in piece && typeof piece.positionMm === 'object' && piece.positionMm !== null) {
    return piece.positionMm as Position3D;
  }
  return undefined;
}

function spatialNormalAxis(piece: AnyPiece): 'x' | 'y' | 'z' {
  const o = resolvePieceOrientation(piece.role);
  if (o.x === 'thickness') return 'x';
  if (o.y === 'thickness') return 'y';
  return 'z';
}

/**
 * Picks the face of the grooved piece that looks toward the sliding piece, using the real 3D
 * placement and the same face-normal convention used by the 3D machining renderer.
 * Returns undefined when placement is not available (unresolved pieces).
 */
function resolveFaceTowardSliding(
  grooved: AnyPiece,
  sliding: AnyPiece,
): 'face-A' | 'face-B' | undefined {
  const gp = getPosition(grooved);
  const sp = getPosition(sliding);
  if (!gp || !sp) return undefined;
  const normal = spatialNormalAxis(grooved);
  const gs = determinePieceSpatialSize(grooved as Piece);
  const ss = determinePieceSpatialSize(sliding as Piece);
  const gCenter = gp[normal] + gs[normal] / 2;
  const sCenter = sp[normal] + ss[normal] / 2;
  if (sCenter === gCenter) return undefined;
  const desired = sCenter > gCenter ? 1 : -1;
  const signA = getPieceFaceNormalSign(grooved.role, grooved.id, true, normal);
  return signA === desired ? 'face-A' : 'face-B';
}

export interface DeriveGrooveOperationsOptions {
  backingThicknessMm?: number;
  backingGrooveDistanceMm?: number;
  backingGrooveDepthMm?: number;
  backingGrooveToleranceMm?: number;
}

/**
 * Automatically derives CustomGrooveOperation instances for all pieces
 * that have joints of kind 'groove' (carcase sides, partitions, bottom, roof, drawer boxes).
 */
export function deriveModuleGrooveOperations(
  pieces: (Piece | ResolvedPiece)[],
  joints: Joint[],
  options: DeriveGrooveOperationsOptions = {},
): CustomGrooveOperation[] {
  const {
    backingThicknessMm = 3,
    backingGrooveDistanceMm = 15,
    backingGrooveDepthMm = 8,
    backingGrooveToleranceMm = 0.5,
  } = options;

  const grooveWidth = backingThicknessMm + backingGrooveToleranceMm;
  const pieceMap = new Map<string, Piece | ResolvedPiece>();
  for (const p of pieces) {
    pieceMap.set(p.id, p);
  }

  const operations: CustomGrooveOperation[] = [];
  const generatedKeys = new Set<string>();

  for (const joint of joints) {
    if (joint.kind !== 'groove') continue;

    const pieceA = pieceMap.get(joint.a.pieceId);
    const pieceB = pieceMap.get(joint.b.pieceId);
    if (!pieceA || !pieceB) continue;

    // Identify which piece is the panel sliding into the groove and which receives the groove
    const isBackA = isBackingPanel(pieceA);
    const isBackB = isBackingPanel(pieceB);
    const isDrawerBottomA = pieceA.role === 'drawer-bottom' || (pieceA.role.includes('bottom') && (pieceA.role.includes('drawer') || pieceA.id.includes('drawer')));
    const isDrawerBottomB = pieceB.role === 'drawer-bottom' || (pieceB.role.includes('bottom') && (pieceB.role.includes('drawer') || pieceB.id.includes('drawer')));
    const isThinDividerA = (pieceA.role === 'partition' || pieceA.role === 'shelf') && pieceA.thicknessMm <= 9;
    const isThinDividerB = (pieceB.role === 'partition' || pieceB.role === 'shelf') && pieceB.thicknessMm <= 9;

    const slidingPiece = (isBackA || isDrawerBottomA || isThinDividerA)
      ? pieceA
      : (isBackB || isDrawerBottomB || isThinDividerB)
      ? pieceB
      : null;
    const groovedPiece = slidingPiece === pieceA ? pieceB : slidingPiece === pieceB ? pieceA : null;
    if (!groovedPiece || !slidingPiece) continue;

    const isThinDivider = slidingPiece === pieceA ? isThinDividerA : isThinDividerB;

    const r = groovedPiece.role.toLowerCase();
    const id = groovedPiece.id.toLowerCase();

    // 2D Contour dimensions
    const contour = groovedPiece.contour;
    const w = contour.points[1]?.x ?? 0;
    const h = contour.points[2]?.y ?? 0;

    let axis: 'x' | 'y' = 'y';
    let offsetMm = 0;
    let widthMm = grooveWidth;
    let depthMm = backingGrooveDepthMm;
    let faceType: 'face-A' | 'face-B' = 'face-A';
    let isDrawerGroove = false;

    if (isThinDivider) {
      // Dado groove for thin partitions / shelves. Orientation is derived from the grooved panel:
      // - horizontal panel (bottom/top/shelf): contour X is width, Y is depth -> groove runs along
      //   depth (axis 'y') at an offset measured along contour X.
      // - vertical panel (side/partition): contour X is depth, Y is height -> groove runs along
      //   depth (axis 'x') at an offset measured along contour Y.
      const groovedOrientation = resolvePieceOrientation(groovedPiece.role);
      const horizontalGrooved = groovedOrientation.z === 'height';
      axis = horizontalGrooved ? 'y' : 'x';
      const component: 'x' | 'y' = horizontalGrooved ? 'x' : 'y';
      const posGrooved = getPosition(groovedPiece)?.[component];
      const posSliding = getPosition(slidingPiece)?.[component];
      if (posGrooved !== undefined && posSliding !== undefined) {
        offsetMm = posSliding - posGrooved;
      } else {
        offsetMm = joint.offsetMm ?? 0;
      }
      // Center the groove on the divider thickness so tolerance is split on both sides
      offsetMm -= backingGrooveToleranceMm / 2;
      faceType = resolveFaceTowardSliding(groovedPiece, slidingPiece) ?? 'face-A';
      widthMm = slidingPiece.thicknessMm + backingGrooveToleranceMm;
      depthMm = 4;
    } else if (r.includes('side-left') || r.includes('side-right') || r === 'side') {
      // Carcase side: vertical groove along Y axis
      axis = 'y';
      faceType = 'face-A'; // Inner face
      offsetMm = w - backingGrooveDistanceMm - backingThicknessMm;
      widthMm = grooveWidth;
      depthMm = backingGrooveDepthMm;
    } else if (r.includes('partition')) {
      // Vertical divider partition in multi-bay carcases
      axis = 'y';
      const slidingPos = ('positionMm' in slidingPiece && typeof slidingPiece.positionMm === 'object' && slidingPiece.positionMm !== null && 'x' in slidingPiece.positionMm)
        ? ((slidingPiece.positionMm as Record<string, number>).x ?? 0)
        : 0;
      const groovedPos = ('positionMm' in groovedPiece && typeof groovedPiece.positionMm === 'object' && groovedPiece.positionMm !== null && 'x' in groovedPiece.positionMm)
        ? ((groovedPiece.positionMm as Record<string, number>).x ?? 0)
        : 0;
      faceType = slidingPos < groovedPos ? 'face-B' : 'face-A';
      offsetMm = w - backingGrooveDistanceMm - backingThicknessMm;
      widthMm = grooveWidth;
      depthMm = backingGrooveDepthMm;
    } else if (r.includes('bottom') && !r.includes('drawer')) {
      // Carcase bottom panel: horizontal groove along X axis
      axis = 'x';
      faceType = 'face-A'; // Top face
      offsetMm = h - backingGrooveDistanceMm - backingThicknessMm;
      widthMm = grooveWidth;
      depthMm = backingGrooveDepthMm;
    } else if (r.includes('roof') || r.includes('top') || r.includes('shelf')) {
      // Carcase roof / top panel or structural horizontal shelf: horizontal groove along X axis
      axis = 'x';
      faceType = 'face-A';
      offsetMm = h - backingGrooveDistanceMm - backingThicknessMm;
      widthMm = grooveWidth;
      depthMm = backingGrooveDepthMm;
    } else if (r.includes('rail') && (r.includes('back') || id.includes('back'))) {
      // Rear rail stretcher
      axis = 'x';
      faceType = 'face-A';
      offsetMm = h - backingGrooveDistanceMm - backingThicknessMm;
      widthMm = grooveWidth;
      depthMm = backingGrooveDepthMm;
    } else if (r.includes('drawer') && (r.includes('side') || r.includes('box'))) {
      // Drawer box side: horizontal groove along X axis (depth)
      axis = 'x';
      faceType = 'face-A'; // Inner face
      isDrawerGroove = true;
      offsetMm = 12; // Standard 12mm bottom reveal
      widthMm = slidingPiece.thicknessMm + backingGrooveToleranceMm;
      depthMm = Math.min(6, Math.round(groovedPiece.thicknessMm / 2));
    } else {
      continue;
    }

    if (!isThinDivider) {
      faceType = resolveFaceTowardSliding(groovedPiece, slidingPiece) ?? faceType;
      if (!isDrawerGroove) {
        // Center the groove on the backing thickness so tolerance is split on both sides
        offsetMm -= backingGrooveToleranceMm / 2;
      }
    }

    const opKey = `${groovedPiece.id}-${faceType}-${axis}-${Math.round(offsetMm)}`;
    if (generatedKeys.has(opKey)) continue;
    generatedKeys.add(opKey);

    operations.push({
      kind: 'groove',
      id: `op-groove-${groovedPiece.id}-${operations.length + 1}`,
      pieceId: groovedPiece.id,
      faceType,
      axis,
      offsetMm: Math.max(0, Math.round(offsetMm * 10) / 10),
      widthMm: Math.round(widthMm * 10) / 10,
      depthMm: Math.round(depthMm * 10) / 10,
      description: isThinDivider
        ? `Ranura de encastre para tabique ${slidingPiece.thicknessMm}mm`
        : `Ranura para fondo ${backingThicknessMm}mm`,
    });
  }

  return operations;
}
