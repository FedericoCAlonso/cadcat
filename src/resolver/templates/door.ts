import { type Piece, type Joint } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import defaultProjectConfigJson from '../../config/defaultProjectConfig.json';

export type DoorMountType = 'full-overlay' | 'half-overlay' | 'inset' | 'overlay';

export interface DoorConfig {
  id: string;
  side: 'left' | 'right';
  mountType: DoorMountType;
  openingWidthMm: number;
  openingHeightMm: number;
  carcaseThicknessMm: number;
  materialId: string;
  doorThicknessMm?: number;
  edgeBandId?: string;
  gapMm?: number;
  revealMm?: number;
  hingeSetbackFromEndMm?: number;
  hingeCupEdgeSetbackMm?: number;
}

export interface DoorSubAssemblyResult {
  doorPiece: Piece;
  joints: Joint[];
  placementNode: PlacementNode;
  hingeCount: number;
  hingePositionsMm: number[];
}

/**
 * Standard industry hinge count based on door height.
 */
export function calculateHingeCount(doorHeightMm: number): number {
  if (doorHeightMm < 900) return 2;
  if (doorHeightMm < 1500) return 3;
  if (doorHeightMm < 2000) return 4;
  return 5;
}

/**
 * Calculates vertical positions of hinges measured from the bottom of the door.
 */
export function calculateHingePositions(
  doorHeightMm: number,
  hingeCount: number,
  setbackFromEndMm = 100,
): number[] {
  if (hingeCount <= 1) {
    return [Math.round(doorHeightMm / 2)];
  }

  const bottomHinge = setbackFromEndMm;
  const topHinge = doorHeightMm - setbackFromEndMm;

  if (hingeCount === 2) {
    return [bottomHinge, topHinge];
  }

  const positions: number[] = [bottomHinge];
  const step = (topHinge - bottomHinge) / (hingeCount - 1);

  for (let i = 1; i < hingeCount - 1; i++) {
    positions.push(Math.round(bottomHinge + i * step));
  }

  positions.push(topHinge);
  return positions;
}

/**
 * Builds a door piece with its hinge joints and placement node.
 * Supports full-overlay, half-overlay, and inset mount types.
 */
export function buildDoorSubAssembly(
  config: DoorConfig,
  parentPieceId: string,
): DoorSubAssemblyResult {
  const {
    id,
    side,
    mountType,
    openingWidthMm,
    openingHeightMm,
    carcaseThicknessMm: T,
    materialId,
    doorThicknessMm,
    edgeBandId,
    gapMm = defaultProjectConfigJson.hardware.doorInsetGapMm ?? 2.0,
    revealMm = defaultProjectConfigJson.hardware.doorOverlayRevealMm ?? 1.5,
    hingeSetbackFromEndMm = defaultProjectConfigJson.hardware.doorHingeMarginMm ?? 100,
  } = config;

  const doorT = doorThicknessMm ?? T;

  let doorWidthMm: number;
  let doorHeightMm: number;
  let posX: number;
  let posY: number;
  let posZ: number;

  if (mountType === 'full-overlay' || mountType === 'overlay') {
    // Sits in front of carcase covering side edges with small perimeter reveal
    doorWidthMm = Math.round(openingWidthMm + 2 * T - 2 * revealMm);
    doorHeightMm = Math.round(openingHeightMm + 2 * T - 2 * revealMm);
    posX = revealMm;
    posY = revealMm;
    posZ = -doorT;
  } else if (mountType === 'half-overlay') {
    // Overlays half carcase thickness on side panels (typical on shared center partition)
    doorWidthMm = Math.round(openingWidthMm + T - 2 * revealMm);
    doorHeightMm = Math.round(openingHeightMm + 2 * T - 2 * revealMm);
    posX = T / 2 + revealMm;
    posY = revealMm;
    posZ = -doorT;
  } else {
    // Inset door fits inside opening with perimeter clearance gap
    doorWidthMm = Math.round(openingWidthMm - 2 * gapMm);
    doorHeightMm = Math.round(openingHeightMm - 2 * gapMm);
    posX = T + gapMm;
    posY = T + gapMm;
    posZ = 0;
  }

  const doorPiece = createPiece({
    id,
    role: `door-${side}`,
    materialId,
    contour: createRectangularContour(doorWidthMm, doorHeightMm),
    thicknessMm: doorT,
    structural: false,
  });

  // Edge band on all 4 perimeter edges if specified
  if (edgeBandId) {
    for (const f of doorPiece.faces) {
      if (f.id.endsWith('-edge')) {
        f.edgeBandId = edgeBandId;
      }
    }
  }

  const hingeCount = calculateHingeCount(doorHeightMm);
  const hingePositionsMm = calculateHingePositions(doorHeightMm, hingeCount, hingeSetbackFromEndMm);

  // Generate hinge joints connecting door inner face to cabinet side inner face
  const joints: Joint[] = hingePositionsMm.map((pos) =>
    createJoint({
      a: { pieceId: id, faceId: 'inner' },
      b: { pieceId: parentPieceId, faceId: 'inner' },
      kind: 'hinge',
      offsetMm: pos,
    }),
  );

  const placementNode: PlacementNode = {
    pieceId: id,
    parentPieceId,
    relativeOffset: {
      x: posX,
      y: posY,
      z: posZ,
    },
  };

  return {
    doorPiece,
    joints,
    placementNode,
    hingeCount,
    hingePositionsMm,
  };
}
