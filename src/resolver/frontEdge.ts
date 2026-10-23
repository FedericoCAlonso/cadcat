import type { Piece } from '../model';
import { resolveDepthEdgeFaceIds } from './spatial3d';

function bandFace(piece: Piece, side: 'front' | 'rear', edgeBandId: string): void {
  const ids = resolveDepthEdgeFaceIds(piece.role);
  if (!ids) return;
  const face = piece.faces.find((f) => f.id === ids[side]);
  if (face) face.edgeBandId = edgeBandId;
}

/**
 * Applies edge banding to the edge facing the module front (z = 0), resolved from the
 * piece orientation (consistent with the 3D spatial mapping).
 */
export function applyFrontEdgeBand(piece: Piece, edgeBandId: string): void {
  bandFace(piece, 'front', edgeBandId);
}

/** Applies edge banding to the edge facing the module rear (z = max depth). */
export function applyRearEdgeBand(piece: Piece, edgeBandId: string): void {
  bandFace(piece, 'rear', edgeBandId);
}
