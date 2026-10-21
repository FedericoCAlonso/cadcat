import { type Piece, type Joint } from '../../model';
import { type CustomGrooveOperation } from '../../model/operation';
import type { ResolvedPiece } from '../resolver';

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
    const isBackA = pieceA.role === 'back' || pieceA.role.includes('back') || pieceA.id.endsWith('-back');
    const isBackB = pieceB.role === 'back' || pieceB.role.includes('back') || pieceB.id.endsWith('-back');
    const isDrawerBottomA = pieceA.role === 'drawer-bottom' || (pieceA.role.includes('bottom') && (pieceA.role.includes('drawer') || pieceA.id.includes('drawer')));
    const isDrawerBottomB = pieceB.role === 'drawer-bottom' || (pieceB.role.includes('bottom') && (pieceB.role.includes('drawer') || pieceB.id.includes('drawer')));

    const slidingPiece = (isBackA || isDrawerBottomA) ? pieceA : (isBackB || isDrawerBottomB) ? pieceB : null;
    const groovedPiece = slidingPiece === pieceA ? pieceB : slidingPiece === pieceB ? pieceA : null;
    if (!groovedPiece || !slidingPiece) continue;

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

    if (r.includes('side-left') || r.includes('side-right') || r === 'side') {
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
    } else if (r.includes('roof') || r.includes('top')) {
      // Carcase roof / top panel: horizontal groove along X axis
      axis = 'x';
      faceType = 'face-A'; // Bottom face
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
      offsetMm = 12; // Standard 12mm bottom reveal
      widthMm = slidingPiece.thicknessMm + backingGrooveToleranceMm;
      depthMm = Math.min(6, Math.round(groovedPiece.thicknessMm / 2));
    } else {
      continue;
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
      description: `Ranura para fondo ${backingThicknessMm}mm`,
    });
  }

  return operations;
}
