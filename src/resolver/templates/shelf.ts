import { type Piece, type Joint } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import { applyFrontEdgeBand } from '../frontEdge';

export type ShelfMountType = 'fixed' | 'adjustable';

export interface ShelfConfig {
  id: string;
  openingWidthMm: number;
  depthMm: number;
  elevationYMm: number;
  carcaseThicknessMm: number;
  materialId: string;
  thicknessMm?: number;
  mountType: ShelfMountType;
  edgeBandId?: string;
  setbackMm?: number;
  frontOffsetMm?: number;
  lateralGapMm?: number;
}

export interface ShelfResult {
  piece: Piece;
  joints: Joint[];
  placementNode: PlacementNode;
  spanMm: number;
}

/**
 * Builds a fixed or adjustable shelf piece with joints and placement.
 */
export function buildShelf(
  config: ShelfConfig,
  parentPieceId: string,
): ShelfResult {
  const {
    id,
    openingWidthMm,
    depthMm,
    elevationYMm,
    carcaseThicknessMm: T,
    materialId,
    thicknessMm,
    mountType,
    edgeBandId,
    setbackMm = 20.0,
    frontOffsetMm,
    lateralGapMm = 2.0,
  } = config;

  const shelfT = thicknessMm ?? T;
  const effectiveSetback = frontOffsetMm ?? setbackMm;

  // Adjustable shelf is slightly narrower to slide in/out onto shelf pins
  const widthDeduction = mountType === 'adjustable' ? lateralGapMm : 0;
  const shelfWidth = Math.round(openingWidthMm - widthDeduction);
  const shelfDepth = Math.round(depthMm - effectiveSetback);

  const piece = createPiece({
    id,
    role: 'shelf',
    materialId,
    contour: createRectangularContour(shelfWidth, shelfDepth),
    thicknessMm: shelfT,
    structural: mountType === 'fixed',
  });

  // Front edge is banded if edgeBandId specified
  if (edgeBandId) {
    applyFrontEdgeBand(piece, edgeBandId);
  }

  const joints: Joint[] = [];
  const jointKind = mountType === 'fixed' ? 'confirmat' : 'shelf-pin';

  // Left joint
  joints.push(
    createJoint({
      a: { pieceId: parentPieceId, faceId: 'inner' },
      b: { pieceId: id, faceId: 'left-edge' },
      kind: jointKind,
    }),
  );

  const posX = T + (mountType === 'adjustable' ? Math.round(lateralGapMm / 2) : 0);
  const placementNode: PlacementNode = {
    pieceId: id,
    parentPieceId,
    relativeOffset: {
      x: posX,
      y: elevationYMm,
      z: effectiveSetback,
    },
  };

  return {
    piece,
    joints,
    placementNode,
    spanMm: shelfWidth,
  };
}
