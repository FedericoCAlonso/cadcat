import { type Piece, type Joint } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import { applyFrontEdgeBand } from '../frontEdge';

export interface PartitionConfig {
  id: string;
  openingWidthMm: number;
  openingHeightMm: number;
  depthMm: number;
  carcaseThicknessMm: number;
  materialId: string;
  partitionThicknessMm?: number;
  ratio?: number; // 0.5 for centered, or custom fraction
  bottomPieceId: string;
  edgeBandId?: string;
  setbackMm?: number;
}

export interface PartitionResult {
  piece: Piece;
  joints: Joint[];
  placementNode: PlacementNode;
  leftBayWidthMm: number;
  rightBayWidthMm: number;
  partitionXMm: number;
}

/**
 * Builds a vertical partition piece that divides cabinet opening into two bays.
 */
export function buildPartition(
  config: PartitionConfig,
  parentPieceId: string,
): PartitionResult {
  const {
    id,
    openingWidthMm,
    openingHeightMm,
    depthMm,
    carcaseThicknessMm: T,
    materialId,
    partitionThicknessMm,
    ratio = 0.5,
    bottomPieceId,
    edgeBandId,
    setbackMm = 0,
  } = config;

  const partT = partitionThicknessMm ?? T;

  const availableWidth = openingWidthMm - partT;
  const leftBayWidthMm = Math.round(availableWidth * ratio);
  const rightBayWidthMm = availableWidth - leftBayWidthMm;

  const partitionXMm = T + leftBayWidthMm;
  const partitionDepthMm = depthMm - setbackMm;

  const piece = createPiece({
    id,
    role: 'partition',
    materialId,
    contour: createRectangularContour(partitionDepthMm, openingHeightMm),
    thicknessMm: partT,
    structural: true,
  });

  // Front edge is banded if edgeBandId specified
  if (edgeBandId) {
    applyFrontEdgeBand(piece, edgeBandId);
  }

  const joints: Joint[] = [
    // Bottom joint to carcase bottom panel
    createJoint({
      a: { pieceId: bottomPieceId, faceId: 'top' },
      b: { pieceId: id, faceId: 'bottom-edge' },
      kind: 'confirmat',
    }),
  ];

  const placementNode: PlacementNode = {
    pieceId: id,
    parentPieceId,
    relativeOffset: {
      x: partitionXMm,
      y: T,
      z: 0,
    },
  };

  return {
    piece,
    joints,
    placementNode,
    leftBayWidthMm,
    rightBayWidthMm,
    partitionXMm,
  };
}
